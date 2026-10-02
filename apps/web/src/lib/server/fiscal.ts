import "server-only";
import { and, asc, eq, gt, gte, inArray, isNull, like, lte, desc, ne, notInArray, or, sql } from "drizzle-orm";
import { getDb, schema, type Db } from "@ez/db";
import { createHash, randomUUID } from "node:crypto";
import { safeError } from "./log";
import { EetMessageError, MockTransport, buildSale, chybaHint, eetSnapshot, retryDelaySeconds, type EetData, type Sale, type SendResult, type Transport } from "@ez/fiscal-core";
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

/** Režim tržby – přesně, bez náhradního „mock“: neznámý (starý „test“) se neodesílá (Д-9). */
function saleMode(mode: string): EetMode | null {
  return mode === "mock" || mode === "playground" || mode === "production" ? mode : null;
}

/** Časový limit jednoho odeslání do FS: 1–30 s, jinak 10 s (Д-3). Musí být kratší než STALE_CLAIM_MS. */
export function eetTimeoutMs(): number {
  const n = Number(process.env.EET_TIMEOUT_MS);
  if (!process.env.EET_TIMEOUT_MS || !Number.isFinite(n) || n <= 0) return 10_000;
  return Math.min(Math.max(Math.round(n), 1_000), 30_000);
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
  const sealed = await encryptSecret(encryptor(), Buffer.from(JSON.stringify(payload)), certContext(accountId, environment));
  const db = getDb();
  // výměna certifikátu je atomická: buď platí nový, nebo zůstává starý (R1.9)
  const id = await db.transaction(async (tx) => {
    // souběžné importy téhož účtu se seřadí (zámek řádku účtu); unikátní index je druhá pojistka (Д-4)
    await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.id, accountId)).for("update");
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
        aadVersion: 2,
      })
      .returning({ id: schema.certificates.id });
    // tržby zablokované kvůli certifikátu se vrátí do fronty ve stejné transakci (R1.3, Д-4)
    await requeueBlocked(accountId, CERT_BLOCKS, environment, tx);
    if (opts.setAccountEic) await requeueBlocked(accountId, ACCOUNT_BLOCKS, undefined, tx);
    return row!.id;
  });
  credentialCache.delete(`${accountId}:${environment}`);
  return id;
}

/**
 * AAD šifrovaného klíče (aad_version 2): účet + prostředí – klíč nejde přesunout do řádku jiného účtu
 * ani prostředí (A Дрібне 3). Starší záznamy (aad_version 1) mají AAD jen s účtem.
 */
function certContext(accountId: string, environment: string): string {
  return `cert:${accountId}:${environment}`;
}

const credentialCache = new Map<string, { at: number; value: Eet2Credential }>();
const CREDENTIAL_TTL = 5 * 60_000;

/** Zahodí dešifrované klíče účtu z paměti (odstranění certifikátu, zrušení účtu). */
export function forgetCredential(accountId: string): void {
  for (const env of ["playground", "production"]) credentialCache.delete(`${accountId}:${env}`);
}

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
  const sealed = { ciphertext: row.encryptedKey, encryptedDek: row.encryptedDek, keyVersion: row.keyVersion };
  const plain = await decryptSecret(encryptor(), sealed, row.aadVersion >= 2 ? certContext(accountId, environment) : `cert:${accountId}`);
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
    timeoutMs: eetTimeoutMs(),
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
export const CERT_BLOCKS = ["CERT_MISSING", "CERT_EXPIRED", "CERT_NOT_YET_VALID", "CERT_NOT_VERIFIED", "PREPARE"] as const;
/** Důvody blokace kvůli údajům účtu – zmizí po opravě EIČ. */
export const ACCOUNT_BLOCKS = ["EIC_MISSING", "MESSAGE_INVALID", "ACCOUNT_MISSING", "EIC_CERT_MISMATCH"] as const;
/** Po kolika neověřitelných odpovědích po sobě se tržba označí a provozovatel dostane alert (R1.8). */
const INVALID_STREAK_LIMIT = 3;
/** Neověřitelná odpověď: backoff 5 min × 4^(n−1), nejvýš 6 h – tržba zůstává ve frontě (R5.4). */
const INVALID_MAX_DELAY_MS = 6 * 3_600_000;
/** Pojistka prostředí (R5.4): ≥ 3 INVALID od ≥ 3 účtů za 10 min → pauza; zkušební tržba jednou za hodinu. */
const BREAKER = { windowMs: 10 * 60_000, minInvalid: 3, minAccounts: 3, probeMs: 3_600_000 } as const;
const BLOCKED_RETRY_MS = 3_600_000;
/** Kód 8 („technická chyba nebo chyba dat“): nejvýš 3 pokusy po 20 min, pak odmítnuto (R5.3). */
const AMBIGUOUS_MAX_ATTEMPTS = 3;
const AMBIGUOUS_RETRY_MS = 20 * 60_000;
const STALE_CLAIM_MS = 120_000;

