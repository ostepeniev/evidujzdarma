import "server-only";
import { and, eq, exists, inArray, isNotNull, isNull, lt, ne, not, notExists, notInArray, or, sql } from "drizzle-orm";
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
 * Otevřená karanténa, která může být ostrá tržba: data v ostrém režimu, nebo MODE_MISMATCH na účtu v ostrém provozu –
 * pokladna se starým nastavením prodávala skutečně, jen v předchozím režimu (R5.1, R7.15 N7). Stejná podmínka pro
 * nastavení, e-maily, „Evidováno jinak“ i retention.
 */
const PRODUCTION_QUARANTINE = sql`(${schema.saleQuarantine.payload}->>'mode' = 'production' or (${schema.saleQuarantine.reasonCode} = 'MODE_MISMATCH' and exists (select 1 from ${schema.accounts} pq_acc where pq_acc.id = ${schema.saleQuarantine.accountId} and pq_acc.eet_mode = 'production')))`;

/**
 * Neodeslané ostré tržby zrušeného účtu – v sales (bez POK, neoznačené „Evidováno jinak“) a v otevřené karanténě.
 * Bez limitu: počet v nastavení, v e-mailu i to, co „Evidováno jinak“ označí, musí být tentýž seznam (R7.12).
 */
export async function unsentProductionOf(accountId: string) {
  const db = getDb();
  const sales = await db
    .select({ id: schema.sales.id, soldAt: schema.sales.soldAt, total: schema.sales.total, registerId: schema.sales.registerId, sequence: schema.sales.sequence })
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
    .select({ id: schema.saleQuarantine.id, payload: schema.saleQuarantine.payload })
    .from(schema.saleQuarantine)
    .where(and(eq(schema.saleQuarantine.accountId, accountId), isNull(schema.saleQuarantine.resolvedAt), PRODUCTION_QUARANTINE))
    .orderBy(schema.saleQuarantine.receivedAt);
  return { sales, quarantine };
}

/** Seznam pro vlastníka (nastavení, odpověď 409): přesně ta id, která pak „Evidováno jinak“ pošle zpět (R7.12). */
export function unsentView(unsent: Awaited<ReturnType<typeof unsentProductionOf>>) {
  return {
    ids: [...unsent.sales.map((s) => s.id), ...unsent.quarantine.map((q) => q.id)],
    sales: unsent.sales.map((s) => ({ id: s.id, soldAt: s.soldAt.toISOString(), total: s.total, registerId: s.registerId, sequence: s.sequence })),
    quarantine: unsent.quarantine.length,
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
 * (offline pokladna ji dovezla), neoznačí se nic a vrátí se 409 s aktuálním seznamem. Bez `ids` (stará stránka) také 409.
 * Id, která už neodeslaná nejsou (nebo patří jinam), se ignorují.
 */
export async function settleElsewhere(accountId: string, opts: { confirm: boolean; actor: string; ids?: readonly string[] }): Promise<{ sales: number; quarantine: number }> {
  const db = getDb();
  const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId), columns: { closedAt: true } });
  if (!acc?.closedAt) throw new HttpError(400, "„Evidováno jinak“ jde jen u zrušeného účtu. Neodeslané tržby živého účtu odešlete znovu.");
  if (!opts.confirm) throw new HttpError(400, "Potvrďte, že jste tyto tržby evidovali jinak.");
  const unsent = await unsentProductionOf(accountId);
  const seen = new Set(opts.ids ?? []);
  const view = unsentView(unsent);
  if (!opts.ids || view.ids.some((id) => !seen.has(id))) {
    throw new HttpError(409, "Seznam neodeslaných ostrých tržeb se mezitím změnil. Zkontrolujte aktuální seznam a potvrďte znovu.", { unsent: view });
  }
  const now = new Date();
  const actor = opts.actor.slice(0, 200);
  await db.transaction(async (tx) => {
    for (const s of unsent.sales) {
      const [row] = await tx
        .update(schema.sales)
        .set({
          settledElsewhereAt: now,
          // z fronty ven: odeslat se po zrušení stejně nedá (certifikát je smazaný)
          status: sql`case when ${schema.sales.status} in ('queued', 'failed', 'sending') then 'rejected'::sale_status else ${schema.sales.status} end`,
          blockedReason: null,
          claimToken: null,
          lastError: "EVIDENCED_ELSEWHERE: Vlastník tržbu evidoval jinak (zrušený účet).",
        })
        .where(and(eq(schema.sales.id, s.id), isNull(schema.sales.settledElsewhereAt)))
        .returning({ attempts: schema.sales.attempts });
      if (!row) continue;
      await tx.insert(schema.saleAttempts).values({
        saleId: s.id,
        attempt: row.attempts,
        environment: "production",
        firstAttempt: false,
        startedAt: now,
        result: "settled",
        code: "EVIDENCED_ELSEWHERE",
        message: `vlastník ${actor}: evidováno jinak (zrušený účet)`,
      });
    }
    if (unsent.quarantine.length) {
      await tx
        .update(schema.saleQuarantine)
        .set({ resolution: "dismissed", resolvedAt: now, updatedAt: now, note: `Evidováno jinak – vlastník ${actor} (zrušený účet)` })
        .where(inArray(schema.saleQuarantine.id, unsent.quarantine.map((q) => q.id)));
    }
  });
  return { sales: unsent.sales.length, quarantine: unsent.quarantine.length };
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
    await count(
      "preregistrations",
      db
        .delete(schema.preregistrations)
        .where(
          and(
            eq(schema.preregistrations.marketingConsent, false),
            isNull(schema.preregistrations.unsubscribedAt),
            lt(schema.preregistrations.createdAt, addMonths(now, -RETENTION.preregistrationMonths)),
            notExists(db.select({ x: sql`1` }).from(schema.users).where(sql`lower(${schema.users.email}) = lower(${schema.preregistrations.email})`)),
          ),
        )
        .returning({ id: schema.preregistrations.id }),
    );
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

