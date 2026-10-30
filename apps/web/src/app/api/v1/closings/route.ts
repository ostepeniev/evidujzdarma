import { apiRoute } from "@/lib/server/api/http";
import { listClosings } from "@/lib/server/api/v1";

/** GET /v1/closings – denní přehledy tržeb této integrace (S8, rozd. 3.6); uzávěrku dne má PMS svou. */
export const GET = apiRoute({ route: "/v1/closings", scope: "closings:read" }, async (ctx) => ({ body: await listClosings(ctx) }));