export const BLOCK_TEXT: Record<string, string> = {
  CERT_MISSING: "Chybí pokladní certifikát pro tento režim.",
  CERT_EXPIRED: "Pokladní certifikát vypršel – nahrajte nový z DIS+.",
  CERT_NOT_YET_VALID: "Pokladní certifikát ještě neplatí.",
  CERT_NOT_VERIFIED: "Nový ostrý certifikát ještě není ověřený – v nastavení použijte „Odeslat ověřovací tržbu“. Tržby čekají a pak se odešlou samy.",
  PREPARE: "Zprávu nelze podepsat (certifikát nebo klíč) – zkusíme to znovu za hodinu, případně nahrajte certifikát znovu.",
  EIC_MISSING: "U účtu chybí EIČ (DIČ).",
  MESSAGE_INVALID: "Údaje tržby neodpovídají formátu EET (EIČ, číslo jednotky, označení pokladny).",
  ACCOUNT_MISSING: "Účet neexistuje.",
  EIC_CERT_MISMATCH: "EIČ účtu neodpovídá pokladnímu certifikátu – opravte EIČ v nastavení (musí být stejné jako v certifikátu).",
  INVALID_RESPONSE: "Odpověď Finanční správy opakovaně nešla ověřit – tržbu zkoušíme dál s delším odstupem a řešíme to.",
  MODE_UNKNOWN: "Tržba nemá platný režim (ukázkový / Playground / ostrý) – neodesílá se. Ozvěte se nám, vyřešíme to.",
  SALE_INVALID: "Uloženou tržbu teď nejde zpracovat (chyba na naší straně) – je uložená, řešíme to a odešle se sama.",
};

type Outcome = { result: "confirmed" | "rejected" | "retry" | "blocked" | "invalid"; send?: SendResult; code?: string; message?: string; retryInMs?: number };

/**
 * Zapíše výsledek pokusu – jen pokud tržbu pořád drží tento pokus (claim token) a není potvrzená.
 * Pozdní výsledek „zaseknutého“ workeru tak nikdy nepřepíše potvrzenou tržbu (R1.4).
 */
async function applyOutcome(row: SaleRow, token: string, o: Outcome, now: Date): Promise<boolean> {
  const db = getDb();
  const mine = and(eq(schema.sales.id, row.id), eq(schema.sales.claimToken, token), eq(schema.sales.status, "sending"));
  const sent = o.send && o.result !== "blocked";
  // first_sent_at mohl nastavit už audit před POST (Д-2) – nepřepisovat
  const firstSentAt = sql`coalesce(${schema.sales.firstSentAt}, ${now.toISOString()}::timestamptz)`;
  const common = { claimToken: null, sentAt: now, ...(sent ? { firstSentAt } : {}) };
  let updated: { id: string }[];
  if (o.result === "confirmed" && o.send?.ok) {
    const confirmed = {
      ...common,
      status: "confirmed" as const,
      confirmationCode: o.send.confirmationCode,
      lastMessageUuid: o.send.messageUuid,
      warnings: o.send.warnings,
      lastError: null,
      blockedReason: null,
    };
    updated = await db.update(schema.sales).set(confirmed).where(mine).returning({ id: schema.sales.id });
    // Pozdní ověřený POK (claim mezitím propadl): FS tržbu přijala – použijeme ho, jinak by šla do FS znovu (Д-3).
    // Potvrzenou tržbu nepřepisuje; případný souběžný pokus pak skončí jako „stale“.
    if (!updated.length) {
      updated = await db
        .update(schema.sales)
        .set({ ...confirmed, firstSentAt })
        .where(and(eq(schema.sales.id, row.id), ne(schema.sales.status, "confirmed")))
        .returning({ id: schema.sales.id });
    }
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
        nextAttemptAt: new Date(now.getTime() + (o.retryInMs ?? retryDelaySeconds(row.attempts) * 1000)),
      })
      .where(mine)
      .returning({ id: schema.sales.id });
  }
  return updated.length > 0;
}

