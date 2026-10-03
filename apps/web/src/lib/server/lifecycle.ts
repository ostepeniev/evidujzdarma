import "server-only";
import { and, eq, exists, gte, inArray, isNotNull, isNull, lt, lte, ne, not, notExists, notInArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { RETENTION } from "@/lib/legal";
import { HttpError } from "./auth";
import { forgetCredential } from "./fiscal";

/**
 * Funkce, které slibují právní texty (Р8), a doby uložení ze zásad – na jednom místě,
 * aby text a kód nemohly odplavat od sebe.
 */

/** „Odstranit certifikát“ (podmínky čl. 9.2): zneplatní ho ve službě a smaže šifrovaný klíč. */
export async function removeCertificate(accountId: string, certificateId: string): Promise<void> {
  const rows = await getDb()
    .update(schema.certificates)
    .set({ revokedAt: sql`coalesce(${schema.certificates.revokedAt}, now())`, encryptedKey: null, encryptedDek: null })
    .where(and(eq(schema.certificates.id, certificateId), eq(schema.certificates.accountId, accountId)))
    .returning({ environment: schema.certificates.environment });
  if (!rows.length) throw new HttpError(404, "Certifikát nenalezen");
  forgetCredential(accountId);
}

/** „Zrušit propojení s účetní“ (pozvánka, kabinet): klient odpojí účetní od svého účtu. */
export async function unlinkAccountant(clientAccountId: string, linkId: string): Promise<void> {
  const rows = await getDb()
    .update(schema.accountantClients)
    .set({ clientAccountId: null, inviteTokenHash: null, inviteExpiresAt: null })
    .where(and(eq(schema.accountantClients.id, linkId), eq(schema.accountantClients.clientAccountId, clientAccountId)))
    .returning({ id: schema.accountantClients.id });
  if (!rows.length) throw new HttpError(404, "Propojení nenalezeno");
}

/** Účetní, které mají k účtu přístup (pro nastavení klienta). */
export async function linkedAccountants(clientAccountId: string) {
  return getDb()
    .select({ id: schema.accountantClients.id, name: schema.accounts.name })
    .from(schema.accountantClients)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.accountantClients.accountantAccountId))
    .where(eq(schema.accountantClients.clientAccountId, clientAccountId));
}

/** Tržby bez konečného stavu (mimo ukázkový režim), otevřená karanténa a zařízení – co by zrušení účtu ohrozilo. */
export async function closureBlockers(accountId: string) {
  const db = getDb();
  const pending = await db
    .select({ mode: schema.sales.mode, count: sql<number>`count(*)::int`, oldest: sql<string>`min(${schema.sales.soldAt})::text` })
    .from(schema.sales)
    .where(
      and(
        eq(schema.sales.accountId, accountId),
        ne(schema.sales.mode, "mock"),
        inArray(schema.sales.status, ["queued", "sending", "failed", "rejected"]),
        isNull(schema.sales.settledElsewhereAt),
      ),
    )
    .groupBy(schema.sales.mode);
  const [q] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.saleQuarantine)
    .where(and(eq(schema.saleQuarantine.accountId, accountId), isNull(schema.saleQuarantine.resolvedAt)));
  const devices = await db
    .select({ name: schema.devices.name, registerId: schema.devices.registerId, lastSeenAt: schema.devices.lastSeenAt })
    .from(schema.devices)
    .where(and(eq(schema.devices.accountId, accountId), isNull(schema.devices.revokedAt)));
  return { pending, quarantine: q?.n ?? 0, devices };
}

/**
 * „Zrušit účet“ (podmínky čl. 11.1, 11.3): certifikáty přestanou fungovat hned, vlastník má 30 dnů na export,
 * potom data smaže cron (runRetention). Neodeslané tržby nebo otevřená karanténa → 409 se seznamem, dokud to
 * vlastník výslovně nepotvrdí (R5.8, invariant 1). Zařízení po zrušení jen dovyvezou uložené tržby.
 */
