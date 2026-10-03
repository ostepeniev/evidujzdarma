/**
 * Společné kontroly požadavků API, ještě před čtením těla (volá je proxy.ts i ownerRoute).
 *  - Н2-2: tělo nad API_BODY_LIMIT → 413 (aplikace nespoléhá jen na limit reverse proxy).
 *  - B Дрібне 1: API se session cookie mění data jen z našeho původu a jen jako JSON / multipart
 *    (SameSite=Lax nechrání subdomény ani starší prohlížeče; text/plain by byl „jednoduchý“ cross-site POST).
 * Bez importu server-only: proxy.ts běží mimo React server komponenty.
 */
import { SITE_URL } from "@/lib/site";

/** Strop těla požadavku API – stejný jako limit reverse proxy. Certifikát má vlastní, nižší limit. */
export const API_BODY_LIMIT = 1024 * 1024;

/** API přihlášené session cookie (vlastník, účetní, přihlášení) – tady platí kontrola původu. */
export const COOKIE_API = /^\/api\/(ucet|kabinet|pozvanka|auth)(\/|$)/;

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);
/** Trasy, kam posílá data obyčejný HTML formulář na našich stránkách (původ se kontroluje i tak). */
const FORM_POST = new Set(["/api/auth/callback"]);

function siteOrigin(): string | null {
  try {
    return new URL(SITE_URL).origin;
  } catch {
    return null;
  }
}

/** Host, na který se klient obrátil – za nginx z X-Forwarded-Host / Host (req.url v proxy je interní adresa). */
function requestHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  for (const h of [req.headers.get("x-forwarded-host"), req.headers.get("host")]) if (h) hosts.add(h.split(",")[0]!.trim().toLowerCase());
  try {
    hosts.add(new URL(req.url).host.toLowerCase());
  } catch {
    /* bez URL jen hlavičky */
  }
  return hosts;
}

/**
 * Veřejný POST s JSON tělem přijme jen `application/json` (R8.5, Д-5): cizí stránka pak potřebuje CORS preflight,
 * který neprojde, a formulář s `enctype="text/plain"` na cizím webu tělo nepošle.
 */
export function isJsonRequest(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase() === "application/json";
}

/** Požadavek z našeho původu? Bez hlaviček Origin i Sec-Fetch-Site jde o neprohlížečového klienta (cookie nenese sám). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    if (origin === siteOrigin()) return true;
    try {
      // schéma se nesrovnává: TLS končí na nginx; Origin podvrhnout prohlížeč nedovolí
      return requestHosts(req).has(new URL(origin).host.toLowerCase());
    } catch {
      return false; // „null“ a jiné nesmysly
    }
  }
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  return true;
}

const json = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

/** null = požadavek smí dál; jinak hotová chybová odpověď. */
export function guardApiRequest(req: Request, pathname: string): Response | null {
  if (READ_ONLY.has(req.method.toUpperCase())) return null;
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > API_BODY_LIMIT) return json(413, "Požadavek je příliš velký.");
  if (!COOKIE_API.test(pathname)) return null;
  if (!sameOrigin(req)) return json(403, "Požadavek z cizí stránky byl odmítnut.");
  const hasBody = length > 0 || req.headers.has("transfer-encoding");
  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const allowed = type === "application/json" || type === "multipart/form-data" || (type === "application/x-www-form-urlencoded" && FORM_POST.has(pathname));
  if (hasBody && !allowed) return json(415, "Nepodporovaný formát požadavku.");
  return null;
}
