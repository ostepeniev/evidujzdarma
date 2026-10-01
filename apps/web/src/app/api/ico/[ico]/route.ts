import { isValidIco, normalizeIco } from "@ez/cz";
import { lookupCompany } from "@/lib/server/ares";
import { assess } from "@/lib/eet-assessment";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export async function GET(req: Request, ctx: RouteContext<"/api/ico/[ico]">) {
  const { ico: raw } = await ctx.params;
  const ico = normalizeIco(raw);
  if (!ico || !isValidIco(ico)) return Response.json({ error: "Neplatné IČO" }, { status: 400 });
  if (!rateLimit(`ico:${clientIp(req)}`, 30, 60)) return Response.json({ error: "Příliš mnoho dotazů" }, { status: 429 });
  try {
    const found = await lookupCompany(ico);
    if (!found) return Response.json({ error: "Subjekt s tímto IČO v ARES není" }, { status: 404 });
    return Response.json(
      { ...found, assessment: assess(found.subject, found.rzp) },
      { headers: { "cache-control": "private, max-age=300" } },
    );
  } catch {
    return Response.json({ error: "Registr ARES je dočasně nedostupný, zkuste to prosím za chvíli." }, { status: 503 });
  }
}
