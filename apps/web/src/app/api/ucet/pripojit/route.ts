import { HttpError, getCurrentUser } from "@/lib/server/auth";
import { checkAuthorize, issueCode, ownerAccounts, returnUrl } from "@/lib/server/oauth";
import { requireSameOrigin } from "@/lib/server/route-helpers";

const text = (status: number, message: string) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
const back = (url: string) => new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });

/**
 * Souhlas vlastníka s připojením aplikace (S8, rozd. 6): formulář z /pripojit. Povolit → 303 na redirect_uri s code
 * a state; Zrušit → error=access_denied. Neznámý klient nebo cizí redirect_uri → chyba bez přesměrování.
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await getCurrentUser();
    if (!user) return text(401, "Nejste přihlášeni.");
    const form = new URLSearchParams(await req.text());
    const params = Object.fromEntries(form);
    const check = await checkAuthorize(params);
    if (check.kind === "fatal") return text(400, check.message);
    if (check.kind === "redirect_error") return back(returnUrl(check.redirectUri, { error: check.error, error_description: check.description, state: check.state }));
    if (form.get("decision") !== "allow") return back(returnUrl(check.redirectUri, { error: "access_denied", state: check.state }));
    const accounts = ownerAccounts(user);
    const accountId = form.get("account") || (accounts.length === 1 ? accounts[0]!.accountId : "");
    const code = await issueCode(user, accountId, check, form.getAll("unitIds"));
    return back(returnUrl(check.redirectUri, { code, state: check.state }));
  } catch (e) {
    if (e instanceof HttpError) return text(e.status === 401 ? 401 : e.status === 403 ? 403 : 400, e.message);
    console.error("[oauth] souhlas", { error: e instanceof Error ? e.name : typeof e });
    return text(500, "Interní chyba serveru.");
  }
}
