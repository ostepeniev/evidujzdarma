import "server-only";
import { and, asc, eq, gt, inArray, isNull, lte, desc, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { MockTransport, buildSale, retryDelaySeconds, type Sale, type SendResult, type Transport } from "@ez/fiscal-core";
import {
  Eet2Transport,
  LocalKeyEncryptor,
  decryptSecret,
  encryptSecret,
  type Eet2Credential,
  type LoadedCertificate,
} from "@ez/fiscal-core/server";

type AccountRow = typeof schema.accounts.$inferSelect;
type SaleRow = typeof schema.sales.$inferSelect;

export type EetMode = "mock" | "playground" | "production";

export function accountMode(a: Pick<AccountRow, "eetMode">): EetMode {
  return a.eetMode === "playground" || a.eetMode === "production" ? a.eetMode : "mock";
}

/* ───────────── certifikáty ───────────── */

function encryptor(): LocalKeyEncryptor {
  return LocalKeyEncryptor.fromEnv();
}

/** Uloží certifikát šifrovaně (privátní klíč nikdy neopustí server v otevřené podobě). */
export async function storeCertificate(accountId: string, cert: LoadedCertificate, environment: "playground" | "production") {
  const payload: Eet2Credential = {
    privateKeyPem: cert.privateKeyPem,
    certificatePem: cert.certificatePem,
    certificateDerBase64: cert.certificateDerBase64,
  };
  const sealed = await encryptSecret(encryptor(), Buffer.from(JSON.stringify(payload)), `cert:${accountId}`);
  const db = getDb();
  // starší certifikáty stejného prostředí odvoláme
  await db
    .update(schema.certificates)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.certificates.accountId, accountId), eq(schema.certificates.environment, environment), isNull(schema.certificates.revokedAt)));
  const [row] = await db
    .insert(schema.certificates)
    .values({
      accountId,
      subject: cert.info.subject,
      eic: cert.info.dic,
      environment,
      serialNumber: cert.info.serialNumber,
      validFrom: cert.info.validFrom,
      validTo: cert.info.validTo,
      storage: "server",
      encryptedKey: sealed.ciphertext,
      encryptedDek: sealed.encryptedDek,
      keyVersion: sealed.keyVersion,
    })
    .returning({ id: schema.certificates.id });
  credentialCache.delete(`${accountId}:${environment}`);
  return row!.id;
}

const credentialCache = new Map<string, { at: number; value: Eet2Credential }>();
const CREDENTIAL_TTL = 5 * 60_000;

export async function loadCredential(accountId: string, environment: "playground" | "production"): Promise<Eet2Credential> {
  const key = `${accountId}:${environment}`;
  const hit = credentialCache.get(key);
  if (hit && Date.now() - hit.at < CREDENTIAL_TTL) return hit.value;
  const row = await getDb().query.certificates.findFirst({
    where: and(
      eq(schema.certificates.accountId, accountId),
      eq(schema.certificates.environment, environment),
      isNull(schema.certificates.revokedAt),
      gt(schema.certificates.validTo, new Date()),
    ),
    orderBy: desc(schema.certificates.createdAt),
  });
  if (!row?.encryptedKey || !row.encryptedDek || !row.keyVersion) throw new Error("Chybí platný pokladní certifikát");
  const plain = await decryptSecret(encryptor(), { ciphertext: row.encryptedKey, encryptedDek: row.encryptedDek, keyVersion: row.keyVersion }, `cert:${accountId}`);
  const value = JSON.parse(plain.toString("utf8")) as Eet2Credential;
  plain.fill(0);
  credentialCache.set(key, { at: Date.now(), value });
  return value;
}

/** Transport podle režimu — u tržby VŽDY režim, ve kterém vznikla (ne aktuální režim účtu). */
export function transportFor(account: AccountRow, modeOverride?: string): Transport {
  const mode = modeOverride ? accountMode({ eetMode: modeOverride }) : accountMode(account);
  if (mode === "mock") return new MockTransport({ latencyMs: 150 });
  return new Eet2Transport({
    environment: mode,
    credential: () => loadCredential(account.id, mode),
    timeoutMs: Number(process.env.EET_TIMEOUT_MS ?? 10_000),
  });
}

/* ───────────── odeslání tržby ───────────── */