export async function closeAccount(accountId: string, opts: { confirm?: boolean } = {}): Promise<Date> {
  const db = getDb();
  if (!opts.confirm) {
    const blockers = await closureBlockers(accountId);
    if (blockers.pending.length || blockers.quarantine > 0) {
      throw new HttpError(409, "Některé tržby ještě nejsou odeslané Finanční správě nebo čekají na vaše rozhodnutí. Vyřiďte je, nebo zrušení výslovně potvrďte.", {
        pending: blockers.pending,
        quarantine: blockers.quarantine,
        devices: blockers.devices.map((d) => ({ ...d, lastSeenAt: d.lastSeenAt?.toISOString() ?? null })),
      });
    }
  }
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.accounts).set({ closedAt: now }).where(and(eq(schema.accounts.id, accountId), isNull(schema.accounts.closedAt)));
    // zařízení se neodpojují: po zrušení smí jen dovyvézt uložené tržby a pokladní záznamy (authenticateDevice)
    await tx
      .update(schema.certificates)
      .set({ revokedAt: sql`coalesce(${schema.certificates.revokedAt}, now())`, encryptedKey: null, encryptedDek: null })
      .where(eq(schema.certificates.accountId, accountId));
    await tx.update(schema.accountantClients).set({ clientAccountId: null }).where(eq(schema.accountantClients.clientAccountId, accountId));
  });
  forgetCredential(accountId);
  const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId), columns: { closedAt: true } });
  const closedAt = acc?.closedAt ?? now;
  // první ze tří souhrnných e-mailů po zrušení (Б7)
  await sendClosedSummary(accountId, closedAt, 0);
  return new Date(closedAt.getTime() + RETENTION.closedAccountDays * DAY_MS);
}

const DAY_MS = 86_400_000;

/**
 * Otevřená karanténa, která může být ostrá tržba: data v ostrém režimu, nebo na účtu v ostrém provozu MODE_MISMATCH či
 * jakákoli tržba z jiného režimu prodaná po přepnutí – pokladna se starým nastavením prodávala skutečně, jen v předchozím
 * režimu, a karanténu mohl způsobit i jiný důvod (FUTURE_DATE, TOO_OLD…; R5.1, R7.15 N7, R8.7 N13). Nečitelné datum se
 * bere jako ostré (fail-closed). Stejná podmínka pro nastavení, e-maily, „Evidováno jinak“ i retention.
 */
const PRODUCTION_QUARANTINE = sql`(${schema.saleQuarantine.payload}->>'mode' = 'production' or exists (select 1 from ${schema.accounts} pq_acc where pq_acc.id = ${schema.saleQuarantine.accountId} and pq_acc.eet_mode = 'production' and (${schema.saleQuarantine.reasonCode} = 'MODE_MISMATCH' or case when ${schema.saleQuarantine.payload}->>'soldAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:?[0-9]{2})$' then (${schema.saleQuarantine.payload}->>'soldAt')::timestamptz >= pq_acc.eet_mode_changed_at else true end)))`;

/**
 * Neodeslané ostré tržby zrušeného účtu – v sales (bez POK, neoznačené „Evidováno jinak“) a v otevřené karanténě.
 * Bez limitu: počet v nastavení, v e-mailu i to, co „Evidováno jinak“ označí, musí být tentýž seznam (R7.12).
 */
export async function unsentProductionOf(accountId: string) {
  const db = getDb();
  const sales = await db
    .select({ id: schema.sales.id, soldAt: schema.sales.soldAt, total: schema.sales.total, registerId: schema.sales.registerId, sequence: schema.sales.sequence, receivedAt: schema.sales.receivedAt })
    .from(schema.sales)
    .where(
      and(
        eq(schema.sales.accountId, accountId),
        eq(schema.sales.mode, "production"),
        notInArray(schema.sales.status, ["confirmed", "not_required"]),
        isNull(schema.sales.settledElsewhereAt),
      ),
    )
    .orderBy(schema.sales.soldAt);
  const quarantine = await db
    .select({ id: schema.saleQuarantine.id, payload: schema.saleQuarantine.payload, updatedAt: schema.saleQuarantine.updatedAt })
    .from(schema.saleQuarantine)
    .where(and(eq(schema.saleQuarantine.accountId, accountId), isNull(schema.saleQuarantine.resolvedAt), PRODUCTION_QUARANTINE))
    .orderBy(schema.saleQuarantine.receivedAt);
  return { sales, quarantine };
}

/** Do kolika neodeslaných tržeb potvrzuje „Evidováno jinak“ seznam id; nad to počet a čas posledního přijetí (R8.7 N16). */
export const SETTLE_IDS_LIMIT = 5000;
/** Kolik tržeb ukazuje seznam v nastavení (zbytek „a dalších N“). */
const SHOWN_SALES = 20;

/** Co vlastník viděl u dlouhého seznamu: počet a čas posledního přijetí tržby či karantény (R8.7 N16). */
export type UnsentSeen = { count: number; lastAt: string | null };

