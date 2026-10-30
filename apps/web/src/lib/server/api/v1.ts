import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { evidencedAmounts, formatSequence, type Payment, type SaleLine } from "@ez/fiscal-core";
import { absoluteUrl } from "@/lib/site";
import { linesTotal, refundCapacityIssue, refundLinesFor, refundPayments, refundableLines, fullSelection, lineKey } from "@/lib/pos/refund";
import { processSale } from "../fiscal";
import { modeOf } from "../integrations";
import { quarantineSale } from "../quarantine";
import { SaleDiscountSchema, SaleLineSchema, SalePaymentsSchema, SaleTipSchema, SALE_LINES_MAX, ingestSales, type DeviceSale, type IngestResult } from "../sales";
import { ApiError, type ApiErrorCode, type SaleErrorV1 } from "./errors";
import { API_LIMITS, pragueDate, type ApiCtx } from "./http";

/* ───────────── schémata (S8, rozd. 3) ───────────── */

/**
 * Položka v API: tytéž meze jako u pokladny (SaleLineSchema), jen `kind` je goods | credit_topup. Slovo „prepayment“
 * API nepoužívá – vývojáři PMS by ho zaměnili se zálohou na ubytování, a ta je běžná tržba (Ф11).
 */
export const ApiLineSchema = SaleLineSchema.extend({ kind: z.enum(["goods", "credit_topup"]).optional() });

export const SaleV1Schema = z
  .object({
    id: z.string().uuid(),
    externalRef: z.string().trim().min(1).max(64).optional(),
    unitId: z.string().uuid(),
    soldAt: z.string().datetime({ offset: true }),
    sequence: z.string().min(1).max(25).optional(),
    lines: z.array(ApiLineSchema).min(1).max(SALE_LINES_MAX),
    payments: SalePaymentsSchema,
    tip: SaleTipSchema,
    discount: SaleDiscountSchema,
  })
  // vratka má vlastní routu (/v1/sales/{id}/refund); schválení PINem přes API neexistuje
  .and(z.object({ refundOf: z.undefined({ message: "Refunds use POST /v1/sales/{id}/refund." }).optional(), approval: z.undefined({ message: "Not supported in the API." }).optional() }));
export type SaleV1 = z.infer<typeof SaleV1Schema>;

export const RefundV1Schema = z.object({
  id: z.string().uuid(),
  externalRef: z.string().trim().min(1).max(64).optional(),
  soldAt: z.string().datetime({ offset: true }).optional(),
  /** vracené položky s kladným množstvím; bez nich celá zbývající tržba */
  lines: z
    .array(ApiLineSchema.extend({ qty: z.number().finite().positive().max(10_000) }))
    .min(1)
    .max(SALE_LINES_MAX)
    .optional(),
  reason: z.string().trim().max(200).optional(),
});

export type SaleStatus = "confirmed" | "queued" | "sending" | "rejected" | "quarantined" | "not_evidenced";

export interface SaleStatusV1 {
  id: string;
  externalRef: string | null;
  status: SaleStatus;
  pok: string | null;
  evidencedAmount: number | null;
  notEvidencedAmount: number | null;
  sentAt: string | null;
  deadlineAt: string | null;
  attempts: number;
  warnings: { code: number; text: string }[];
  error: SaleErrorV1 | null;
  receiptUrl: string | null;
}

/* ───────────── pomocné ───────────── */

/** Stabilní JSON (seřazené klíče) – hash těla pro idempotenci (jako stable() v ingestSales). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
const bodyHash = (v: unknown) => createHash("sha256").update(stable(v)).digest("hex");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function zodField(prefix: string, issue: z.ZodIssue | undefined): string {
  return [prefix, ...(issue?.path ?? []).map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`))].join("").replace(/\.\[/g, "[");
}

/** Půlnoc v Praze (UTC okamžik) pro den YYYY-MM-DD. */
export function pragueMidnight(day: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const local = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  const offset = local.getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess.getTime() - offset);
}

function apiLineToInternal<T extends { kind?: "goods" | "credit_topup" }>(l: T): Omit<T, "kind"> & { kind?: "goods" | "prepayment" } {
  const { kind, ...rest } = l;
  return { ...rest, ...(kind === "credit_topup" ? { kind: "prepayment" as const } : kind === "goods" ? { kind: "goods" as const } : {}) };
}

/* ───────────── stav tržby ───────────── */

const CERT_MISSING = ["CERT_MISSING", "CERT_NOT_YET_VALID", "CERT_NOT_VERIFIED", "PREPARE"];

