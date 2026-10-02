import "server-only";
import { and, asc, eq, gt, inArray, isNull, lte, desc, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { randomUUID } from "node:crypto";
import { EetMessageError, MockTransport, buildSale, eetSnapshot, retryDelaySeconds, type EetData, type Sale, type SendResult, type Transport } from "@ez/fiscal-core";
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
export async function storeCertificate(
  accountId: string,
  cert: LoadedCertificate,
  environment: "playground" | "production",
  opts: { setAccountEic?: string } = {},
) {
  const payload: Eet2Credential = {
    privateKeyPem: cert.privateKeyPem,
    certificatePem: cert.certificatePem,
    certificateDerBase64: cert.certificateDerBase64,
  };
  const sealed = await encryptSecret(encryptor(), Buffer.from(JSON.stringify(payload)), `cert:${accountId}`);
  const db = getDb();
  // výměna certifikátu je atomická: buď platí nový, nebo zůstává starý (R1.9)
  const id = await db.transaction(async (tx) => {
    // účet bez EIČ převezme EIČ z certifikátu – ve stejné transakci jako certifikát
    if (opts.setAccountEic) {
      await tx.update(schema.accounts).set({ eic: opts.setAccountEic }).where(and(eq(schema.accounts.id, accountId), isNull(schema.accounts.eic)));
    }
    await tx
      .update(schema.certificates)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.certificates.accountId, accountId), eq(schema.certificates.environment, environment), isNull(schema.certificates.revokedAt)));
    const [row] = await tx
      .insert(schema.certificates)
      .values({
        accountId,
        subject: cert.info.subject,
        eic: cert.info.dic,
        environment,
        serialNumber: cert.info.serialNumber,
        issuer: cert.info.issuer,
        validFrom: cert.info.validFrom,
        validTo: cert.info.validTo,
        storage: "server",
        encryptedKey: sealed.ciphertext,
        encryptedDek: sealed.encryptedDek,
        keyVersion: sealed.keyVersion,
      })
      .returning({ id: schema.certificates.id });
    return row!.id;
  });
  credentialCache.delete(`${accountId}:${environment}`);
  // tržby zablokované kvůli certifikátu se hned vrátí do fronty (R1.3)
  await requeueBlocked(accountId, CERT_BLOCKS, environment);
  if (opts.setAccountEic) await requeueBlocked(accountId, ACCOUNT_BLOCKS);
  return id;
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

type TransportFactory = (account: AccountRow, mode: EetMode) => Transport;
let testTransportFactory: TransportFactory | null = null;

/** Jen pro testy: podstrčí transport (skriptované odpovědi FS). */
export function __setTransportFactoryForTests(factory: TransportFactory | null): void {
  testTransportFactory = factory;
}