/**
 * Seznam pro vlastníka (nastavení, odpověď 409). „Evidováno jinak“ pak pošle zpět přesně tato id (R7.12) – nebo u dlouhého
 * seznamu `seen` (počet a čas posledního přijetí), aby se nemusely přenášet desetitisíce id (R8.7 N16).
 */
export function unsentView(unsent: Awaited<ReturnType<typeof unsentProductionOf>>) {
  const count = unsent.sales.length + unsent.quarantine.length;
  const last = Math.max(0, ...unsent.sales.map((s) => s.receivedAt.getTime()), ...unsent.quarantine.map((q) => q.updatedAt.getTime()));
  return {
    ids: count <= SETTLE_IDS_LIMIT ? [...unsent.sales.map((s) => s.id), ...unsent.quarantine.map((q) => q.id)] : null,
    sales: unsent.sales.slice(0, SHOWN_SALES).map((s) => ({ id: s.id, soldAt: s.soldAt.toISOString(), total: s.total, registerId: s.registerId, sequence: s.sequence })),
    salesCount: unsent.sales.length,
    quarantine: unsent.quarantine.length,
    seen: { count, lastAt: last ? new Date(last).toISOString() : null } satisfies UnsentSeen,
  };
}

/** Do kdy data zrušeného účtu nejpozději smažeme: 30 dnů, s neodeslanými ostrými tržbami nejdéle 60 dnů (Б7). */
export function closedDeleteBy(closedAt: Date, held: boolean): Date {
  return new Date(closedAt.getTime() + (held ? RETENTION.closedAccountHoldDays : RETENTION.closedAccountDays) * DAY_MS);
}

/**
 * Souhrnný e-mail po zrušení účtu (Б7, R6.4): den zrušení, 30. a 55. den – s odkazem na export a seznamem
 * neodeslaných ostrých tržeb. 30. a 55. den jen u účtu, který se kvůli nim ještě drží.
 */
export async function sendClosedSummary(accountId: string, closedAt: Date, day: number): Promise<boolean> {
  const unsent = await unsentProductionOf(accountId);
  const n = unsent.sales.length + unsent.quarantine.length;
  if (day > 0 && n === 0) return false;
  const [{ enqueueEmail }, { ownerEmails }, { absoluteUrl }] = await Promise.all([import("./mail"), import("./owners"), import("@/lib/site")]);
  const dateCs = (d: Date) => d.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
  const deleteBy = closedDeleteBy(closedAt, n > 0);
  const list = unsent.sales
    .slice(0, 20)
    .map((s) => `• ${s.soldAt.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })} · ${(s.total / 100).toFixed(2).replace(".", ",")} Kč · ${s.registerId}/${s.sequence}`);
  const more = unsent.sales.length > 20 ? [`• … a dalších ${unsent.sales.length - 20}`] : [];
  const q = unsent.quarantine.length ? [`• ${unsent.quarantine.length}× tržba v karanténě (server ji nemohl přijmout)`] : [];
  const text =
    n > 0
      ? [
          `Účet byl zrušen ${dateCs(closedAt)}. Neodeslané ostré tržby (Finanční správě se po zrušení už neodešlou):`,
          ...list,
          ...more,
          ...q,
          "",
          `Evidujte je jinak (např. v aplikaci MOJE eet) a v nastavení pokladny je pak označte „Evidováno jinak“. Data účtu smažeme nejpozději ${dateCs(deleteBy)} – do té doby si stáhněte export tržeb.`,
        ].join("\n")
      : `Účet byl zrušen ${dateCs(closedAt)}. Neodeslané ostré tržby nemá. Data smažeme ${dateCs(deleteBy)} – do té doby si stáhněte export tržeb.`;
  let sent = false;
  for (const to of await ownerEmails(accountId)) {
    sent =
      (await enqueueEmail({
        to,
        template: "notice",
        dedupeKey: `closed-summary:${accountId}:${day}:${to}`,
        payload: { subject: day === 0 ? "Účet EvidujZdarma je zrušený" : `Zrušený účet – data smažeme ${dateCs(deleteBy)}`, text, url: absoluteUrl("/pokladna/nastaveni#export"), buttonLabel: "Stáhnout export" },
      })) || sent;
  }
  return sent;
}

