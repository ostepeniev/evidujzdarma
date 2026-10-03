import { isNaturalPerson, isValidIco, normalizeIco } from "@ez/cz";
import { lookupCompany, type CompanyLookup } from "@/lib/server/ares";
import { assess } from "@/lib/eet-assessment";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/**
 * Fyzická osoba (OSVČ): bez ulice a PSČ sídla i provozoven – jen obec a kraj, stejně jako v nástroji a v MCP
 * (inv. 11, R7.11). Hodnocení EET se počítá z úplných dat, ven jde jen tento výřez.
 */
function publicView<T extends CompanyLookup>(found: T): T {
  if (!isNaturalPerson(found.subject.legalForm)) return found;
  const { city, regionCode, regionName } = found.subject.address;
  return {
    ...found,
    subject: { ...found.subject, address: { city, regionCode, regionName } },
    rzp: found.rzp ? { ...found.rzp, establishments: found.rzp.establishments.map((e) => ({ ...e, address: { city: e.address.city } })) } : found.rzp,
  } as T;
}

export async function GET(req: Request, ctx: RouteContext<"/api/ico/[ico]">) {
  const { ico: raw } = await ctx.params;
  const ico = normalizeIco(raw);
  if (!ico || !isValidIco(ico)) return Response.json({ error: "Neplatné IČO" }, { status: 400 });
  if (!rateLimit(`ico:${clientIp(req)}`, 30, 60)) return Response.json({ error: "Příliš mnoho dotazů" }, { status: 429 });
  try {
    const found = await lookupCompany(ico);
    if (!found) return Response.json({ error: "Subjekt s tímto IČO v ARES není" }, { status: 404 });
    return Response.json(
      { ...publicView(found), assessment: assess(found.subject, found.rzp) },
      { headers: { "cache-control": "private, max-age=300" } },
    );
  } catch {
    return Response.json({ error: "Registr ARES je dočasně nedostupný, zkuste to prosím za chvíli." }, { status: 503 });
  }
}