/** Transport podle režimu — u tržby VŽDY režim, ve kterém vznikla (ne aktuální režim účtu). */
export function transportFor(account: AccountRow, modeOverride?: string): Transport {
  const mode = modeOverride ? accountMode({ eetMode: modeOverride }) : accountMode(account);
  if (testTransportFactory) return testTransportFactory(account, mode);
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

/* ───────────── fronta ───────────── */

/** Důvody blokace kvůli certifikátu / klíči – zmizí s novým certifikátem. */
export const CERT_BLOCKS = ["CERT_MISSING", "CERT_EXPIRED", "CERT_NOT_YET_VALID", "PREPARE"] as const;
/** Důvody blokace kvůli údajům účtu – zmizí po opravě EIČ. */
export const ACCOUNT_BLOCKS = ["EIC_MISSING", "MESSAGE_INVALID", "ACCOUNT_MISSING"] as const;
/** Kolikrát po sobě smí přijít neověřitelná odpověď, než frontu tržby zastavíme (R1.8). */
const INVALID_STREAK_LIMIT = 3;
const BLOCKED_RETRY_MS = 3_600_000;
const STALE_CLAIM_MS = 120_000;

export const BLOCK_TEXT: Record<string, string> = {
  CERT_MISSING: "Chybí pokladní certifikát pro tento režim.",
  CERT_EXPIRED: "Pokladní certifikát vypršel – nahrajte nový z DIS+.",
  CERT_NOT_YET_VALID: "Pokladní certifikát ještě neplatí.",
  PREPARE: "Zprávu nelze podepsat (certifikát nebo klíč) – zkusíme to znovu za hodinu, případně nahrajte certifikát znovu.",
  EIC_MISSING: "U účtu chybí EIČ (DIČ).",
  MESSAGE_INVALID: "Údaje tržby neodpovídají formátu EET (EIČ, číslo jednotky, označení pokladny).",
  ACCOUNT_MISSING: "Účet neexistuje.",
  INVALID_RESPONSE: "Odpověď Finanční správy opakovaně nešla ověřit – odesílání je pozastavené, řešíme to.",
};

type Outcome = { result: "confirmed" | "rejected" | "retry" | "blocked" | "invalid"; send?: SendResult; code?: string; message?: string };

/**
 * Zapíše výsledek pokusu – jen pokud tržbu pořád drží tento pokus (claim token) a není potvrzená.
 * Pozdní výsledek „zaseknutého“ workeru tak nikdy nepřepíše potvrzenou tržbu (R1.4).
 */
async function applyOutcome(row: SaleRow, token: string, o: Outcome, now: Date): Promise<boolean> {
  const db = getDb();
  const mine = and(eq(schema.sales.id, row.id), eq(schema.sales.claimToken, token), eq(schema.sales.status, "sending"));
  const sent = o.send && o.result !== "blocked";
  const common = { claimToken: null, sentAt: now, ...(sent ? { firstSentAt: row.firstSentAt ?? now } : {}) };
  let updated: { id: string }[];
  if (o.result === "confirmed" && o.send?.ok) {
    updated = await db
      .update(schema.sales)
      .set({
        ...common,
        status: "confirmed",
        confirmationCode: o.send.confirmationCode,
        lastMessageUuid: o.send.messageUuid,
        warnings: o.send.warnings,
        lastError: null,
        blockedReason: null,
      })
      .where(mine)
      .returning({ id: schema.sales.id });
  } else if (o.result === "blocked") {
    updated = await db
      .update(schema.sales)
      .set({
        ...common,
        status: "queued",
        blockedReason: o.code ?? "BLOCKED",
        lastError: `${o.code}: ${o.message ?? BLOCK_TEXT[o.code ?? ""] ?? ""}`.slice(0, 1000),
        nextAttemptAt: new Date(now.getTime() + BLOCKED_RETRY_MS),
      })
      .where(mine)
      .returning({ id: schema.sales.id });
  } else {
    const f = o.send && !o.send.ok ? o.send : undefined;
    updated = await db
      .update(schema.sales)
      .set({
        ...common,
        status: o.result === "rejected" ? "rejected" : "queued",
        lastMessageUuid: f?.messageUuid ?? row.lastMessageUuid,
        lastError: `${o.code ?? f?.code}: ${o.message ?? f?.message ?? ""}`.slice(0, 1000),
        warnings: f?.warnings ?? row.warnings,
        nextAttemptAt: new Date(now.getTime() + retryDelaySeconds(row.attempts) * 1000),
      })
      .where(mine)
      .returning({ id: schema.sales.id });
  }
  return updated.length > 0;
}

async function recordAttempt(row: SaleRow, o: Outcome, startedAt: Date, applied: boolean, firstAttempt: boolean) {
  const s = o.send;
  await getDb()
    .insert(schema.saleAttempts)
    .values({
      saleId: row.id,
      attempt: row.attempts,
      environment: row.mode,
      messageUuid: s?.messageUuid ?? null,
      firstAttempt,
      startedAt,
      result: applied ? o.result : "stale",
      code: o.code ?? (s && !s.ok ? s.code : null),
      message: (o.message ?? (s && !s.ok ? s.message : null))?.slice(0, 1000) ?? null,
      pok: s?.ok ? s.confirmationCode : null,
      receivedAt: s?.ok && s.receivedAt ? new Date(s.receivedAt) : null,
      httpStatus: s?.audit?.httpStatus ?? null,
      requestSha256: s?.audit?.requestSha256 ?? null,
      responseBody: s?.audit?.responseBody ?? null,
    });
}

/** Aktivní certifikát prostředí: null = v pořádku, jinak důvod blokace. */
async function certificateBlock(accountId: string, environment: "playground" | "production", now: Date): Promise<string | null> {
  const cert = await getDb().query.certificates.findFirst({
    where: and(eq(schema.certificates.accountId, accountId), eq(schema.certificates.environment, environment), isNull(schema.certificates.revokedAt)),
    orderBy: desc(schema.certificates.createdAt),
  });
  if (!cert) return "CERT_MISSING";
  if (cert.validTo <= now) return "CERT_EXPIRED";
  if (cert.validFrom > now) return "CERT_NOT_YET_VALID";
  return null;
}

/**
 * Odešle jednu tržbu. Řádek se nejdřív atomicky „zabere“ (status sending + nový claim token),
 * takže souběžná volání (API + cron) nikdy neodešlou stejnou tržbu dvakrát najednou.
 */
export async function processSale(saleId: string, account?: AccountRow): Promise<SaleRow | null> {
  const db = getDb();
  const token = randomUUID();
  const startedAt = new Date();
  const [claimed] = await db
    .update(schema.sales)
    .set({ status: "sending", attempts: sql`${schema.sales.attempts} + 1`, sentAt: startedAt, claimToken: token })
    // jen tržba, jejíž backoff už uplynul – žádné volání nemůže frontu předběhnout (R1.8)
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.status, "queued"), lte(schema.sales.nextAttemptAt, startedAt)))
    .returning();
  if (!claimed) return (await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) })) ?? null;

  const acc = account?.id === claimed.accountId ? account : await db.query.accounts.findFirst({ where: eq(schema.accounts.id, claimed.accountId) });
  const mode = accountMode({ eetMode: claimed.mode });
  // prvni_zaslani = tržba ještě nikdy neodešla (zablokované pokusy se nepočítají)
  const firstAttempt = !claimed.firstSentAt;
  let outcome: Outcome;
  try {
    outcome = await attempt(claimed, acc, mode, firstAttempt, token);
  } catch (e) {
    outcome = { result: "retry", code: "INTERNAL", message: e instanceof Error ? e.message : String(e) };
  }
  const now = new Date();
  const applied = await applyOutcome(claimed, token, outcome, now);
  await recordAttempt(claimed, outcome, startedAt, applied, firstAttempt);
  if (applied && outcome.result === "invalid") await checkInvalidStreak(claimed);
  return (await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) })) ?? null;
}