/** Zapíše výsledek pokusu; byl-li před odesláním založen řádek `in_flight` (Д-2), aktualizuje ho. */
async function recordAttempt(row: SaleRow, o: Outcome, startedAt: Date, applied: boolean, firstAttempt: boolean, inFlightId: number | null) {
  const s = o.send;
  const values = {
    saleId: row.id,
    attempt: row.attempts,
    environment: row.mode,
    messageUuid: s?.messageUuid ?? null,
    firstAttempt,
    startedAt,
    finishedAt: new Date(),
    result: applied ? o.result : "stale",
    code: (o.code ?? (s && !s.ok ? s.code : null))?.slice(0, 32) ?? null,
    message: (o.message ?? (s && !s.ok ? s.message : null))?.slice(0, 1000) ?? null,
    pok: s?.ok ? s.confirmationCode : null,
    receivedAt: s?.ok && s.receivedAt ? new Date(s.receivedAt) : null,
    httpStatus: s?.audit?.httpStatus ?? null,
    requestSha256: s?.audit?.requestSha256 ?? null,
    responseBody: s?.audit?.responseBody ?? null,
  };
  const db = getDb();
  if (inFlightId !== null) {
    const { messageUuid, requestSha256, ...rest } = values;
    const done = await db
      .update(schema.saleAttempts)
      .set({ ...rest, ...(messageUuid ? { messageUuid } : {}), ...(requestSha256 ? { requestSha256 } : {}) })
      .where(eq(schema.saleAttempts.id, inFlightId))
      .returning({ id: schema.saleAttempts.id });
    if (done.length) return;
  }
  await db.insert(schema.saleAttempts).values(values);
}

/** Aktivní certifikát prostředí. */
function activeCertificate(accountId: string, environment: string) {
  return getDb().query.certificates.findFirst({
    where: and(eq(schema.certificates.accountId, accountId), eq(schema.certificates.environment, environment), isNull(schema.certificates.revokedAt)),
    orderBy: desc(schema.certificates.createdAt),
  });
}

/** Aktivní certifikát prostředí: null = v pořádku, jinak důvod blokace; vrací i EIČ z certifikátu. */
async function certificateBlock(accountId: string, environment: "playground" | "production", now: Date): Promise<{ block: string | null; eic: string | null }> {
  const cert = await activeCertificate(accountId, environment);
  if (!cert) return { block: "CERT_MISSING", eic: null };
  if (cert.validTo <= now) return { block: "CERT_EXPIRED", eic: cert.eic };
  if (cert.validFrom > now) return { block: "CERT_NOT_YET_VALID", eic: cert.eic };
  // ostré tržby obslouží jen ověřený certifikát – i po výměně v už zapnutém ostrém provozu (Д-6)
  if (environment === "production" && !cert.verifiedAt) return { block: "CERT_NOT_VERIFIED", eic: cert.eic };
  return { block: null, eic: cert.eic };
}

/** Změnil se certifikát prostředí (nový nebo právě ověřený) od začátku pokusu? */
async function certificateChangedSince(accountId: string, environment: string, since: Date): Promise<boolean> {
  const cert = await activeCertificate(accountId, environment);
  return !!cert && (cert.createdAt >= since || (!!cert.verifiedAt && cert.verifiedAt >= since));
}

/**
 * Odešle jednu tržbu. Řádek se nejdřív atomicky „zabere“ (status sending + nový claim token),
 * takže souběžná volání (API + cron) nikdy neodešlou stejnou tržbu dvakrát najednou.
 */
