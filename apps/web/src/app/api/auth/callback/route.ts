import { NextResponse } from "next/server";
import { SESSION_COOKIE, consumeLoginToken, sessionCookieOptions } from "@/lib/server/auth";
import { SITE_URL } from "@/lib/site";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const result = /^[A-Za-z0-9_-]{30,64}$/.test(token) ? await consumeLoginToken(token, req.headers.get("user-agent")) : null;
  if (!result) return NextResponse.redirect(`${SITE_URL}/prihlaseni?chyba=odkaz`, 303);
  const res = NextResponse.redirect(`${SITE_URL}${result.redirectTo ?? "/pokladna/nastaveni"}`, 303);
  res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return res;
}