async function attempt(row: SaleRow, acc: AccountRow | undefined, mode: EetMode, firstAttempt: boolean, token: string): Promise<Outcome> {
  if (!acc) return { result: "blocked", code: "ACCOUNT_MISSING" };
  const now = new Date();
  if (mode !== "mock") {
    const certBlock = await certificateBlock(acc.id, mode, now);
    if (certBlock) return { result: "blocked", code: certBlock };
  }
  // Snímek dat zprávy vzniká jednou, před prvním odesláním; opakování ho jen převezmou (Р4).
  let snapshot = (row.eetData as EetData | null) ?? undefined;
  if (!snapshot) {
    const eic = acc.eic ?? acc.dic;
    if (!eic) {
      if (mode !== "mock") return { result: "blocked", code: "EIC_MISSING" };
    } else {
      try {
        snapshot = eetSnapshot(rowToSale(row), { eic });
      } catch (e) {
        if (mode !== "mock") return { result: "blocked", code: "MESSAGE_INVALID", message: e instanceof EetMessageError ? e.issues.join(", ") : String(e) };
      }
      if (snapshot) await getDb().update(schema.sales).set({ eetData: snapshot }).where(and(eq(schema.sales.id, row.id), eq(schema.sales.claimToken, token)));
    }
  }
  const transport = transportFor(acc, mode);
  // Р3: tržba z Playgroundu nebo ostrého provozu nikdy neskončí v simulaci
  if (mode !== "mock" && transport.name === "mock") throw new Error(`Invariant: tržba v režimu ${mode} nesmí jít přes mock`);
  const result = await transport.send(rowToSale(row), { firstAttempt, verifyOnly: false, eic: snapshot?.eic_popl ?? acc.eic ?? acc.dic ?? "CZ00000000", snapshot });
  if (result.ok) return { result: "confirmed", send: result };
  if (result.blocked) return { result: "blocked", send: result, code: result.blocked, message: result.message };
  if (result.code === "INVALID_RESPONSE") return { result: "invalid", send: result };
  return { result: result.retryable ? "retry" : "rejected", send: result };
}