export async function processSale(saleId: string, account?: AccountRow): Promise<SaleRow | null> {
  const db = getDb();
  // pojistka prostředí (R5.4): při pauze tržbu nezabíráme, nic se nezapočítá ani neodešle
  const pre = await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId), columns: { mode: true, status: true } });
  if (!pre) return null;
  const gate = pre.status === "queued" ? await breakerGate(pre.mode) : "open";
  if (gate === "paused") return (await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) })) ?? null;
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
  const mode = saleMode(claimed.mode);
  // prvni_zaslani = tržba ještě nikdy neodešla (zablokované pokusy se nepočítají)
  const firstAttempt = !claimed.firstSentAt;
  // Д-2: těsně před POST se založí audit `in_flight` s uuid zprávy a nastaví first_sent_at –
  // pád procesu mezi odesláním a zápisem výsledku tak uuid neztratí a další pokus půjde s prvni_zaslani=false
  let inFlightId: number | null = null;
  const onPrepared = async (p: { messageUuid: string; sha256: string }) => {
    const [a] = await db
      .insert(schema.saleAttempts)
      .values({ saleId: claimed.id, attempt: claimed.attempts, environment: claimed.mode, messageUuid: p.messageUuid, requestSha256: p.sha256, firstAttempt, startedAt, result: "in_flight" })
      .returning({ id: schema.saleAttempts.id });
    inFlightId = a!.id;
    await db
      .update(schema.sales)
      .set({ firstSentAt: sql`coalesce(${schema.sales.firstSentAt}, now())` })
      .where(and(eq(schema.sales.id, claimed.id), eq(schema.sales.claimToken, token)));
  };
  let outcome: Outcome;
  try {
    outcome = mode ? await attempt(claimed, acc, mode, firstAttempt, token, onPrepared) : { result: "blocked", code: "MODE_UNKNOWN", message: `režim „${claimed.mode}“` };
  } catch (e) {
    // do last_error (vidí ho vlastník) jen bezpečný popis – bez SQL a jeho parametrů
    outcome = { result: "retry", code: "INTERNAL", message: safeError(e).message };
  }
  // blok kvůli certifikátu, který se mezitím vyměnil (requeue nového certifikátu tržbu v „sending“ minul):
  // zkusit hned znovu, ne za hodinu (Д-4)
  if (outcome.result === "blocked" && mode && mode !== "mock" && (CERT_BLOCKS as readonly string[]).includes(outcome.code ?? "") && (await certificateChangedSince(claimed.accountId, mode, startedAt))) {
    outcome = { result: "retry", code: outcome.code, message: "Certifikát se během pokusu změnil – zkusíme to hned znovu.", retryInMs: 0 };
  }
  const now = new Date();
  const applied = await applyOutcome(claimed, token, outcome, now);
  await recordAttempt(claimed, outcome, startedAt, applied, firstAttempt, inFlightId);
  if (applied && outcome.result === "invalid") {
    await checkInvalidStreak(claimed);
    await maybeTripBreaker(claimed.mode);
  }
  // potvrzená zkušební tržba = podpis FS jde zase ověřit → pojistka se ruší
  if (gate === "probe" && applied && outcome.result === "confirmed") await db.delete(schema.fsBreaker).where(eq(schema.fsBreaker.environment, claimed.mode));
  return (await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) })) ?? null;
}