/**
 * „Evidováno jinak“ (Б7, R6.4): vlastník zrušeného účtu potvrdí, že neodeslané ostré tržby evidoval jinak.
 * Tržby se označí (do auditu sale_attempts s tím, kdo to udělal), produkční karanténa se vyřídí; účet se pak už nedrží.
 * Jen u zrušeného účtu – na živém účtu by to byl tichý konec tržby (invariant 1).
 *
 * Potvrzení platí jen pro seznam, který vlastník viděl (`ids`, R7.12): přibyla-li mezitím další neodeslaná ostrá tržba
 * (offline pokladna ji dovezla), neoznačí se nic a vrátí se 409 s aktuálním seznamem. Bez `ids` i bez `seen` (stará
 * stránka) také 409. Id, která už neodeslaná nejsou (nebo patří jinam), se ignorují. U dlouhého seznamu (nad
 * SETTLE_IDS_LIMIT) potvrzuje `seen`: stejný počet a nic přijatého později (R8.7 N16).
 * Jedním UPDATE (+ audit INSERT … SELECT); vyřízenou karanténu nepřepíše.
 */
export async function settleElsewhere(
  accountId: string,
  opts: { confirm: boolean; actor: string; ids?: readonly string[] | null; seen?: UnsentSeen | null },
): Promise<{ sales: number; quarantine: number }> {
  const db = getDb();
  const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId), columns: { closedAt: true } });
  if (!acc?.closedAt) throw new HttpError(400, "„Evidováno jinak“ jde jen u zrušeného účtu. Neodeslané tržby živého účtu odešlete znovu.");
  if (!opts.confirm) throw new HttpError(400, "Potvrďte, že jste tyto tržby evidovali jinak.");
  const unsent = await unsentProductionOf(accountId);
  const view = unsentView(unsent);
  const current = [...unsent.sales.map((s) => s.id), ...unsent.quarantine.map((q) => q.id)];
  const seenIds = new Set(opts.ids ?? []);
  const seenAt = opts.seen?.lastAt ? Date.parse(opts.seen.lastAt) : 0;
  const lastAt = view.seen.lastAt ? Date.parse(view.seen.lastAt) : 0;
  const confirmed = opts.ids ? current.every((id) => seenIds.has(id)) : opts.seen ? opts.seen.count === current.length && lastAt <= seenAt : false;
  if (!confirmed) {
    throw new HttpError(409, "Seznam neodeslaných ostrých tržeb se mezitím změnil. Zkontrolujte aktuální seznam a potvrďte znovu.", { unsent: view });
  }
  const now = new Date();
  const actor = opts.actor.slice(0, 200);
  const message = `vlastník ${actor}: evidováno jinak (zrušený účet)`;
  const lastSeen = new Date(lastAt);
  return db.transaction(async (tx) => {
    // jen potvrzený seznam: u id přesně ta id, u `seen` jen přijaté do času posledního, který vlastník viděl
    const salesWhere = opts.ids
      ? inArray(schema.sales.id, unsent.sales.map((s) => s.id))
      : and(eq(schema.sales.mode, "production"), notInArray(schema.sales.status, ["confirmed", "not_required"]), lte(schema.sales.receivedAt, lastSeen));
    const settled = unsent.sales.length
      ? await tx
          .update(schema.sales)
          .set({
            settledElsewhereAt: now,
            // z fronty ven: odeslat se po zrušení stejně nedá (certifikát je smazaný)
            status: sql`case when ${schema.sales.status} in ('queued', 'failed', 'sending') then 'rejected'::sale_status else ${schema.sales.status} end`,
            blockedReason: null,
            claimToken: null,
            lastError: "EVIDENCED_ELSEWHERE: Vlastník tržbu evidoval jinak (zrušený účet).",
          })
          .where(and(eq(schema.sales.accountId, accountId), isNull(schema.sales.settledElsewhereAt), salesWhere))
          .returning({ id: schema.sales.id })
      : [];
    if (settled.length) {
      await tx.execute(
        sql`insert into sale_attempts (sale_id, attempt, environment, first_attempt, started_at, result, code, message)
            select id, attempts, 'production', false, ${now}, 'settled', 'EVIDENCED_ELSEWHERE', ${message}
            from ${schema.sales} where ${schema.sales.accountId} = ${accountId} and ${schema.sales.settledElsewhereAt} = ${now}`,
      );
    }
    const quarantineWhere = opts.ids ? inArray(schema.saleQuarantine.id, unsent.quarantine.map((q) => q.id)) : and(PRODUCTION_QUARANTINE, lte(schema.saleQuarantine.updatedAt, lastSeen));
    const dismissed = unsent.quarantine.length
      ? await tx
          .update(schema.saleQuarantine)
          .set({ resolution: "dismissed", resolvedAt: now, updatedAt: now, note: `Evidováno jinak – vlastník ${actor} (zrušený účet)` })
          .where(and(eq(schema.saleQuarantine.accountId, accountId), isNull(schema.saleQuarantine.resolvedAt), quarantineWhere))
          .returning({ id: schema.saleQuarantine.id })
      : [];
    return { sales: settled.length, quarantine: dismissed.length };
  });
}

