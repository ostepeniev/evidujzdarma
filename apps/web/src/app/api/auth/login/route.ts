import { NextResponse, after } from "next/server";
import { z } from "zod";
import { hasDatabase } from "@ez/db";
import { LOGIN_NONCE_COOKIE, createLoginToken, errorResponse, loginNonceCookieOptions } from "@/lib/server/auth";
import { requireSameOrigin } from "@/lib/server/route-helpers";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { SITE_URL } from "@/lib/site";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), redirectTo: z.string().max(200).optional() });

export async function POST(req: Request) {
  try {
    requireSameOrigin(req); // i mimo proxy.ts (Д3-8)
  } catch (e) {
    return errorResponse(e);
  }
  if (!hasDatabase()) return Response.json({ error: "Služba je dočasně nedostupná" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  const { email, redirectTo } = parsed.data;
  if (!rateLimit(`login:${clientIp(req)}`, 10, 600) || !rateLimit(`login-mail:${email}`, 3, 600)) {
    return Response.json({ error: "Příliš mnoho pokusů. Zkuste to za pár minut." }, { status: 429 });
  }
  const { token, nonce } = await createLoginToken(email, redirectTo);
  // Odkaz vede na stránku s tlačítkem – samotné otevření (i skenerem pošty) nic nespotřebuje (R3.7)
  await enqueueEmail({
    to: email,
    template: "login-link",
    payload: { url: `${SITE_URL}/prihlaseni/overeni?token=${encodeURIComponent(token)}` },
  });
  after(() => processOutbox(5));
  // Stejná odpověď pro existující i nové e-maily (neprozrazujeme registrace).
  const res = NextResponse.json({ ok: true });
  // přihlášení dokončí jen prohlížeč, který o odkaz požádal
  res.cookies.set(LOGIN_NONCE_COOKIE, nonce, loginNonceCookieOptions());
  return res;
}
