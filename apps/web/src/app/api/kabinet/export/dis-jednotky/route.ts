import { normalizeIco } from "@ez/cz";
import { HttpError, errorResponse, getCurrentUser } from "@/lib/server/auth";
import { linkedClientAccounts, requireAccountant } from "@/lib/server/cabinet";
import { disUnitsCsvResponse, disUnitsParams } from "@/lib/server/dis-units-export";

/**
 * S12: CSV pro hromadný import evidenčních jednotek jednoho propojeného klienta do jeho DIS+ (?klient=<IČO>).
 * Import v DIS+ provede klient, nebo účetní s oprávněním „Prohlížení a odesílání všeho“ či plným pověřením pro EET.
 */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountant(await getCurrentUser());
    const url = new URL(req.url);
    const ico = normalizeIco(url.searchParams.get("klient") ?? "");
    const client = ico ? (await linkedClientAccounts(accountId)).find((c) => c.ico === ico) : undefined;
    if (!client) throw new HttpError(404, "Klient s tímto IČO není propojený s vaším kabinetem.");
    return await disUnitsCsvResponse(client.accountId, disUnitsParams(url));
  } catch (e) {
    return errorResponse(e);
  }
}