function saleError(row: typeof schema.sales.$inferSelect): SaleErrorV1 | null {
  if (row.status === "rejected" || row.status === "failed") {
    const m = /^EET_(\d+)/.exec(row.lastError ?? "");
    return { code: "fs_rejected", message: `FS rejected the sale${m ? ` (Chyba ${m[1]})` : ""}. The owner sees it in Tržby k vyřízení.`, retryable: false, ...(m ? { fsCode: Number(m[1]) } : {}) };
  }
  if (row.status !== "queued") return null;
  if (row.blockedReason === "CERT_EXPIRED") return { code: "certificate_expired", message: "The certificate expired; the sale waits in the queue until the owner uploads a new one.", retryable: true };
  if (row.blockedReason && CERT_MISSING.includes(row.blockedReason)) return { code: "certificate_missing", message: "No valid certificate for this environment; the sale waits in the queue.", retryable: true };
  if (row.blockedReason) return { code: "sale_blocked", message: "The sale waits for the owner (account data); it is kept and sent once fixed.", retryable: true };
  if (row.attempts > 0 && row.lastError) return { code: "fs_unavailable", message: "FS did not confirm the sale yet; the queue retries automatically.", retryable: true };
  return null;
}

export function statusOfRow(row: typeof schema.sales.$inferSelect): SaleStatusV1 {
  const status: SaleStatus =
    row.status === "confirmed" ? "confirmed" : row.status === "not_required" ? "not_evidenced" : row.status === "sending" ? "sending" : row.status === "rejected" || row.status === "failed" ? "rejected" : "queued";
  return {
    id: row.id,
    externalRef: row.externalRef,
    status,
    pok: row.status === "confirmed" ? row.confirmationCode : null,
    evidencedAmount: row.evidencedTotal,
    notEvidencedAmount: row.total - row.evidencedTotal,
    sentAt: row.firstSentAt?.toISOString() ?? null,
    deadlineAt: row.deadlineAt.toISOString(),
    attempts: row.attempts,
    warnings: row.warnings ?? [],
    error: saleError(row),
    receiptUrl: absoluteUrl(`/u/${row.id}`),
  };
}

const QUARANTINE_CODE: Record<string, ApiErrorCode> = {
  FUTURE_DATE: "sale_in_future",
  TOO_OLD: "sale_too_old",
  UNIT_WITHOUT_FS_ID: "unit_not_ready",
  UNKNOWN_UNIT: "unit_not_found",
  INVALID_PAYLOAD: "invalid_request",
  SEQUENCE_CONFLICT: "sequence_conflict",
  REFUND_EXCEEDS: "refund_exceeds_original",
  REFUND_DUPLICATE: "refund_exceeds_original",
  REFUND_UNKNOWN_ORIGINAL: "original_not_found",
  ACCOUNT_CLOSED: "account_closed",
  PRODUCTION_NOT_OPEN: "environment_not_ready",
  CONTENT_CONFLICT: "idempotency_conflict",
  ID_CONFLICT: "idempotency_conflict",
};
const QUARANTINE_MESSAGE: Partial<Record<ApiErrorCode, string>> = {
  sale_in_future: "soldAt is more than 10 minutes in the future.",
  sale_too_old: "soldAt is older than 45 days.",
  unit_not_ready: "The unit has no FS unit number yet.",
  amount_out_of_range: "An amount exceeds the EET limit 99 999 999.99 CZK.",
  sequence_conflict: "The sequence is already used by another sale of this integration.",
  refund_exceeds_original: "The refund exceeds what is left of the original sale.",
  environment_not_ready: "Production FS accepts sales from 1 Nov 2026 only.",
};

function quarantineError(code: string, reason: string, field?: string): SaleErrorV1 {
  const api: ApiErrorCode = code === "INVALID_SALE" && /limit/i.test(reason) ? "amount_out_of_range" : (QUARANTINE_CODE[code] ?? "invalid_request");
  return { code: api, message: QUARANTINE_MESSAGE[api] ?? (api === "invalid_request" ? "The sale did not pass validation; it is kept in the owner's quarantine." : "The sale is kept in the owner's quarantine."), retryable: false, ...(field ? { field } : {}) };
}

function quarantinedStatus(id: string, externalRef: string | null, error: SaleErrorV1): SaleStatusV1 {
  return { id, externalRef, status: "quarantined", pok: null, evidencedAmount: null, notEvidencedAmount: null, sentAt: null, deadlineAt: null, attempts: 0, warnings: [], error, receiptUrl: null };
}

