import "server-only";
import { and, eq, exists, inArray, isNotNull, isNull, lt, ne, notExists, notInArray, or, sql } from "drizzle-orm";
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
    .where(and(eq(schema.sales.accountId, accountId), ne(schema.sales.mode, "mock"), inArray(schema.sales.status, ["queued", "sending", "failed", "rejected"])))
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
  return new Date((acc?.closedAt ?? now).getTime() + RETENTION.closedAccountDays * 86_400_000);
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
  // Účet s produkčními tržbami bez POK se nesmaže bez samostatného rozhodnutí provozovatele (R5.8).
  const expired = and(isNotNull(schema.accounts.closedAt), lt(schema.accounts.closedAt, ago(now, RETENTION.closedAccountDays * DAY)));
  const unsentProduction = db
    .select({ x: sql`1` })
    .from(schema.sales)
    .where(and(eq(schema.sales.accountId, schema.accounts.id), eq(schema.sales.mode, "production"), notInArray(schema.sales.status, ["confirmed", "not_required"])));
  await count("accounts", db.delete(schema.accounts).where(and(expired, notExists(unsentProduction))).returning({ id: schema.accounts.id }));
  const held = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(and(expired, exists(unsentProduction)));
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
        text: `Retention tyto zrušené účty nesmazala, protože mají produkční tržby bez POK: ${held.map((h) => h.id).join(", ")}. Rozhodněte o nich samostatně (vlastník je může potřebovat pro ruční evidenci).`,
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

