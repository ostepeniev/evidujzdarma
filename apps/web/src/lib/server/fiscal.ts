import "server-only";
import { and, asc, eq, gt, gte, inArray, isNull, like, lte, desc, notInArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { randomUUID } from "node:crypto";
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
  PREPARE: "Zprávu nelze podepsat (certifikát nebo klíč) – zkusíme to znovu za hodinu, případně nahrajte certifikát znovu.",
  EIC_MISSING: "U účtu chybí EIČ (DIČ).",
  MESSAGE_INVALID: "Údaje tržby neodpovídají formátu EET (EIČ, číslo jednotky, označení pokladny).",
  ACCOUNT_MISSING: "Účet neexistuje.",
  INVALID_RESPONSE: "Odpověď Finanční správy opakovaně nešla ověřit – tržbu zkoušíme dál s delším odstupem a řešíme to.",
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
        nextAttemptAt: new Date(now.getTime() + (o.retryInMs ?? retryDelaySeconds(row.attempts) * 1000)),
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
  if (applied && outcome.result === "invalid") {
    await checkInvalidStreak(claimed);
    await maybeTripBreaker(claimed.mode);
  }
  // potvrzená zkušební tržba = podpis FS jde zase ověřit → pojistka se ruší
  if (gate === "probe" && applied && outcome.result === "confirmed") await db.delete(schema.fsBreaker).where(eq(schema.fsBreaker.environment, claimed.mode));
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
        .where(eq(schema.saleAttempts.saleId, row.id))
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

/** Počet neověřitelných odpovědí po sobě u tržby (bez právě probíhajícího pokusu). */
async function invalidStreak(saleId: string): Promise<number> {
  const last = await getDb()
    .select({ result: schema.saleAttempts.result })
    .from(schema.saleAttempts)
    .where(eq(schema.saleAttempts.saleId, saleId))
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