/** Stav tržeb integrace podle id (v pořadí `ids`): evidované z sales, ostatní z karantény jejího zařízení. */
export async function statusesFor(ctx: ApiCtx, ids: string[]): Promise<Map<string, SaleStatusV1>> {
  const out = new Map<string, SaleStatusV1>();
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.accountId, ctx.account.id), eq(schema.sales.integrationId, ctx.integration.id), inArray(schema.sales.id, ids)));
  for (const r of rows) out.set(r.id, statusOfRow(r));
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length) {
    const q = await db
      .select()
      .from(schema.saleQuarantine)
      .where(and(eq(schema.saleQuarantine.accountId, ctx.account.id), eq(schema.saleQuarantine.deviceId, ctx.device.id), inArray(schema.saleQuarantine.id, missing)));
    const keys = await db.select().from(schema.apiSaleKeys).where(and(eq(schema.apiSaleKeys.integrationId, ctx.integration.id), inArray(schema.apiSaleKeys.saleId, missing)));
    const refOf = new Map(keys.map((k) => [k.saleId, k.externalRef]));
    for (const r of q) {
      if (r.resolution === "ingested") continue;
      const p = r.payload as { externalRef?: unknown };
      out.set(r.id, quarantinedStatus(r.id, refOf.get(r.id) ?? (typeof p?.externalRef === "string" ? p.externalRef : null), quarantineError(r.reasonCode, r.reason)));
    }
  }
  return out;
}

/* ───────────── idempotence a pořadová čísla ───────────── */

type KeyRow = typeof schema.apiSaleKeys.$inferSelect;

/**
 * Klíč idempotence: první požadavek s daným id uloží hash těla a dostane pořadové číslo (pod zámkem řádku integrace,
 * takže souběžné požadavky čísla nepřeskočí). Další požadavek se stejným id dostane totéž číslo; jiné tělo = konflikt.
 */
async function reserveKey(ctx: ApiCtx, saleId: string, hash: string, sequence: string | undefined, externalRef: string | null, field: string): Promise<KeyRow> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const [integ] = await tx.select().from(schema.integrations).where(eq(schema.integrations.id, ctx.integration.id)).for("update");
      const [existing] = await tx.select().from(schema.apiSaleKeys).where(eq(schema.apiSaleKeys.saleId, saleId));
      if (existing) {
        if (existing.integrationId !== ctx.integration.id || existing.bodyHash !== hash) throw new ApiError("idempotency_conflict", "A sale with this id already exists with a different body.", field);
        return existing;
      }
      let seq = sequence;
      if (!seq) {
        const n = integ!.nextSequence;
        await tx.update(schema.integrations).set({ nextSequence: n + 1 }).where(eq(schema.integrations.id, ctx.integration.id));
        seq = formatSequence(ctx.device.sequencePrefix, n);
      }
      const [row] = await tx.insert(schema.apiSaleKeys).values({ saleId, integrationId: ctx.integration.id, bodyHash: hash, sequence: seq, externalRef }).returning();
      return row!;
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (/api_sale_keys_ref_uq/.test(`${(e as Error)?.message} ${(e as { cause?: Error })?.cause?.message ?? ""} ${(e as { constraint_name?: string })?.constraint_name ?? ""}`)) {
      throw new ApiError("external_ref_conflict", "This externalRef is already used by another sale of this integration.", field.replace(/\.id$/, ".externalRef"));
    }
    throw e;
  }
}

/** Kontrola konfliktů ještě před uložením čehokoli (celý požadavek 409, nic se neuloží). */
async function precheckConflicts(ctx: ApiCtx, items: { id: string; hash: string; externalRef: string | null; field: string }[]) {
  const db = getDb();
  const ids = items.map((i) => i.id);
  const keys = ids.length ? await db.select().from(schema.apiSaleKeys).where(inArray(schema.apiSaleKeys.saleId, ids)) : [];
  const byId = new Map(keys.map((k) => [k.saleId, k]));
  // id, které už má tržba jiného zařízení nebo účtu (pokladna, cizí účet)
  const taken = ids.length
    ? await db
        .select({ id: schema.sales.id, integrationId: schema.sales.integrationId })
        .from(schema.sales)
        .where(inArray(schema.sales.id, ids))
    : [];
  const takenById = new Map(taken.map((t) => [t.id, t.integrationId]));
  const refs = items.flatMap((i) => (i.externalRef ? [i.externalRef] : []));
  const refRows = refs.length
    ? await db.select().from(schema.apiSaleKeys).where(and(eq(schema.apiSaleKeys.integrationId, ctx.integration.id), inArray(schema.apiSaleKeys.externalRef, refs)))
    : [];
  const refOwner = new Map(refRows.map((r) => [r.externalRef!, r.saleId]));
  const seenRefs = new Map<string, string>();
  for (const i of items) {
    const k = byId.get(i.id);
    if (k && (k.integrationId !== ctx.integration.id || k.bodyHash !== i.hash)) throw new ApiError("idempotency_conflict", "A sale with this id already exists with a different body.", i.field);
    if (!k && takenById.has(i.id) && takenById.get(i.id) !== ctx.integration.id) throw new ApiError("idempotency_conflict", "A sale with this id already exists.", i.field);
    if (i.externalRef) {
      const owner = refOwner.get(i.externalRef) ?? seenRefs.get(i.externalRef);
      if (owner && owner !== i.id) throw new ApiError("external_ref_conflict", "This externalRef is already used by another sale of this integration.", i.field.replace(/\.id$/, ".externalRef"));
      seenRefs.set(i.externalRef, i.id);
    }
  }
  return byId;
}