/** Po N neověřitelných odpovědích po sobě tržbu zastavíme a upozorníme provozovatele (R1.8). */
async function checkInvalidStreak(row: SaleRow) {
  const db = getDb();
  const last = await db
    .select({ result: schema.saleAttempts.result })
    .from(schema.saleAttempts)
    .where(eq(schema.saleAttempts.saleId, row.id))
    .orderBy(desc(schema.saleAttempts.attempt))
    .limit(INVALID_STREAK_LIMIT);
  if (last.length < INVALID_STREAK_LIMIT || last.some((a) => a.result !== "invalid")) return;
  await db
    .update(schema.sales)
    .set({ blockedReason: "INVALID_RESPONSE", nextAttemptAt: new Date(Date.now() + 365 * 86_400_000) })
    .where(and(eq(schema.sales.id, row.id), eq(schema.sales.status, "queued")));
  const { enqueueEmail } = await import("./mail");
  const { SITE } = await import("@/lib/site");
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    dedupeKey: `invalid-response:${new Date().toISOString().slice(0, 13)}`,
    payload: {
      subject: `⚠️ Neověřitelné odpovědi FS (${row.mode})`,
      text: `Tržba ${row.id} dostala ${INVALID_STREAK_LIMIT}× po sobě odpověď, kterou nešlo ověřit (podpis / certifikát FS). Odesílání této tržby je pozastavené. Syrové odpovědi jsou v tabulce sale_attempts. Zkontrolujte kotvy důvěry a podpisový certifikát FS.`,
    },
  });
}

/** Vrátí zablokované tržby do fronty (nový certifikát, opravené EIČ). */
export async function requeueBlocked(accountId: string, reasons: readonly string[], environment?: string): Promise<number> {
  const rows = await getDb()
    .update(schema.sales)
    .set({ blockedReason: null, nextAttemptAt: new Date() })
    .where(
      and(
        eq(schema.sales.accountId, accountId),
        eq(schema.sales.status, "queued"),
        inArray(schema.sales.blockedReason, [...reasons]),
        ...(environment ? [eq(schema.sales.mode, environment)] : []),
      ),
    )
    .returning({ id: schema.sales.id });
  return rows.length;
}

/** „Odeslat znovu“ od vlastníka: odmítnuté i zablokované tržby zpět do fronty. */
export async function requeueSales(accountId: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const rows = await getDb()
    .update(schema.sales)
    .set({ status: "queued", blockedReason: null, nextAttemptAt: new Date(), claimToken: null })
    .where(and(eq(schema.sales.accountId, accountId), inArray(schema.sales.id, ids), inArray(schema.sales.status, ["rejected", "queued", "failed"])))
    .returning({ id: schema.sales.id });
  return rows.length;
}

/** Tržby, které čekají na vlastníka: odmítnuté FS nebo zablokované (certifikát, EIČ…). */
export async function salesNeedingAttention(accountId: string) {
  return getDb()
    .select({
      id: schema.sales.id,
      status: schema.sales.status,
      blockedReason: schema.sales.blockedReason,
      lastError: schema.sales.lastError,
      sequence: schema.sales.sequence,
      registerId: schema.sales.registerId,
      soldAt: schema.sales.soldAt,
      total: schema.sales.total,
      mode: schema.sales.mode,
      deadlineAt: schema.sales.deadlineAt,
    })
    .from(schema.sales)
    .where(and(eq(schema.sales.accountId, accountId), sql`(${schema.sales.status} = 'rejected' OR ${schema.sales.blockedReason} IS NOT NULL)`))
    .orderBy(asc(schema.sales.soldAt))
    .limit(200);
}

/** Fronta pro cron: tržby čekající na (opakované) odeslání, s omezeným souběhem. */
export async function processPending(limit = 50, concurrency = 4): Promise<{ processed: number }> {
  const db = getDb();
  // uvolní zaseknuté "sending" (pád procesu uprostřed odeslání); jejich claim token propadne
  await db
    .update(schema.sales)
    .set({ status: "queued", claimToken: null })
    .where(and(eq(schema.sales.status, "sending"), lte(schema.sales.sentAt, new Date(Date.now() - STALE_CLAIM_MS))));
  const due = await db
    .select({ id: schema.sales.id })
    .from(schema.sales)
    .where(and(eq(schema.sales.status, "queued"), lte(schema.sales.nextAttemptAt, new Date())))
    .orderBy(asc(schema.sales.nextAttemptAt))
    .limit(limit);
  let processed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, due.length) }, async () => {
      while (next < due.length) {
        const { id } = due[next++]!;
        await processSale(id);
        processed++;
      }
    }),
  );
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
