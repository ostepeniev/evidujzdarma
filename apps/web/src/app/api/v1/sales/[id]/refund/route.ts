import { apiRoute } from "@/lib/server/api/http";
import { refundSale } from "@/lib/server/api/v1";

/** POST /v1/sales/{id}/refund – celá nebo částečná vratka tržby této integrace (S8, rozd. 3.5). */
export const POST = apiRoute({ route: "/v1/sales/{id}/refund", scope: "refunds:write" }, async (ctx, params) => ({ body: await refundSale(ctx, params.id ?? "") }));