/* ───────────── synchronní odeslání s rozpočtem ───────────── */

export const SEND_BUDGET_MS = 2_500;

/**
 * Nově přijaté tržby se odešlou hned, po pořadí, dokud nevyprší rozpočet celého požadavku (2,5 s). Tržba, na kterou
 * by se čekalo déle, dojede na pozadí (výsledek zapíše processSale sám, vlastník i webhook ho uvidí); ostatní dořeší cron.
 */
async function sendWithinBudget(ctx: ApiCtx, ids: string[], startedAt: number): Promise<void> {
  for (const id of ids) {
    const left = startedAt + SEND_BUDGET_MS - Date.now();
    if (left <= 0) return;
    const send = processSale(id, ctx.account).then(
      () => true,
      () => true,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = await Promise.race([send, new Promise<false>((res) => (timer = setTimeout(() => res(false), left)))]);
    clearTimeout(timer);
    if (!done) return;
  }
}

/* ───────────── POST /v1/sales ───────────── */

async function knownIds(ctx: ApiCtx, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await getDb()
    .select({ id: schema.apiSaleKeys.saleId })
    .from(schema.apiSaleKeys)
    .where(and(eq(schema.apiSaleKeys.integrationId, ctx.integration.id), inArray(schema.apiSaleKeys.saleId, ids)));
  return new Set(rows.map((r) => r.id));
}

async function unitsAllowed(ctx: ApiCtx, unitIds: string[]): Promise<Set<string>> {
  const wanted = unitIds.filter((u) => ctx.integration.unitIds.includes(u));
  if (!wanted.length) return new Set();
  const rows = await getDb()
    .select({ id: schema.evidenceUnits.id })
    .from(schema.evidenceUnits)
    .where(and(eq(schema.evidenceUnits.accountId, ctx.account.id), inArray(schema.evidenceUnits.id, wanted)));
  return new Set(rows.map((r) => r.id));
}

function assertCanWrite(ctx: ApiCtx) {
  if (ctx.integration.environment === "live" && ctx.account.eetMode !== "production") {
    throw new ApiError("environment_not_ready", "This live token needs the account in production mode.");
  }
}

function ensureAccepted(results: IngestResult[]) {
  // dočasná chyba serveru: tržba se neuložila – klient pošle celý požadavek znovu (API je idempotentní)
  if (results.some((r) => !r.ok && r.retryable)) throw new ApiError("internal_error", "Some sales could not be stored right now. Retry the same request – the API is idempotent.");
}

export async function submitSales(ctx: ApiCtx): Promise<{ results: SaleStatusV1[] }> {
  const startedAt = Date.now();
  const body = (await ctx.json()) as { sales?: unknown } | null;
  const raw = body && typeof body === "object" ? body.sales : undefined;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > API_LIMITS.salesPerBatch) {
    throw new ApiError("invalid_request", `sales must be an array of 1–${API_LIMITS.salesPerBatch} sales.`, "sales");
  }
  const ids: string[] = [];
  for (const [i, item] of raw.entries()) {
    const id = (item as { id?: unknown })?.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) throw new ApiError("invalid_request", "Every sale needs an id (uuid) – it is the idempotency key.", `sales[${i}].id`);
    if (ids.includes(id)) throw new ApiError("invalid_request", "The same id twice in one request.", `sales[${i}].id`);
    ids.push(id);
  }
  // zrušený účet: jen dovezení už přijatých tržeb (R5.8)
  const known = await knownIds(ctx, ids);
  if (ctx.account.closedAt && ids.some((id) => !known.has(id))) throw new ApiError("account_closed", "The account is closed; new sales are not accepted.");
  assertCanWrite(ctx);

  const parsed = raw.map((item, i) => ({ i, raw: item, r: SaleV1Schema.safeParse(item) }));
  const valid = parsed.flatMap((p) => (p.r.success ? [{ i: p.i, sale: p.r.data as SaleV1 }] : []));
  const allowed = await unitsAllowed(ctx, [...new Set(valid.map((v) => v.sale.unitId))]);
  for (const v of valid) if (!allowed.has(v.sale.unitId)) throw new ApiError("unit_not_found", "Unknown unit, or the token has no access to it.", `sales[${v.i}].unitId`);
  const items = valid.map((v) => ({ id: v.sale.id, hash: bodyHash(v.sale), externalRef: v.sale.externalRef ?? null, field: `sales[${v.i}].id` }));
  await precheckConflicts(ctx, items);

  const mode = modeOf(ctx.integration.environment);
  const deviceSales: DeviceSale[] = [];
  for (const [n, v] of valid.entries()) {
    const key = await reserveKey(ctx, v.sale.id, items[n]!.hash, v.sale.sequence, v.sale.externalRef ?? null, items[n]!.field);
    deviceSales.push({
      id: v.sale.id,
      sequence: key.sequence,
      soldAt: v.sale.soldAt,
      unitId: v.sale.unitId,
      staffId: null,
      lines: v.sale.lines.map(apiLineToInternal),
      payments: v.sale.payments,
      discount: v.sale.discount,
      tip: v.sale.tip,
      refundOf: null,
      approval: null,
      mode,
    });
  }
  // neúplná data s platným id: do karantény jako u pokladny (Р2) – vlastník je vidí v „Tržby k vyřízení“
  const invalidStatus = new Map<string, SaleStatusV1>();
  for (const p of parsed) {
    if (p.r.success) continue;
    const id = ids[p.i]!;
    const issue = p.r.error.issues[0];
    await quarantineSale(ctx, p.raw, "INVALID_PAYLOAD", issue?.message ?? "Neplatná tržba");
    const ref = (p.raw as { externalRef?: unknown }).externalRef;
    invalidStatus.set(id, quarantinedStatus(id, typeof ref === "string" ? ref.slice(0, 64) : null, quarantineError("INVALID_PAYLOAD", "", zodField(`sales[${p.i}]`, issue))));
  }

  const results = await ingestSales(ctx, deviceSales);
  ensureAccepted(results);
  await sendWithinBudget(ctx, results.flatMap((r) => (r.ok && r.inserted ? [r.id] : [])), startedAt);
  await recordUsage(ctx, results.filter((r) => r.ok && r.inserted).length);

  const statuses = await statusesFor(ctx, results.filter((r) => r.ok).map((r) => r.id));
  const byResult = new Map(results.map((r) => [r.id, r]));
  const refOf = new Map(valid.map((v) => [v.sale.id, v.sale.externalRef ?? null]));
  return {
    results: ids.map((id) => {
      if (invalidStatus.has(id)) return invalidStatus.get(id)!;
      const r = byResult.get(id)!;
      if (r.ok) return statuses.get(id)!;
      return quarantinedStatus(id, refOf.get(id) ?? null, quarantineError(r.code, r.error));
    }),
  };
}

