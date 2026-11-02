import { pohodaExportResponse, pohodaParams } from "@/lib/server/pohoda-export";
import { ownerRoute } from "@/lib/server/route-helpers";

/** S11: export tržeb do POHODY (XML, beta) – denní souhrny po evidenčních jednotkách, jen ostrý provoz. */
export const GET = ownerRoute(async ({ req, accountId }) => pohodaExportResponse(accountId, pohodaParams(new URL(req.url))));
