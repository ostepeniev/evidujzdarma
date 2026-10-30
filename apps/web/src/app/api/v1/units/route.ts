import { apiRoute } from "@/lib/server/api/http";
import { listUnits } from "@/lib/server/api/v1";

/** GET /v1/units – jen jednotky z oprávnění integrace a zda jsou připravené k evidenci (S8, rozd. 3.2). */
export const GET = apiRoute({ route: "/v1/units", scope: "units:read" }, async (ctx) => ({ body: await listUnits(ctx) }));