function rowToSale(row: SaleRow): Sale {
  return buildSale({
    id: row.id,
    deviceId: row.deviceId,
    registerId: row.registerId,
    unitId: String(row.fsUnitId),
    sequence: row.sequence,
    soldAt: row.soldAt.toISOString(),
    lines: row.items ?? [],
    payments: row.payments as Sale["payments"],
    discount: 0, // položky jsou uložené už po slevě
    tip: row.tip,
    refundOf: row.refundOf,
    vatPayer: !!row.vatBreakdown,
    mode: row.mode === "production" ? "production" : "test",
  });
}

/** `row.attempts` = počet pokusů VČETNĚ právě dokončeného. */
async function applyResult(row: SaleRow, result: SendResult, now: Date) {
  const db = getDb();
  if (result.ok) {
    await db
      .update(schema.sales)
      .set({
        status: "confirmed",
        confirmationCode: result.confirmationCode,
        lastMessageUuid: result.messageUuid,
        warnings: result.warnings,
        lastError: null,
        sentAt: now,
        firstSentAt: row.firstSentAt ?? now,
      })
      .where(eq(schema.sales.id, row.id));
    return;
  }
  await db
    .update(schema.sales)
    .set({
      status: result.retryable ? "queued" : "rejected",
      lastMessageUuid: result.messageUuid ?? row.lastMessageUuid,
      lastError: `${result.code}: ${result.message}`.slice(0, 1000),
      warnings: result.warnings ?? row.warnings,
      sentAt: now,
      firstSentAt: row.firstSentAt ?? now,
      nextAttemptAt: new Date(now.getTime() + retryDelaySeconds(row.attempts) * 1000),
    })
    .where(eq(schema.sales.id, row.id));
}

/**
 * Odešle jednu tržbu. Řádek se nejdřív atomicky "zabere" (status sending), takže
 * souběžné volání (API + cron) nikdy neodešle stejnou tržbu dvakrát najednou.
 */
export async function processSale(saleId: string, account?: AccountRow): Promise<SaleRow | null> {
  const db = getDb();
  const [claimed] = await db
    .update(schema.sales)
    .set({ status: "sending", attempts: sql`${schema.sales.attempts} + 1`, sentAt: new Date() })
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.status, "queued")))
    .returning();
  if (!claimed) return (await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) })) ?? null;

  const acc = account ?? (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, claimed.accountId) }));
  const now = new Date();
  // "attempts" už je navýšené; firstAttempt = jde o úplně první pokus
  const firstAttempt = claimed.attempts === 1 && !claimed.firstSentAt;
  let result: SendResult;
  try {
    if (!acc) throw new Error("Účet neexistuje");
    const eic = acc.eic ?? acc.dic;
    if (!eic) throw new Error("U účtu chybí EIČ (DIČ) pro evidenci");
    result = await transportFor(acc, claimed.mode).send(rowToSale(claimed), { firstAttempt, verifyOnly: false, eic });
  } catch (e) {
    result = { ok: false, retryable: true, code: "INTERNAL", message: e instanceof Error ? e.message : String(e) };
  }
  await applyResult(claimed, result, now);
  return (await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) })) ?? null;
}

/** Fronta pro cron: tržby čekající na (opakované) odeslání. */
export async function processPending(limit = 50): Promise<{ processed: number }> {
  const db = getDb();
  // uvolní zaseknuté "sending" starší než 2 minuty (pád procesu uprostřed odeslání)
  await db
    .update(schema.sales)
    .set({ status: "queued" })
    .where(and(eq(schema.sales.status, "sending"), lte(schema.sales.sentAt, new Date(Date.now() - 120_000))));
  const due = await db
    .select({ id: schema.sales.id })
    .from(schema.sales)
    .where(and(eq(schema.sales.status, "queued"), lte(schema.sales.nextAttemptAt, new Date())))
    .orderBy(asc(schema.sales.nextAttemptAt))
    .limit(limit);
  let processed = 0;
  for (const { id } of due) {
    await processSale(id);
    processed++;
  }
  return { processed };
}

export async function salesStatus(ids: string[], accountId: string) {
  if (!ids.length) return [];
  return getDb()
    .select({
      id: schema.sales.id,
      status: schema.sales.status,
      confirmationCode: schema.sales.confirmationCode,
      lastError: schema.sales.lastError,
      warnings: schema.sales.warnings,
      mode: schema.sales.mode,
    })
    .from(schema.sales)
    .where(and(eq(schema.sales.accountId, accountId), inArray(schema.sales.id, ids)));
}
