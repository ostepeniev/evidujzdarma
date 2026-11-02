import { normalizeIco } from "@ez/cz";
import { HttpError, errorResponse, getCurrentUser } from "@/lib/server/auth";
import { linkedClientAccounts, requireAccountant } from "@/lib/server/cabinet";
import { pohodaExportResponse, pohodaParams } from "@/lib/server/pohoda-export";

/**
 * S11: export tržeb jednoho propojeného klienta do POHODY (XML, beta). POHODA importuje balík jen do firmy se stejným
 * IČO, proto vždy jeden klient (?klient=<IČO>). Jen klienti, kteří účetní propojení povolili.
 */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountant(await getCurrentUser());
    const url = new URL(req.url);
    const params = pohodaParams(url);
    const ico = normalizeIco(url.searchParams.get("klient") ?? "");
    const client = ico ? (await linkedClientAccounts(accountId)).find((c) => c.ico === ico) : undefined;
    if (!client) throw new HttpError(404, "Klient s tímto IČO není propojený s vaším kabinetem.");
    return await pohodaExportResponse(client.accountId, params);
  } catch (e) {
    return errorResponse(e);
  }
}