const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + m);
  return x;
};
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** Doby uložení ze zásad ochrany osobních údajů. Volá cron (hodinově, je idempotentní). */
export async function runRetention(now = new Date()): Promise<Record<string, number>> {
  const db = getDb();
  const out: Record<string, number> = {};
  const count = async (k: string, p: Promise<unknown[]>) => (out[k] = (await p).length);
  const DAY = 86_400_000;

  // Zrušené účty: 30 dnů na export, pak smazání (kaskáda: tržby, zařízení, jednotky, personál…).
  // Účet s produkčními tržbami bez POK se drží, nejdéle však 60 dnů od zrušení (R5.8, Б7/R6.4).
  const expired = and(isNotNull(schema.accounts.closedAt), lt(schema.accounts.closedAt, ago(now, RETENTION.closedAccountDays * DAY)));
  const holdOver = and(isNotNull(schema.accounts.closedAt), lt(schema.accounts.closedAt, ago(now, RETENTION.closedAccountHoldDays * DAY)));
  const unsentSales = db
    .select({ x: sql`1` })
    .from(schema.sales)
    .where(
      and(
        eq(schema.sales.accountId, schema.accounts.id),
        eq(schema.sales.mode, "production"),
        notInArray(schema.sales.status, ["confirmed", "not_required"]),
        isNull(schema.sales.settledElsewhereAt),
      ),
    );
  // produkční tržba v otevřené karanténě taky nebyla evidována – karanténa by zmizela kaskádou s účtem (R6.3)
  const openProductionQuarantine = db
    .select({ x: sql`1` })
    .from(schema.saleQuarantine)
    .where(and(eq(schema.saleQuarantine.accountId, schema.accounts.id), isNull(schema.saleQuarantine.resolvedAt), PRODUCTION_QUARANTINE));
  const unsentProduction = or(exists(unsentSales), exists(openProductionQuarantine))!;
  await count("accounts", db.delete(schema.accounts).where(or(and(expired, not(unsentProduction)), holdOver)).returning({ id: schema.accounts.id }));
  const held = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(and(expired, unsentProduction));
  // pokladny zrušeného účtu po 30 dnech odpojit, i když se účet ještě drží (Б7)
  const closedLong = db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(isNotNull(schema.accounts.closedAt), lt(schema.accounts.closedAt, ago(now, RETENTION.closedDeviceDays * DAY))));
  await count(
    "devicesRevoked",
    db
      .update(schema.devices)
      .set({ revokedAt: now })
      .where(and(isNull(schema.devices.revokedAt), inArray(schema.devices.accountId, closedLong)))
      .returning({ id: schema.devices.id }),
  );
  out.accountsHeld = held.length;
  if (held.length) {
    const { enqueueEmail } = await import("./mail");
    const { SITE } = await import("@/lib/site");
    await enqueueEmail({
      to: SITE.email,
      template: "notice",
      dedupeKey: `retention-held:${now.toISOString().slice(0, 10)}`,
      payload: {
        subject: `Zrušené účty s neodeslanými produkčními tržbami (${held.length})`,
        text: `Retention tyto zrušené účty zatím nesmazala, protože mají produkční tržby bez POK: ${held.map((h) => h.id).join(", ")}. Smažou se nejpozději ${RETENTION.closedAccountHoldDays} dnů od zrušení, nebo dřív, když vlastník tržby označí „Evidováno jinak“.`,
      },
    });
  }

  // Předregistrace bez souhlasu a bez účtu: do spuštění pokladny + 12 měsíců (od pozdější registrace)
  const launchPlus = addMonths(new Date(`${RETENTION.launch}T00:00:00+01:00`), RETENTION.preregistrationMonths);
  if (now >= launchPlus) {
    const termOver = and(
      eq(schema.preregistrations.marketingConsent, false),
      isNull(schema.preregistrations.unsubscribedAt),
      lt(schema.preregistrations.createdAt, addMonths(now, -RETENTION.preregistrationMonths)),
      notExists(db.select({ x: sql`1` }).from(schema.users).where(sql`lower(${schema.users.email}) = lower(${schema.preregistrations.email})`)),
    );
    // odvolaný souhlas: doklad o souhlasu a odvolání zůstává ještě 3 roky po odvolání (zásady), předregistrace ne –
    // záznam se zmenší na doklad (R8.2); smaže se, až uplynou 3 roky od odvolání
    const proofDue = and(isNotNull(schema.preregistrations.marketingConsentWithdrawnAt), gte(schema.preregistrations.marketingConsentWithdrawnAt, addMonths(now, -12 * RETENTION.consentProofYears)));
    const proofs = await db
      .update(schema.preregistrations)
      .set({
        ico: null,
        companyName: null,
        industry: null,
        establishmentsCount: null,
        needs: [],
        utm: null,
        referredBy: null,
        referralCode: sql`'p' || substr(md5(random()::text || ${schema.preregistrations.id}::text), 1, 11)`,
        confirmTokenHash: sql`md5(random()::text || ${schema.preregistrations.id}::text) || md5(${schema.preregistrations.id}::text || random()::text)`,
        confirmTokenIssuedAt: null,
        locale: null,
      })
      .where(and(termOver, proofDue, isNotNull(schema.preregistrations.confirmTokenIssuedAt)))
      .returning({ id: schema.preregistrations.id });
    if (proofs.length) await db.delete(schema.preregistrationInterests).where(inArray(schema.preregistrationInterests.preregistrationId, proofs.map((p) => p.id)));
    out.preregistrationsToConsentProof = proofs.length;
    await count("preregistrations", db.delete(schema.preregistrations).where(and(termOver, not(proofDue!))).returning({ id: schema.preregistrations.id }));
  }
  // Doklad o odvolaném souhlasu: 3 roky po odhlášení
  await count(
    "unsubscribed",
    db
      .delete(schema.preregistrations)
      .where(and(isNotNull(schema.preregistrations.unsubscribedAt), lt(schema.preregistrations.unsubscribedAt, addMonths(now, -12 * RETENTION.consentProofYears))))
      .returning({ id: schema.preregistrations.id }),
  );
  // Námitky a žádosti: 3 roky od vyřízení
  await count(
    "objections",
    db
      .delete(schema.objections)
      .where(and(isNotNull(schema.objections.resolvedAt), lt(schema.objections.resolvedAt, addMonths(now, -12 * RETENTION.objectionYears))))
      .returning({ id: schema.objections.id }),
  );
  // Nepotvrzené předregistrace (DOI nikdy neproběhlo): 90 dní od posledního odkazu – odkaz platí 30 dní,
  // bez potvrzení údaje nejde použít k ničemu (B Дрібне 12). Odhlášení se drží 3 roky jako doklad (výše).
  await count(
    "preregistrationsUnconfirmed",
    db
      .delete(schema.preregistrations)
      .where(
        and(
          isNull(schema.preregistrations.confirmedAt),
          isNull(schema.preregistrations.unsubscribedAt),
          lt(schema.preregistrations.confirmTokenIssuedAt, ago(now, RETENTION.unconfirmedPreregistrationDays * DAY)),
        ),
      )
      .returning({ id: schema.preregistrations.id }),
  );
  // Záznamy odeslaných e-mailů (obsahují adresy a obsah): 90 dnů
  await count(
    "emails",
    db
      .delete(schema.emailOutbox)
      .where(and(ne(schema.emailOutbox.status, "queued"), ne(schema.emailOutbox.status, "sending"), lt(schema.emailOutbox.createdAt, ago(now, RETENTION.emailLogDays * DAY))))
      .returning({ id: schema.emailOutbox.id }),
  );
  // Přihlašovací relace a odkazy po vypršení (bezpečnostní záznamy nejvýše 90 dnů)
  await count("sessions", db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).returning({ id: schema.sessions.id }));
  await count(
    "loginTokens",
    db
      .delete(schema.loginTokens)
      .where(or(lt(schema.loginTokens.expiresAt, ago(now, DAY)), and(isNotNull(schema.loginTokens.usedAt), lt(schema.loginTokens.usedAt, ago(now, DAY)))))
      .returning({ id: schema.loginTokens.tokenHash }),
  );
  // Mezipaměť ARES: 24 hodin
  await count("aresCache", db.delete(schema.aresCache).where(lt(schema.aresCache.fetchedAt, ago(now, RETENTION.aresCacheHours * 3_600_000))).returning({ key: schema.aresCache.key }));
  return out;
}

