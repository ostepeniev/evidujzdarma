import "server-only";
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { enqueueEmail } from "./mail";
import { ownerEmails } from "./owners";
import { absoluteUrl } from "@/lib/site";
import { BLOCK_TEXT } from "./fiscal";

const dateCs = (d: Date) => d.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });

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

  // 2) Tržby, které se nedaří odeslat a lhůta 48 h končí do 12 hodin
  const stuck = await db
    .select({ accountId: schema.sales.accountId, n: sql<number>`count(*)::int`, first: sql<Date>`min(${schema.sales.deadlineAt})` })
    .from(schema.sales)
    .where(and(eq(schema.sales.status, "queued"), lte(schema.sales.deadlineAt, new Date(now.getTime() + 12 * 3_600_000))))
    .groupBy(schema.sales.accountId);
  for (const s of stuck) {
    for (const to of await ownerEmails(s.accountId)) {
      await enqueueEmail({
        to,
        template: "notice",
        dedupeKey: `stuck:${s.accountId}:${now.toISOString().slice(0, 13)}:${to}`,
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
  // 4) Odmítnuté nebo zablokované tržby (certifikát, EIČ…) – čekají na vlastníka, jednou denně (R1.3)
  const attention = await db
    .select({
      accountId: schema.sales.accountId,
      rejected: sql<number>`count(*) filter (where ${schema.sales.status} = 'rejected')::int`,
      blocked: sql<number>`count(*) filter (where ${schema.sales.blockedReason} is not null)::int`,
      reasons: sql<string[]>`array_remove(array_agg(distinct ${schema.sales.blockedReason}), null)`,
    })
    .from(schema.sales)
    .where(or(eq(schema.sales.status, "rejected"), and(eq(schema.sales.status, "queued"), isNotNull(schema.sales.blockedReason))))
    .groupBy(schema.sales.accountId);
  for (const a of attention) {
    const reasons = (a.reasons ?? []).map((r) => BLOCK_TEXT[r] ?? r);
    const parts = [
      a.rejected ? `Finanční správa odmítla ${a.rejected} ${a.rejected === 1 ? "tržbu" : "tržeb"}.` : "",
      a.blocked ? `${a.blocked} ${a.blocked === 1 ? "tržba se nemůže odeslat" : "tržeb se nemůže odeslat"}: ${reasons.join(" ")}` : "",
    ].filter(Boolean);
    for (const to of await ownerEmails(a.accountId)) {
      await enqueueEmail({
        to,
        template: "notice",
        dedupeKey: `attention:${a.accountId}:${now.toISOString().slice(0, 10)}:${to}`,
        payload: {
          subject: "Některé tržby čekají na vaše rozhodnutí",
          text: `${parts.join(" ")} Tržby jsou uložené. Po opravě je odešlete znovu v nastavení pokladny – lhůta pro odeslání je 48 hodin od prodeje.`,
          url: absoluteUrl("/pokladna/nastaveni#odmitnute-trzby"),
          buttonLabel: "Zobrazit tržby",
        },
      });
      queued++;
    }
  }
  return queued;
}
