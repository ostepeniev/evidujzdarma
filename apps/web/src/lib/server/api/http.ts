import "server-only";
import { randomUUID } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { authenticateIntegration, type IntegrationContext } from "../integrations";
import { ApiError, type ApiErrorCode } from "./errors";

/** Limity EET API v1 (S8, rozd. 2). */
export const API_LIMITS = { requestsPerMinute: 120, salesPerBatch: 100, bodyBytes: 1_048_576 } as const;

export interface ApiCtx extends IntegrationContext {
  requestId: string;
  /** Tělo požadavku jako JSON (nejvýš 1 MB, jinak 413; neplatné → 400). */
  json(): Promise<unknown>;
  url: URL;
}

type Spec = { route: string; scope: schema.ApiScope | null };
type RouteContext = { params: Promise<Record<string, string>> };
type Result = { status?: number; body: unknown };

/** Den v Praze (YYYY-MM-DD) pro denní využití. */
export function pragueDate(d = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });
}

/**
 * Pevné minutové okno v Postgresu (Redis nemáme, S8 rozd. 2): počítadlo se zvýší atomicky (upsert) a vrátí stav.
 * Okna starší hodiny maže runRetention.
 */
async function rateWindow(integrationId: string, now: Date): Promise<{ count: number; resetSeconds: number }> {
  const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const [row] = await getDb()
    .insert(schema.apiRateWindows)
    .values({ integrationId, windowStart: start, count: 1 })
    .onConflictDoUpdate({ target: [schema.apiRateWindows.integrationId, schema.apiRateWindows.windowStart], set: { count: sql`${schema.apiRateWindows.count} + 1` } })
    .returning({ count: schema.apiRateWindows.count });
  return { count: row!.count, resetSeconds: Math.max(1, Math.ceil((start.getTime() + 60_000 - now.getTime()) / 1000)) };
}

function errorJson(e: ApiError, requestId: string) {
  return { error: { code: e.code, message: e.message, ...(e.field ? { field: e.field } : {}), requestId } };
}

/**
 * Obal routy /api/v1: X-Request-Id, autentizace tokenem integrace a oprávněním, limit 120/min, jednotný formát chyb,
 * deník api_requests (šablona cesty, stav, kód chyby – nikdy tělo, URL s parametry ani token) a denní využití.
 * Do konzole jde jen druh neočekávané chyby (jméno a SQLSTATE), ne její text: ten může nést data tržby (R3.6).
 */
export function apiRoute(spec: Spec, handler: (ctx: ApiCtx, params: Record<string, string>) => Promise<Result>) {
  return async (req: Request, route?: RouteContext): Promise<Response> => {
    const requestId = randomUUID();
    const started = Date.now();
    const headers = new Headers({ "x-request-id": requestId, "cache-control": "no-store" });
    let integrationId: string | null = null;
    let status = 500;
    let errorCode: ApiErrorCode | null = null;
    let response: Response;
    try {
      const ctx = await authenticateIntegration(req, spec.scope);
      integrationId = ctx.integration.id;
      const rl = await rateWindow(ctx.integration.id, new Date());
      headers.set("ratelimit-limit", String(API_LIMITS.requestsPerMinute));
      headers.set("ratelimit-remaining", String(Math.max(0, API_LIMITS.requestsPerMinute - rl.count)));
      headers.set("ratelimit-reset", String(rl.resetSeconds));
      if (rl.count > API_LIMITS.requestsPerMinute) {
        throw new ApiError("rate_limited", `Rate limit ${API_LIMITS.requestsPerMinute} requests per minute exceeded.`, undefined, { "retry-after": String(rl.resetSeconds) });
      }
      const apiCtx: ApiCtx = {
        ...ctx,
        requestId,
        url: new URL(req.url),
        json: async () => {
          const declared = Number(req.headers.get("content-length") ?? 0);
          if (declared > API_LIMITS.bodyBytes) throw new ApiError("payload_too_large", "The body is larger than 1 MB.");
          const text = await req.text();
          if (Buffer.byteLength(text) > API_LIMITS.bodyBytes) throw new ApiError("payload_too_large", "The body is larger than 1 MB.");
          try {
            return JSON.parse(text) as unknown;
          } catch {
            throw new ApiError("invalid_request", "The body is not valid JSON.");
          }
        },
      };
      const result = await handler(apiCtx, (await route?.params) ?? {});
      status = result.status ?? 200;
      response = Response.json(result.body, { status, headers });
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (!err) console.error("[api/v1] neočekávaná chyba", { route: spec.route, requestId, error: errorKind(e) });
      const apiErr = err ?? new ApiError("internal_error", "Unexpected server error. Retry with the same ids – the API is idempotent.");
      status = apiErr.status;
      errorCode = apiErr.code;
      for (const [k, v] of Object.entries(apiErr.headers ?? {})) headers.set(k, v);
      response = Response.json(errorJson(apiErr, requestId), { status, headers });
    }
    await logRequest({ integrationId, method: req.method, route: spec.route, status, durationMs: Date.now() - started, errorCode, requestId });
    return response;
  };
}

/** Jen jméno a SQLSTATE – žádná zpráva (může obsahovat parametry SQL nebo data tržby). */
function errorKind(e: unknown): string {
  const cause = (e as { cause?: { code?: unknown } })?.cause;
  const code = (e as { code?: unknown })?.code ?? cause?.code;
  return `${e instanceof Error ? e.name : typeof e}${typeof code === "string" ? ` ${code}` : ""}`;
}

async function logRequest(r: { integrationId: string | null; method: string; route: string; status: number; durationMs: number; errorCode: string | null; requestId: string }) {
  try {
    const db = getDb();
    await db.insert(schema.apiRequests).values({ ...r, method: r.method.slice(0, 8) });
    if (r.integrationId) {
      await db
        .insert(schema.apiUsageDaily)
        .values({ integrationId: r.integrationId, date: pragueDate(), requests: 1 })
        .onConflictDoUpdate({ target: [schema.apiUsageDaily.integrationId, schema.apiUsageDaily.date], set: { requests: sql`${schema.apiUsageDaily.requests} + 1` } });
    }
  } catch (e) {
    console.error("[api/v1] deník požadavků", { error: errorKind(e) });
  }
}

/** Úklid (runRetention): deník požadavků 30 dní, minutová okna limitu 1 hodinu. */
export async function cleanupApiLogs(now = new Date()): Promise<{ apiRequests: number; apiRateWindows: number }> {
  const db = getDb();
  const requests = await db.delete(schema.apiRequests).where(lt(schema.apiRequests.at, new Date(now.getTime() - 30 * 86_400_000))).returning({ id: schema.apiRequests.id });
  const windows = await db
    .delete(schema.apiRateWindows)
    .where(lt(schema.apiRateWindows.windowStart, new Date(now.getTime() - 3_600_000)))
    .returning({ id: schema.apiRateWindows.integrationId });
  return { apiRequests: requests.length, apiRateWindows: windows.length };
}
