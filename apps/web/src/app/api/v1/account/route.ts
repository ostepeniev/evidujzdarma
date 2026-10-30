import { apiRoute } from "@/lib/server/api/http";
import { accountInfo } from "@/lib/server/api/v1";

/** GET /v1/account – prostředí tokenu, maskované EIČ, stav certifikátu a oprávnění integrace (S8, rozd. 3.1). */
export const GET = apiRoute({ route: "/v1/account", scope: null }, async (ctx) => ({ body: await accountInfo(ctx) }));