async function attempt(
  row: SaleRow,
  acc: AccountRow | undefined,
  mode: EetMode,
  firstAttempt: boolean,
  token: string,
  onPrepared: (p: { messageUuid: string; sha256: string }) => Promise<void>,
): Promise<Outcome> {
  if (!acc) return { result: "blocked", code: "ACCOUNT_MISSING" };
  const now = new Date();
  let certEic: string | null = null;
  if (mode !== "mock") {
    const cert = await certificateBlock(acc.id, mode, now);
    if (cert.block) return { result: "blocked", code: cert.block };
    certEic = cert.eic;
  }
  // Řádek, ze kterého nová verze aplikace už tržbu nesestaví, musí být vidět, ne tichý INTERNAL (Д-11).
  let sale: Sale;
  try {
    sale = rowToSale(row);
  } catch (e) {
    await alertSaleInvalid(row, e);
    return { result: "blocked", code: "SALE_INVALID", message: e instanceof EetMessageError ? e.issues.join(", ") : safeError(e).message };
  }
  // Snímek dat zprávy vzniká jednou, před prvním odesláním; opakování ho jen převezmou (Р4).
  let snapshot = (row.eetData as EetData | null) ?? undefined;
  if (!snapshot) {
    const eic = acc.eic ?? acc.dic;
    if (!eic) {
      if (mode !== "mock") return { result: "blocked", code: "EIC_MISSING" };
    } else if (mode !== "mock" && certEic && eic !== certEic) {
      // snímek s EIČ, které nenese certifikát, by FS odmítla a už by nešel opravit (R5.6)
      return { result: "blocked", code: "EIC_CERT_MISMATCH", message: `EIČ účtu ${eic}, certifikát ${certEic}` };
    } else {
      try {
        snapshot = eetSnapshot(sale, { eic });
      } catch (e) {
        if (mode !== "mock") return { result: "blocked", code: "MESSAGE_INVALID", message: e instanceof EetMessageError ? e.issues.join(", ") : String(e) };
      }
      if (snapshot) await getDb().update(schema.sales).set({ eetData: snapshot }).where(and(eq(schema.sales.id, row.id), eq(schema.sales.claimToken, token)));
    }
  }
  const transport = transportFor(acc, mode);
  // Р3: tržba z Playgroundu nebo ostrého provozu nikdy neskončí v simulaci
  if (mode !== "mock" && transport.name === "mock") throw new Error(`Invariant: tržba v režimu ${mode} nesmí jít přes mock`);
  const result = await transport.send(sale, { firstAttempt, verifyOnly: false, eic: snapshot?.eic_popl ?? acc.eic ?? acc.dic ?? "CZ00000000", snapshot, onPrepared });
  if (result.ok) return { result: "confirmed", send: result };
  if (result.blocked) return { result: "blocked", send: result, code: result.blocked, message: result.message };
  if (result.code === "INVALID_RESPONSE") return { result: "invalid", send: result, retryInMs: invalidDelayMs((await invalidStreak(row.id)) + 1) };
  return chybaOutcome(row, result);
}

/** Výsledek podle třídy kódu Chyba (Popis v1.2, 3.5.4; R5.3). Bez třídy (síť, HTTP) rozhoduje `retryable`. */
async function chybaOutcome(row: SaleRow, result: Extract<SendResult, { ok: false }>): Promise<Outcome> {
  const kod = Number(result.code.replace(/^EET_/, ""));
  const explained = `${result.message} – ${chybaHint(kod)}`;
  switch (result.errorClass) {
    case "ambiguous": {
      // počítají se jen pokusy této série; odmítnutí (a následné „Odeslat znovu“ vlastníka) začíná novou
      const recent = await getDb()
        .select({ code: schema.saleAttempts.code, result: schema.saleAttempts.result })
        .from(schema.saleAttempts)
        .where(and(eq(schema.saleAttempts.saleId, row.id), ne(schema.saleAttempts.result, "in_flight")))
        .orderBy(desc(schema.saleAttempts.startedAt))
        .limit(AMBIGUOUS_MAX_ATTEMPTS);
      let prior = 0;
      for (const a of recent) {
        if (a.code !== result.code || a.result !== "retry") break;
        prior++;
      }
      if (prior + 1 >= AMBIGUOUS_MAX_ATTEMPTS) return { result: "rejected", send: result, message: `${explained} (${AMBIGUOUS_MAX_ATTEMPTS}× za sebou)` };
      return { result: "retry", send: result, retryInMs: AMBIGUOUS_RETRY_MS };
    }
    case "permanent":
      return { result: "rejected", send: result, message: explained };
    case "unexpected":
      await alertUnexpectedChyba(row, result);
      return { result: "rejected", send: result, message: explained };
    default:
      return { result: result.retryable ? "retry" : "rejected", send: result };
  }
}

/** Neznámý / rezervovaný kód Chyba: tržba se odmítne a provozovatel se to dozví (ne tiše). */
async function alertUnexpectedChyba(row: SaleRow, result: Extract<SendResult, { ok: false }>) {
  const { enqueueEmail } = await import("./mail");
  const { SITE } = await import("@/lib/site");
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    dedupeKey: `unexpected-chyba:${result.code}:${new Date().toISOString().slice(0, 13)}`,
    payload: {
      subject: `⚠️ Neočekávaný kód odpovědi FS ${result.code} (${row.mode})`,
      text: `Tržba ${row.id} dostala od Finanční správy kód ${result.code}, který podle Popisu datového rozhraní v1.2 (kap. 3.5.4) neočekáváme: „${result.message}“. Tržba je odmítnutá a vlastník ji vidí v „Tržby k vyřízení“. Syrová odpověď je v sale_attempts.`,
    },
  });
}

