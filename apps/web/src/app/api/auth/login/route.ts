import { after } from "next/server";
import { z } from "zod";
import { hasDatabase } from "@ez/db";
import { createLoginToken } from "@/lib/server/auth";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { SITE_URL } from "@/lib/site";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), redirectTo: z.string().max(200).optional() });

export async function POST(req: Request) {
  if (!hasDatabase()) return Response.json({ error: "Služba je dočasně nedostupná" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  const { email, redirectTo } = parsed.data;
  if (!rateLimit(`login:${clientIp(req)}`, 10, 600) || !rateLimit(`login-mail:${email}`, 3, 600)) {
    return Response.json({ error: "Příliš mnoho pokusů. Zkuste to za pár minut." }, { status: 429 });
  }
  const token = await createLoginToken(email, redirectTo);
  await enqueueEmail({
    to: email,
    template: "login-link",
    payload: { url: `${SITE_URL}/api/auth/callback?token=${encodeURIComponent(token)}` },
  });
  after(() => processOutbox(5));
  // Stejná odpověď pro existující i nové e-maily (neprozrazujeme registrace).
  return Response.json({ ok: true });
}
