import { apiRoute } from "@/lib/server/api/http";
import { getSale } from "@/lib/server/api/v1";

/** GET /v1/sales/{id} – stav jedné tržby této integrace (S8, rozd. 3.4). */
export const GET = apiRoute({ route: "/v1/sales/{id}", scope: "sales:read" }, async (ctx, params) => ({ body: await getSale(ctx, params.id ?? "") }));
