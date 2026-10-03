import "server-only";
import { z } from "zod";
import { hasDatabase } from "@ez/db";
import { HttpError, errorResponse, requireOwnerAccount, type CurrentUser } from "./auth";
import { API_BODY_LIMIT, sameOrigin } from "./request-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Změny přes cookie session jen z našeho původu – i mimo proxy.ts (obrana do hloubky; B Дрібне 1, Д3-8). */
export function requireSameOrigin(req: Request): void {
  if (!["GET", "HEAD"].includes(req.method.toUpperCase()) && !sameOrigin(req)) throw new HttpError(403, "Požadavek z cizí stránky byl odmítnut.");
}

/** [id] v cestě musí být UUID – jinak 404 dřív, než se sáhne do DB (B Дрібне 3, Д3-2). */
export function assertUuidParam(id: unknown): void {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new HttpError(404, "Nenalezeno");
}

export async function parseJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  // i bez proxy (jiný matcher, přímé volání) se velké tělo nečte (Н2-2)
  if (Number(req.headers.get("content-length") ?? "0") > API_BODY_LIMIT) throw new HttpError(413, "Požadavek je příliš velký.");
  const body = await req.json().catch(() => {
    throw new HttpError(400, "Neplatný požadavek");
  });
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Neplatná data");
  return r.data;
}

/** Obal pro API vlastníka účtu: ověří session a převede chyby na JSON odpovědi. */
export function ownerRoute<C = unknown>(handler: (ctx: { req: Request; user: CurrentUser; accountId: string; params: C }) => Promise<Response>) {
  return async (req: Request, routeCtx: { params: Promise<C> }) => {
    try {
      const params = await routeCtx.params;
      // [id] je vždy UUID – jinak 404, ne 500 s parametry SQL v logu (B Дрібне 3)
      const id = (params as { id?: unknown } | undefined)?.id;
      if (typeof id === "string" && !UUID_RE.test(id)) throw new HttpError(404, "Nenalezeno");
      // obrana do hloubky ke kontrole v proxy.ts: změny jen z našeho původu (B Дрібне 1)
      requireSameOrigin(req);
      if (!hasDatabase()) throw new HttpError(503, "Služba je dočasně nedostupná");
      const { user, accountId } = await requireOwnerAccount();
      return await handler({ req, user, accountId, params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
