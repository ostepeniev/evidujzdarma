import { and, eq, inArray } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";

/** Odhlášení z e-mailů. GET = odkaz v e-mailu, POST = RFC 8058 one-click (List-Unsubscribe-Post). */
async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token || !hasDatabase() || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false;
  const db = getDb();
  const rows = await db
    .update(schema.preregistrations)
    .set({ unsubscribedAt: new Date(), marketingConsent: false })
    .where(eq(schema.preregistrations.unsubscribeToken, token))
    .returning({ email: schema.preregistrations.email });
  const email = rows[0]?.email;
  if (!email) return false;
  await db
    .update(schema.emailOutbox)
    .set({ status: "cancelled" })
    .where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.status, "queued"), inArray(schema.emailOutbox.template, ["dis-launch", "app-ready"])));
  return true;
}

export async function GET(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("token"));
  const html = `<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Odhlášení</title>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#14211c;text-align:center">
<h1>${ok ? "Odhlášeno" : "Odkaz je neplatný"}</h1><p>${ok ? "Další e-maily vám už posílat nebudeme." : "Odkaz pro odhlášení je neplatný nebo už byl použit."}</p>
<p><a href="/" style="color:#0b7a57">Zpět na EvidujZdarma</a></p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(req: Request) {
  await unsubscribe(new URL(req.url).searchParams.get("token"));
  return new Response(null, { status: 204 });
}
