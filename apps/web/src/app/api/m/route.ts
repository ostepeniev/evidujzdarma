import { CLIENT_EVENTS, recordEvent, recordTime, recordView, type FunnelEvent } from "@/lib/server/analytics";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { isJsonRequest, sameOrigin } from "@/lib/server/request-guard";

/**
 * Beacon měření návštěvnosti (R15.1) – navigator.sendBeacon z našich stránek. Bez cookies (nečte je ani nenastavuje),
 * odpověď je vždy 204 bez těla. Přijme jen JSON z našeho původu (cizí stránka potřebuje CORS preflight, který neprojde).
 *  { t: "v", p: cesta, r?: doména zdroje, u?: { s, m, c } – UTM } – zobrazení; { t: "t", p, s: sekundy, n?: 1 } – čas na stránce;
 *  { t: "e", e: událost } – quiz_done, calculator_used.
 */
const NO_CONTENT = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!isJsonRequest(req) || !sameOrigin(req)) return NO_CONTENT();
  if (!rateLimit(`m:${clientIp(req)}`, 120, 60)) return NO_CONTENT();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NO_CONTENT();
  const path = typeof body.p === "string" ? body.p : "";
  try {
    if (body.t === "v") await recordView(req.headers, { path, ref: body.r, utm: body.u });
    else if (body.t === "t") await recordTime(req.headers, { path, seconds: body.s, first: body.n === 1 });
    else if (body.t === "e" && CLIENT_EVENTS.includes(body.e as FunnelEvent)) await recordEvent(req.headers, body.e as FunnelEvent);
  } catch {
    // měření nikdy nesmí vrátit chybu stránce
  }
  return NO_CONTENT();
}
