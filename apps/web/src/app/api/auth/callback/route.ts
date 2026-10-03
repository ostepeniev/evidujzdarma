import { NextResponse } from "next/server";
import { LOGIN_NONCE_COOKIE, SESSION_COOKIE, consumeLoginToken, errorResponse, sessionCookieOptions } from "@/lib/server/auth";
import { requireSameOrigin } from "@/lib/server/route-helpers";
import { SITE_URL } from "@/lib/site";

const TOKEN_RE = /^[A-Za-z0-9_-]{30,64}$/;

/** Starší odkazy z e-mailů: jen přesměrování na potvrzovací stránku, token se nespotřebuje (R3.7). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return NextResponse.redirect(`${SITE_URL}/prihlaseni?chyba=odkaz`, 303);
  return NextResponse.redirect(`${SITE_URL}/prihlaseni/overeni?token=${encodeURIComponent(token)}`, 303);
}

function cookieValue(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Dokončení přihlášení tlačítkem: token + nonce z cookie prohlížeče, který o odkaz požádal. */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req); // i mimo proxy.ts (Д3-8)
  } catch (e) {
    return errorResponse(e);
  }
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const nonce = cookieValue(req, LOGIN_NONCE_COOKIE);
  const result = TOKEN_RE.test(token) ? await consumeLoginToken(token, nonce, req.headers.get("user-agent")) : null;
  if (!result) return NextResponse.redirect(`${SITE_URL}/prihlaseni?chyba=${nonce ? "odkaz" : "prohlizec"}`, 303);
  const res = NextResponse.redirect(`${SITE_URL}${result.redirectTo ?? "/pokladna/nastaveni"}`, 303);
  res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  res.cookies.delete(LOGIN_NONCE_COOKIE);
  return res;
}