/** Uložená tržba neprošla buildSale (přísnější validace v novém deployi): provozovatel to musí vědět. */
async function alertSaleInvalid(row: SaleRow, e: unknown) {
  const { enqueueEmail } = await import("./mail");
  const { SITE } = await import("@/lib/site");
  const detail = e instanceof EetMessageError ? e.issues.join(", ") : safeError(e).message;
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    dedupeKey: `sale-invalid:${new Date().toISOString().slice(0, 13)}`,
    payload: {
      subject: `⚠️ Uloženou tržbu nejde sestavit (${row.mode})`,
      text: `Tržba ${row.id} je ve frontě, ale buildSale ji odmítá: ${detail}. Je zablokovaná (SALE_INVALID), vlastník ji vidí v „Tržby k vyřízení“ a fronta ji zkouší jednou za hodinu. Pravděpodobně přísnější validace v novém deployi – opravte kód, tržba se pak odešle se svým snímkem.`,
    },
  });
}

/** Počet neověřitelných odpovědí po sobě u tržby (bez právě probíhajícího pokusu). */
async function invalidStreak(saleId: string): Promise<number> {
  const last = await getDb()
    .select({ result: schema.saleAttempts.result })
    .from(schema.saleAttempts)
    .where(and(eq(schema.saleAttempts.saleId, saleId), ne(schema.saleAttempts.result, "in_flight")))
    .orderBy(desc(schema.saleAttempts.startedAt))
    .limit(10);
  let n = 0;
  for (const a of last) {
    if (a.result !== "invalid") break;
    n++;
  }
  return n;
}

export function invalidDelayMs(streak: number): number {
  return Math.min(INVALID_MAX_DELAY_MS, 5 * 60_000 * 4 ** Math.max(0, streak - 1));
}

/**
 * Po N neověřitelných odpovědích po sobě tržbu označíme (vlastník ji vidí) a upozorníme provozovatele.
 * Tržba zůstává ve frontě s backoffem do 6 h – opakování je bezpečné, FS ji ztotožní podle šesti polí (R5.4).
 */
async function checkInvalidStreak(row: SaleRow) {
  const db = getDb();
  if ((await invalidStreak(row.id)) < INVALID_STREAK_LIMIT) return;
  await db
    .update(schema.sales)
    .set({ blockedReason: "INVALID_RESPONSE" })
    .where(and(eq(schema.sales.id, row.id), eq(schema.sales.status, "queued")));
  const { enqueueEmail } = await import("./mail");
  const { SITE } = await import("@/lib/site");
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    dedupeKey: `invalid-response:${new Date().toISOString().slice(0, 13)}`,
    payload: {
      subject: `⚠️ Neověřitelné odpovědi FS (${row.mode})`,
      text: `Tržba ${row.id} dostala ${INVALID_STREAK_LIMIT}× po sobě odpověď, kterou nešlo ověřit (podpis / certifikát FS). Zkoušíme ji dál s odstupem až 6 h. Syrové odpovědi jsou v tabulce sale_attempts. Zkontrolujte kotvy důvěry a podpisový certifikát FS.`,
    },
  });
}

/* ───────────── pojistka prostředí (R5.4) ───────────── */

/**
 * Smí se teď odesílat do prostředí? „probe“ = pojistka je zapnutá, ale je čas na jednu zkušební tržbu
 * (slot se bere atomicky, takže ji dostane jen jeden souběžný pokus).
 */
async function breakerGate(environment: string, now = new Date()): Promise<"open" | "probe" | "paused"> {
  if (environment !== "playground" && environment !== "production") return "open";
  const db = getDb();
  const row = await db.query.fsBreaker.findFirst({ where: eq(schema.fsBreaker.environment, environment) });
  if (!row) return "open";
  const [probe] = await db
    .update(schema.fsBreaker)
    .set({ probeAt: new Date(now.getTime() + BREAKER.probeMs) })
    .where(and(eq(schema.fsBreaker.environment, environment), lte(schema.fsBreaker.probeAt, now)))
    .returning({ environment: schema.fsBreaker.environment });
  return probe ? "probe" : "paused";
}