async function recordUsage(ctx: ApiCtx, accepted: number) {
  if (!accepted) return;
  const db = getDb();
  const day = pragueDate();
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(distinct ${schema.sales.unitId})::int` })
    .from(schema.sales)
    .where(and(eq(schema.sales.integrationId, ctx.integration.id), gte(schema.sales.receivedAt, pragueMidnight(day))));
  await db
    .insert(schema.apiUsageDaily)
    .values({ integrationId: ctx.integration.id, date: day, salesAccepted: accepted, activeUnits: n })
    .onConflictDoUpdate({
      target: [schema.apiUsageDaily.integrationId, schema.apiUsageDaily.date],
      set: { salesAccepted: sql`${schema.apiUsageDaily.salesAccepted} + ${accepted}`, activeUnits: n },
    });
}

/* ───────────── GET /v1/sales ───────────── */

const STATUS_FILTER: Record<string, string[]> = {
  confirmed: ["confirmed"],
  queued: ["queued"],
  sending: ["sending"],
  rejected: ["rejected", "failed"],
  not_evidenced: ["not_required"],
};

function encodeCursor(row: { soldAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify([row.soldAt.toISOString(), row.id])).toString("base64url");
}
function decodeCursor(c: string): { soldAt: Date; id: string } {
  try {
    const [at, id] = JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as [string, string];
    const soldAt = new Date(at);
    if (Number.isNaN(soldAt.getTime()) || typeof id !== "string" || !UUID_RE.test(id)) throw new Error();
    return { soldAt, id };
  } catch {
    throw new ApiError("invalid_request", "Invalid cursor.", "cursor");
  }
}

function isoParam(q: URLSearchParams, name: string): Date | null {
  const v = q.get(name);
  if (v === null) return null;
  if (!z.string().datetime({ offset: true }).safeParse(v).success) throw new ApiError("invalid_request", `${name} must be ISO 8601 with an offset.`, name);
  return new Date(v);
}

export async function listSales(ctx: ApiCtx): Promise<{ sales: SaleStatusV1[]; nextCursor: string | null }> {
  const q = ctx.url.searchParams;
  const limitRaw = q.get("limit");
  const limit = limitRaw === null ? 50 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ApiError("invalid_request", "limit must be 1–200.", "limit");
  const idsRaw = q.get("ids");
  if (idsRaw !== null) {
    const ids = idsRaw.split(",").filter(Boolean);
    if (ids.length > 200 || ids.some((id) => !UUID_RE.test(id))) throw new ApiError("invalid_request", "ids: up to 200 uuids separated by commas.", "ids");
    const st = await statusesFor(ctx, ids);
    return { sales: ids.flatMap((id) => (st.has(id) ? [st.get(id)!] : [])), nextCursor: null };
  }
  const status = q.get("status");
  if (status !== null && status !== "quarantined" && !STATUS_FILTER[status]) throw new ApiError("invalid_request", "Unknown status.", "status");
  const unitId = q.get("unitId");
  if (unitId !== null && !UUID_RE.test(unitId)) throw new ApiError("invalid_request", "unitId must be a uuid.", "unitId");
  const since = isoParam(q, "since");
  const until = isoParam(q, "until");
  const cursor = q.get("cursor") ? decodeCursor(q.get("cursor")!) : null;
  const db = getDb();
  if (status === "quarantined") {
    const rows = await db
      .select({ id: schema.saleQuarantine.id })
      .from(schema.saleQuarantine)
      .where(and(eq(schema.saleQuarantine.accountId, ctx.account.id), eq(schema.saleQuarantine.deviceId, ctx.device.id), isNull(schema.saleQuarantine.resolvedAt)))
      .orderBy(desc(schema.saleQuarantine.receivedAt))
      .limit(limit);
    const st = await statusesFor(ctx, rows.map((r) => r.id));
    return { sales: rows.flatMap((r) => (st.has(r.id) ? [st.get(r.id)!] : [])), nextCursor: null };
  }
  const externalRef = q.get("externalRef");
  const rows = await db
    .select()
    .from(schema.sales)
    .where(
      and(
        eq(schema.sales.accountId, ctx.account.id),
        eq(schema.sales.integrationId, ctx.integration.id),
        ...(externalRef !== null ? [eq(schema.sales.externalRef, externalRef)] : []),
        ...(status ? [inArray(schema.sales.status, STATUS_FILTER[status] as never)] : []),
        ...(unitId ? [eq(schema.sales.unitId, unitId)] : []),
        ...(since ? [gte(schema.sales.soldAt, since)] : []),
        ...(until ? [lt(schema.sales.soldAt, until)] : []),
        ...(cursor ? [or(lt(schema.sales.soldAt, cursor.soldAt), and(eq(schema.sales.soldAt, cursor.soldAt), lt(schema.sales.id, cursor.id)))!] : []),
      ),
    )
    .orderBy(desc(schema.sales.soldAt), desc(schema.sales.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return { sales: page.map(statusOfRow), nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]!) : null };
}

export async function getSale(ctx: ApiCtx, id: string): Promise<SaleStatusV1> {
  if (!UUID_RE.test(id)) throw new ApiError("sale_not_found", "Sale not found.");
  const st = (await statusesFor(ctx, [id])).get(id);
  if (!st) throw new ApiError("sale_not_found", "Sale not found.");
  return st;
}

/* ───────────── POST /v1/sales/{id}/refund ───────────── */

/**
 * Vratka přes API (S8, rozd. 3.5) – stejná logika jako vratka z pokladny (Т11): jednotka originálu, aktuální čas
 * (nebo soldAt z těla), položky jen z originálu, platby zrcadlí originál (refundPayments), součet hlídá ingest pod
 * zámkem originálu. Vratka k ještě nepotvrzené tržbě je povolená jako u pokladny – obě tržby jdou frontou samostatně.
 */
export async function refundSale(ctx: ApiCtx, originalId: string): Promise<SaleStatusV1> {
  const startedAt = Date.now();
  const raw = await ctx.json();
  const parsed = RefundV1Schema.safeParse(raw);
  if (!parsed.success) throw new ApiError("invalid_request", parsed.error.issues[0]?.message ?? "Invalid refund.", zodField("", parsed.error.issues[0]).replace(/^\./, "") || undefined);
  const body = parsed.data;
  const db = getDb();
  const original = UUID_RE.test(originalId)
    ? await db.query.sales.findFirst({ where: and(eq(schema.sales.id, originalId), eq(schema.sales.accountId, ctx.account.id), eq(schema.sales.integrationId, ctx.integration.id)) })
    : undefined;
  if (!original) throw new ApiError("original_not_found", "The original sale does not exist or was not created by this integration.");
  if (original.refundOf) throw new ApiError("original_is_refund", "The original is itself a refund.");
  if (!original.unitId || !(await unitsAllowed(ctx, [original.unitId])).has(original.unitId)) throw new ApiError("unit_not_found", "The token has no access to the original's unit.");
  const hash = bodyHash({ ...body, refundOf: original.id });
  const keyRows = await precheckConflicts(ctx, [{ id: body.id, hash, externalRef: body.externalRef ?? null, field: "id" }]);
  // opakování už uložené vratky: tentýž výsledek, nic se nepřepočítává
  if (keyRows.get(body.id)) {
    const done = (await statusesFor(ctx, [body.id])).get(body.id);
    if (done) return done;
  }
  if (ctx.account.closedAt && !keyRows.get(body.id)) throw new ApiError("account_closed", "The account is closed; new sales are not accepted.");
  assertCanWrite(ctx);

  const previous = await db.select().from(schema.sales).where(and(eq(schema.sales.refundOf, original.id), ne(schema.sales.id, body.id)));
  const originalLines = (original.items ?? []) as SaleLine[];
  let lines: SaleLine[];
  if (body.lines) {
    lines = body.lines.map((l) => {
      const internal = apiLineToInternal(l) as SaleLine;
      return { ...internal, qty: -l.qty };
    });
    const keys = new Set(originalLines.map(lineKey));
    if (lines.some((l) => !keys.has(lineKey(l)))) throw new ApiError("refund_exceeds_original", "A refunded line is not in the original sale.", "lines");
  } else {
    const rows = refundableLines(originalLines, previous.map((p) => ({ lines: (p.items ?? []) as SaleLine[] })));
    lines = refundLinesFor(rows, fullSelection(rows));
  }
  if (!lines.length) throw new ApiError("refund_exceeds_original", "Nothing is left to refund.");
  const refundTotal = linesTotal(lines);
  const payments: Payment[] = refundPayments(
    { payments: original.payments as Payment[], tip: original.tip, subtotal: original.total - original.tip },
    previous.map((p) => ({ payments: p.payments as Payment[] })),
    refundTotal,
  );
  const amounts = evidencedAmounts({ payments, lines });
  const issue = refundCapacityIssue(
    { items: originalLines, total: original.total, tip: original.tip, evidencedTotal: original.evidencedTotal, redeemedAmount: original.redeemedAmount },
    previous.map((p) => ({ items: (p.items ?? []) as SaleLine[], total: p.total, evidencedTotal: p.evidencedTotal, redeemedAmount: p.redeemedAmount })),
    { items: lines, total: refundTotal, evidencedTotal: amounts.total, redeemedAmount: amounts.redeemed },
  );
  if (issue) throw new ApiError("refund_exceeds_original", "The refund exceeds what is left of the original sale.", body.lines ? "lines" : undefined);

  const key = await reserveKey(ctx, body.id, hash, undefined, body.externalRef ?? null, "id");
  const soldAt = body.soldAt ?? new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
  const [result] = await ingestSales(ctx, [
    { id: body.id, sequence: key.sequence, soldAt, unitId: original.unitId, staffId: null, lines, payments, refundOf: original.id, approval: null, mode: original.mode as DeviceSale["mode"] },
  ]);
  ensureAccepted([result!]);
  if (!result!.ok) return quarantinedStatus(body.id, body.externalRef ?? null, quarantineError(result!.code, result!.error));
  if (result!.inserted) {
    await sendWithinBudget(ctx, [body.id], startedAt);
    await recordUsage(ctx, 1);
  }
  return (await statusesFor(ctx, [body.id])).get(body.id)!;
}

/* ───────────── GET /v1/units, /v1/account, /v1/closings ───────────── */

type CertState = { status: "valid" | "expired" | "missing" | "not_verified"; validTo: string | null; daysLeft: number | null };

async function certificateState(ctx: ApiCtx, now = new Date()): Promise<CertState> {
  const env = modeOf(ctx.integration.environment);
  const cert = await getDb().query.certificates.findFirst({
    where: and(eq(schema.certificates.accountId, ctx.account.id), eq(schema.certificates.environment, env), isNull(schema.certificates.revokedAt)),
    orderBy: desc(schema.certificates.createdAt),
  });
  if (!cert) return { status: "missing", validTo: null, daysLeft: null };
  const daysLeft = Math.floor((cert.validTo.getTime() - now.getTime()) / 86_400_000);
  const status = cert.validTo <= now ? "expired" : env === "production" && !cert.verifiedAt ? "not_verified" : "valid";
  return { status, validTo: cert.validTo.toISOString(), daysLeft };
}

/** EIČ jen maskovaně – u fyzických osob je to rodné číslo. */
export function maskEic(eic: string | null): string | null {
  if (!eic) return null;
  return `${eic.slice(0, 2)}••••${eic.slice(-4)}`;
}

export async function accountInfo(ctx: ApiCtx) {
  return {
    environment: ctx.integration.environment,
    eetMode: modeOf(ctx.integration.environment),
    eicMasked: maskEic(ctx.account.eic ?? ctx.account.dic),
    certificate: await certificateState(ctx),
    integration: { id: ctx.integration.id, name: ctx.integration.name, scopes: ctx.integration.scopes, unitIds: ctx.integration.unitIds },
  };
}

export async function listUnits(ctx: ApiCtx) {
  const ids = ctx.integration.unitIds;
  if (!ids.length) return { units: [] };
  const rows = await getDb()
    .select()
    .from(schema.evidenceUnits)
    .where(and(eq(schema.evidenceUnits.accountId, ctx.account.id), inArray(schema.evidenceUnits.id, ids)));
  const cert = await certificateState(ctx);
  return {
    units: rows.map((u) => {
      const notReadyReason = ctx.account.closedAt
        ? "account_closed"
        : !u.fsUnitId
          ? "unit_missing_fs_id"
          : cert.status === "expired"
            ? "certificate_expired"
            : cert.status !== "valid"
              ? "certificate_missing"
              : null;
      return { id: u.id, label: u.label, type: u.type, fsUnitId: u.fsUnitId, active: u.active, ready: notReadyReason === null, notReadyReason };
    }),
  };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Denní přehledy tržeb integrace (S8, rozd. 3.6) – agregát za běhu z řádků sales (tabulka closings patří uzávěrkám
 * pokladny s hotovostí a směnou; PMS má vlastní uzávěrku). Den = kalendářní den v Praze podle soldAt.
 */
export async function listClosings(ctx: ApiCtx) {
  const q = ctx.url.searchParams;
  const today = pragueDate();
  const from = q.get("from") ?? today;
  const to = q.get("to") ?? from;
  if (!DAY_RE.test(from) || !DAY_RE.test(to) || from > to) throw new ApiError("invalid_request", "from/to must be YYYY-MM-DD, from ≤ to.", "from");
  if (Date.parse(to) - Date.parse(from) > 62 * 86_400_000) throw new ApiError("invalid_request", "At most 62 days per request.", "to");
  const unitId = q.get("unitId");
  if (unitId !== null && (!UUID_RE.test(unitId) || !(await unitsAllowed(ctx, [unitId])).has(unitId))) throw new ApiError("unit_not_found", "Unknown unit, or the token has no access to it.", "unitId");
  const end = pragueMidnight(new Date(Date.parse(to) + 86_400_000).toISOString().slice(0, 10));
  const rows = await getDb()
    .select()
    .from(schema.sales)
    .where(
      and(
        eq(schema.sales.accountId, ctx.account.id),
        eq(schema.sales.integrationId, ctx.integration.id),
        gte(schema.sales.soldAt, pragueMidnight(from)),
        lt(schema.sales.soldAt, end),
        ...(unitId ? [eq(schema.sales.unitId, unitId)] : []),
      ),
    );
  type Day = { date: string; unitId: string | null; count: number; total: number; evidenced: number; notEvidenced: number; byPaymentMethod: Record<string, number>; byVat: Record<string, { base: number; vat: number }>; pending: number };
  const days = new Map<string, Day>();
  for (const r of rows) {
    const date = pragueDate(r.soldAt);
    const k = `${date}|${r.unitId}`;
    const d = days.get(k) ?? { date, unitId: r.unitId, count: 0, total: 0, evidenced: 0, notEvidenced: 0, byPaymentMethod: {}, byVat: {}, pending: 0 };
    d.count++;
    d.total += r.total;
    d.evidenced += r.evidencedTotal;
    d.notEvidenced += r.total - r.evidencedTotal;
    for (const p of r.payments) d.byPaymentMethod[p.method] = (d.byPaymentMethod[p.method] ?? 0) + p.amount;
    for (const [rate, v] of Object.entries(r.vatBreakdown ?? {})) {
      const cur = d.byVat[rate] ?? { base: 0, vat: 0 };
      d.byVat[rate] = { base: cur.base + v.base, vat: cur.vat + v.vat };
    }
    if (r.status !== "confirmed" && r.status !== "not_required") d.pending++;
    days.set(k, d);
  }
  return { closings: [...days.values()].sort((a, b) => (a.date === b.date ? String(a.unitId).localeCompare(String(b.unitId)) : a.date < b.date ? -1 : 1)) };
}
