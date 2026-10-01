import "server-only";
import { z } from "zod";
import { hasDatabase } from "@ez/db";
import { HttpError, errorResponse, requireOwnerAccount, type CurrentUser } from "./auth";

export async function parseJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
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
      if (!hasDatabase()) throw new HttpError(503, "Služba je dočasně nedostupná");
      const { user, accountId } = await requireOwnerAccount();
      return await handler({ req, user, accountId, params: await routeCtx.params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