/** Neověřitelné odpovědi od více účtů najednou = problém prostředí (kotvy, podpis FS), ne jedné tržby. */
async function maybeTripBreaker(environment: string) {
  if (environment !== "playground" && environment !== "production") return;
  const db = getDb();
  const [st] = await db
    .select({ invalid: sql<number>`count(*)::int`, accounts: sql<number>`count(distinct ${schema.sales.accountId})::int` })
    .from(schema.saleAttempts)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleAttempts.saleId))
    .where(and(eq(schema.saleAttempts.environment, environment), eq(schema.saleAttempts.result, "invalid"), gte(schema.saleAttempts.startedAt, new Date(Date.now() - BREAKER.windowMs))));
  if (!st || st.invalid < BREAKER.minInvalid || st.accounts < BREAKER.minAccounts) return;
  const [tripped] = await db
    .insert(schema.fsBreaker)
    .values({ environment, probeAt: new Date(Date.now() + BREAKER.probeMs), invalidCount: st.invalid, accountCount: st.accounts })
    .onConflictDoNothing()
    .returning();
  if (!tripped) return;
  const { enqueueEmail } = await import("./mail");
  const { SITE } = await import("@/lib/site");
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    dedupeKey: `fs-breaker:${environment}:${tripped.pausedAt.toISOString()}`,
    payload: {
      subject: `🛑 Odesílání do FS (${environment}) pozastaveno – neověřitelné odpovědi`,
      text:
        `Za posledních 10 minut přišlo ${st.invalid} odpovědí FS, které nešly ověřit, od ${st.accounts} účtů. Odesílání do prostředí ${environment} je pozastavené; ` +
        `jednou za hodinu projde jedna zkušební tržba a potvrzená pojistku zruší. Tržby zůstávají ve frontě. Syrové odpovědi: sale_attempts (result = 'invalid').\n\n` +
        `Po opravě (kotvy důvěry, podpisový certifikát FS) vraťte tržby do fronty ze serveru:\n` +
        `curl -X POST http://127.0.0.1:3100/api/internal/fs-requeue -H "authorization: Bearer $CRON_SECRET" -H "content-type: application/json" -d '{"environment":"${environment}"}'`,
    },
  });
}

/**
 * Provozovatel (R5.4): zruší pojistku prostředí a vrátí do fronty tržby zastavené kvůli neověřitelným
 * odpovědím. Každá se pak odešle jednou, se svým snímkem.
 */
export async function requeueInvalid(environment: "playground" | "production"): Promise<{ environment: string; requeued: number; resumed: boolean }> {
  const db = getDb();
  const resumed = (await db.delete(schema.fsBreaker).where(eq(schema.fsBreaker.environment, environment)).returning()).length > 0;
  const rows = await db
    .update(schema.sales)
    .set({ blockedReason: null, nextAttemptAt: new Date() })
    .where(
      and(
        eq(schema.sales.status, "queued"),
        eq(schema.sales.mode, environment),
        or(eq(schema.sales.blockedReason, "INVALID_RESPONSE"), like(schema.sales.lastError, "INVALID_RESPONSE%")),
      ),
    )
    .returning({ id: schema.sales.id });
  return { environment, requeued: rows.length, resumed };
}

