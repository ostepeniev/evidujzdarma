import { apiRoute } from "@/lib/server/api/http";
import { listSales, submitSales } from "@/lib/server/api/v1";

/** POST /v1/sales – 1–100 tržeb; evidence, fronta a podpis jsou tytéž jako u pokladny (S8, rozd. 3.3). */
export const POST = apiRoute({ route: "/v1/sales", scope: "sales:write" }, async (ctx) => ({ body: await submitSales(ctx) }));

/** GET /v1/sales – stav tržeb této integrace s filtry a kurzorem (S8, rozd. 3.4). */
export const GET = apiRoute({ route: "/v1/sales", scope: "sales:read" }, async (ctx) => ({ body: await listSales(ctx) }));
