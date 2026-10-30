import { OAuthError, exchangeCode } from "@/lib/server/oauth";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

const HEADERS = { "cache-control": "no-store", pragma: "no-cache" };

/**
 * POST /api/v1/oauth/token – výměna autorizačního kódu za token integrace (S8, rozd. 6). Tělo
 * application/x-www-form-urlencoded (RFC 6749) nebo JSON: grant_type, code, redirect_uri, client_id, client_secret, code_verifier.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`oauth-token:${clientIp(req)}`, 30, 60)) throw new OAuthError("invalid_request", "Too many requests.", 429);
    const text = await req.text();
    if (Buffer.byteLength(text) > 16_384) throw new OAuthError("invalid_request", "Body too large.");
    const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    let form: Record<string, string>;
    if (type === "application/json") {
      const raw = JSON.parse(text || "{}") as Record<string, unknown>;
      form = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    } else {
      form = Object.fromEntries(new URLSearchParams(text));
    }
    return Response.json(await exchangeCode(form), { headers: HEADERS });
  } catch (e) {
    if (e instanceof OAuthError) return Response.json({ error: e.error, error_description: e.message }, { status: e.status, headers: HEADERS });
    if (e instanceof SyntaxError) return Response.json({ error: "invalid_request", error_description: "Invalid JSON." }, { status: 400, headers: HEADERS });
    console.error("[oauth] neočekávaná chyba", { error: e instanceof Error ? e.name : typeof e });
    return Response.json({ error: "server_error" }, { status: 500, headers: HEADERS });
  }
}
