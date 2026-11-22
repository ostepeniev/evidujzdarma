import { disUnitsCsvResponse, disUnitsParams } from "@/lib/server/dis-units-export";
import { ownerRoute } from "@/lib/server/route-helpers";

/** S12: CSV pro hromadný import evidenčních jednotek do DIS+ (formát GFŘ z 3. 11. 2026). */
export const GET = ownerRoute(async ({ req, accountId }) => disUnitsCsvResponse(accountId, disUnitsParams(new URL(req.url))));
