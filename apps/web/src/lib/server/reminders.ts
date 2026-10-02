import "server-only";
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { enqueueEmail } from "./mail";
import { ownerEmails } from "./owners";
import { absoluteUrl } from "@/lib/site";
import { BLOCK_TEXT } from "./fiscal";

const dateCs = (d: Date) => d.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });

/** Datum a hodina v Praze – denní přehled chodí ráno místního času, ne po půlnoci UTC (čas kontejneru). */
function pragueClock(d: Date): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
/** Od kolika hodin (Praha) se posílá denní přehled. */
const DIGEST_FROM_HOUR = 7;

/** Připomínky: konec platnosti certifikátu, neodeslané tržby před koncem lhůty, změna jednotky. */
export async function runReminders(now = new Date()): Promise<number> {
  const db = getDb();
  let queued = 0;

  // 1) Certifikát končí do 30 / 7 dní
  for (const days of [30, 7]) {
    const certs = await db
      .select()
      .from(schema.certificates)
      .where(
        and(
          isNull(schema.certificates.revokedAt),
          eq(schema.certificates.environment, "production"),
          gt(schema.certificates.validTo, now),
          lte(schema.certificates.validTo, new Date(now.getTime() + days * 86_400_000)),
        ),
      );
    for (const c of certs) {
      for (const to of await ownerEmails(c.accountId)) {
        await enqueueEmail({
          to,
          template: "notice",
          dedupeKey: `cert-expiry:${c.id}:${days}:${to}`,
          payload: {
            subject: `Pokladní certifikát vyprší ${dateCs(c.validTo)}`,
            text: `Váš pokladní certifikát pro EET platí do ${dateCs(c.validTo)}. Vygenerujte v DIS+ nový a nahrajte ho v nastavení pokladny, aby evidence tržeb nepřestala fungovat.`,
            url: absoluteUrl("/pokladna/nastaveni#certifikat"),
            buttonLabel: "Nahrát nový certifikát",
          },
        });
        queued++;
      }
    }
  }

  // 2) Tržby, které se nedaří odeslat a lhůta 48 h končí do 12 hodin – nejvýš jednou za 6 h (Д-7).
  //    Po lhůtě už ne každou hodinu: takové tržby hlásí denní přehled (bod 4).
  const stuck = await db
    .select({ accountId: schema.sales.accountId, n: sql<number>`count(*)::int`, first: sql<Date>`min(${schema.sales.deadlineAt})` })
    .from(schema.sales)
    .where(and(eq(schema.sales.status, "queued"), gt(schema.sales.deadlineAt, now), lte(schema.sales.deadlineAt, new Date(now.getTime() + 12 * 3_600_000))))
    .groupBy(schema.sales.accountId);
  const sixHourSlot = `${now.toISOString().slice(0, 10)}T${Math.floor(now.getUTCHours() / 6)}`;
  for (const s of stuck) {
    for (const to of await ownerEmails(s.accountId)) {
      await enqueueEmail({
        to,
        template: "notice",
        dedupeKey: `stuck:${s.accountId}:${sixHourSlot}:${to}`,
        payload: {
          subject: `${s.n} ${s.n === 1 ? "tržba čeká" : "tržeb čeká"} na odeslání do EET`,
          text: `Některé tržby se nepodařilo odeslat Finanční správě. Lhůta 48 hodin u nejstarší z nich končí ${new Date(s.first).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}. Otevřete pokladnu s připojením k internetu nebo zkontrolujte certifikát a evidenční jednotky.`,
          url: absoluteUrl("/pokladna"),
          buttonLabel: "Otevřít pokladnu",
        },
      });
      queued++;
    }
  }

  // 3) Změna evidenční jednotky — připomenout oznámení v DIS+ (do 15 dnů)
  const changed = await db
    .select()
    .from(schema.evidenceUnits)
    .where(and(lte(schema.evidenceUnits.changedAt, new Date(now.getTime() - 86_400_000)), gt(schema.evidenceUnits.changedAt, new Date(now.getTime() - 3 * 86_400_000))));
  for (const u of changed) {
    const until = new Date(u.changedAt!.getTime() + 15 * 86_400_000);
    for (const to of await ownerEmails(u.accountId)) {
      await enqueueEmail({
        to,
        template: "notice",
        dedupeKey: `unit-change:${u.id}:${u.changedAt!.toISOString()}:${to}`,
        payload: {
          subject: "Nezapomeňte oznámit změnu evidenční jednotky",
          text: `Upravili jste evidenční jednotku „${u.label}“. Pokud se změnily údaje oznámené Finanční správě, oznamte změnu v DIS+ nejpozději do ${dateCs(until)} (do 15 dnů).`,
          url: absoluteUrl("/navody/evidencni-jednotka"),
          buttonLabel: "Jak oznámit změnu",
        },
      });
      queued++;
    }
  }
  // 4) Denní přehled (R1.3, Д-7): odmítnuté a zablokované tržby, tržby po lhůtě, které se stále nedaří odeslat,
  //    otevřená karanténa a upozornění FS (Varovani) za poslední den – jeden e-mail denně na účet.
  type Digest = { rejected: number; blocked: number; reasons: string[]; overdue: number; quarantine: number; warned: number };
  const digests = new Map<string, Digest>();
  const digest = (accountId: string) => {
    let d = digests.get(accountId);
    if (!d) digests.set(accountId, (d = { rejected: 0, blocked: 0, reasons: [], overdue: 0, quarantine: 0, warned: 0 }));
    return d;
  };
  const attention = await db
    .select({
      accountId: schema.sales.accountId,
      rejected: sql<number>`count(*) filter (where ${schema.sales.status} = 'rejected')::int`,
      blocked: sql<number>`count(*) filter (where ${schema.sales.blockedReason} is not null)::int`,
      overdue: sql<number>`count(*) filter (where ${schema.sales.status} = 'queued' and ${schema.sales.blockedReason} is null)::int`,
      reasons: sql<string[]>`array_remove(array_agg(distinct ${schema.sales.blockedReason}), null)`,
    })
    .from(schema.sales)
    .where(
      or(
        eq(schema.sales.status, "rejected"),
        and(eq(schema.sales.status, "queued"), isNotNull(schema.sales.blockedReason)),
        and(eq(schema.sales.status, "queued"), lte(schema.sales.deadlineAt, now)),
      ),
    )
    .groupBy(schema.sales.accountId);
  for (const a of attention) Object.assign(digest(a.accountId), { rejected: a.rejected, blocked: a.blocked, overdue: a.overdue, reasons: a.reasons ?? [] });
  const quarantined = await db
    .select({ accountId: schema.saleQuarantine.accountId, n: sql<number>`count(*)::int` })
    .from(schema.saleQuarantine)
    .where(isNull(schema.saleQuarantine.resolvedAt))
    .groupBy(schema.saleQuarantine.accountId);
  for (const q of quarantined) digest(q.accountId).quarantine = q.n;
  const warned = await db
    .select({ accountId: schema.sales.accountId, n: sql<number>`count(*)::int` })
    .from(schema.sales)
    .where(and(gt(schema.sales.sentAt, new Date(now.getTime() - 86_400_000)), sql`jsonb_array_length(coalesce(${schema.sales.warnings}, '[]'::jsonb)) > 0`))
    .groupBy(schema.sales.accountId);
  for (const w of warned) digest(w.accountId).warned = w.n;

  const prague = pragueClock(now);
  if (prague.hour < DIGEST_FROM_HOUR) digests.clear();
  for (const [accountId, a] of digests) {
    const reasons = a.reasons.map((r) => BLOCK_TEXT[r] ?? r);
    const parts = [
      a.rejected ? `Finanční správa odmítla ${a.rejected} ${a.rejected === 1 ? "tržbu" : "tržeb"}.` : "",
      a.blocked ? `${a.blocked} ${a.blocked === 1 ? "tržba se nemůže odeslat" : "tržeb se nemůže odeslat"}: ${reasons.join(" ")}` : "",
      a.overdue ? `${a.overdue} ${a.overdue === 1 ? "tržbu" : "tržeb"} po lhůtě 48 hodin se stále nedaří odeslat – zkoušíme to dál.` : "",
      a.quarantine ? `${a.quarantine} ${a.quarantine === 1 ? "tržba čeká" : "tržeb čeká"} v karanténě na vaše rozhodnutí (server je nemohl přijmout).` : "",
      a.warned ? `K ${a.warned} ${a.warned === 1 ? "tržbě" : "tržbám"} za poslední den připojila Finanční správa upozornění – tržby jsou přijaté, zkontrolujte údaje.` : "",
    ].filter(Boolean);
    for (const to of await ownerEmails(accountId)) {
      await enqueueEmail({
        to,
        template: "notice",
        dedupeKey: `attention:${accountId}:${prague.date}:${to}`,
        payload: {
          subject: "Některé tržby čekají na vaše rozhodnutí",
          text: `${parts.join(" ")} Tržby jsou uložené. Podrobnosti a „Odeslat znovu“ najdete v nastavení pokladny – lhůta pro odeslání je 48 hodin od prodeje.`,
          url: absoluteUrl("/pokladna/nastaveni#odmitnute-trzby"),
          buttonLabel: "Zobrazit tržby",
        },
      });
      queued++;
    }
  }
  return queued;
}