/** Vrátí zablokované tržby do fronty (nový certifikát, opravené EIČ); `db` = i uvnitř transakce. */
export async function requeueBlocked(accountId: string, reasons: readonly string[], environment?: string, db: Pick<Db, "update"> = getDb()): Promise<number> {
  const rows = await db
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

/** Kódy určitého odmítnutí FS, po nichž smí vlastník opravit EIČ / jednotku ve snímku (Р3, R5.6). */
const DEFINITE_REFUSAL = /^EET_[23467]$/;

function snapshotHash(d: unknown): string {
  const keys = Object.keys((d ?? {}) as object).sort();
  return createHash("sha256").update(JSON.stringify(d, keys)).digest("hex");
}

/**
 * „Odeslat s opravenými údaji“ (Р3, R5.6): po určitém odmítnutí FS (Chyba 2, 3, 4, 6, 7 – ne timeout ani
 * INVALID) přestaví ve snímku jen eic_popl (podle EIČ účtu = CN certifikátu) a id_jednotky (podle jednotky).
 * porad_cis, dat_trzby a částky zůstávají. Do auditu jdou hashe starého i nového snímku.
 */
export async function rebuildSnapshots(accountId: string, ids: string[]): Promise<{ rebuilt: string[]; skipped: { id: string; reason: string }[] }> {
  const db = getDb();
  const rebuilt: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  for (const id of ids.slice(0, 200)) {
    const row = await db.query.sales.findFirst({ where: and(eq(schema.sales.id, id), eq(schema.sales.accountId, accountId)) });
    const old = row?.eetData as EetData | null | undefined;
    if (!acc || !row || row.status !== "rejected" || !old) {
      skipped.push({ id, reason: "Tržba není odmítnutá Finanční správou." });
      continue;
    }
    const [last] = await db.select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, id)).orderBy(desc(schema.saleAttempts.startedAt)).limit(1);
    if (!last || last.result !== "rejected" || !DEFINITE_REFUSAL.test(last.code ?? "")) {
      skipped.push({ id, reason: "Opravit údaje lze jen po určitém odmítnutí FS (chyba 2, 3, 4, 6 nebo 7)." });
      continue;
    }
    const eic = acc.eic ?? acc.dic;
    const cert = row.mode === "mock" ? null : await activeCertificate(accountId, row.mode);
    if (!eic || (cert && cert.eic !== eic)) {
      skipped.push({ id, reason: BLOCK_TEXT.EIC_CERT_MISMATCH! });
      continue;
    }
    const unit = row.unitId ? await db.query.evidenceUnits.findFirst({ where: eq(schema.evidenceUnits.id, row.unitId) }) : undefined;
    const unitId = unit?.fsUnitId ?? row.fsUnitId;
    const next: EetData = { ...old, eic_popl: eic, id_jednotky: unitId };
    if (next.eic_popl === old.eic_popl && next.id_jednotky === old.id_jednotky) {
      skipped.push({ id, reason: "EIČ ani číslo jednotky se nezměnily – opravte je nejdřív v nastavení." });
      continue;
    }
    const now = new Date();
    const done = await db
      .update(schema.sales)
      .set({ eetData: next, fsUnitId: unitId, status: "queued", blockedReason: null, claimToken: null, nextAttemptAt: now })
      .where(and(eq(schema.sales.id, id), eq(schema.sales.status, "rejected")))
      .returning({ id: schema.sales.id });
    if (!done.length) {
      skipped.push({ id, reason: "Tržba se mezitím změnila." });
      continue;
    }
    await db.insert(schema.saleAttempts).values({
      saleId: id,
      attempt: row.attempts,
      environment: row.mode,
      firstAttempt: false,
      startedAt: now,
      result: "rebuilt",
      code: "SNAPSHOT_REBUILT",
      message: `vlastník: ${snapshotHash(old)} → ${snapshotHash(next)} (eic_popl ${old.eic_popl}→${next.eic_popl}, id_jednotky ${old.id_jednotky}→${next.id_jednotky})`,
    });
    rebuilt.push(id);
  }
  return { rebuilt, skipped };
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
  // pozastavená prostředí (R5.4) se nevybírají; je-li čas na zkoušku, přidá se z nich jedna tržba
  const now = new Date();
  const breakers = await db.select().from(schema.fsBreaker);
  const paused = breakers.map((b) => b.environment);
  const due = await db
    .select({ id: schema.sales.id })
    .from(schema.sales)
    .where(and(eq(schema.sales.status, "queued"), lte(schema.sales.nextAttemptAt, now), ...(paused.length ? [notInArray(schema.sales.mode, paused)] : [])))
    .orderBy(asc(schema.sales.nextAttemptAt))
    .limit(limit);
  for (const b of breakers) {
    if (b.probeAt > now) continue;
    const [probe] = await db
      .select({ id: schema.sales.id })
      .from(schema.sales)
      .where(and(eq(schema.sales.status, "queued"), eq(schema.sales.mode, b.environment), lte(schema.sales.nextAttemptAt, now)))
      .orderBy(asc(schema.sales.nextAttemptAt))
      .limit(1);
    if (probe) due.push(probe);
  }
  let processed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, due.length) }, async () => {
      while (next < due.length) {
        const { id } = due[next++]!;
        // neočekávaná chyba jedné tržby nesmí zastavit zbytek fronty (A Дрібне 9)
        try {
          await processSale(id);
        } catch (e) {
          console.error("[fiscal] tržbu se nepodařilo zpracovat", { saleId: id, error: safeError(e) });
        }
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
