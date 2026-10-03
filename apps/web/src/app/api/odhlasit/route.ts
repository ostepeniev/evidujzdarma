import { and, eq, inArray } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { isUnsubscribeTokenShape, unsubscribeWhere } from "@/lib/server/preregistration";
import { randomToken, sha256, shortCode } from "@/lib/server/tokens";
import { SITE, operatorLine } from "@/lib/site";

/**
 * Odhlášení z e-mailů. GET jen zobrazí stránku s tlačítkem (GET nesmí měnit stav – Р5),
 * POST odhlásí: tlačítko na stránce i RFC 8058 one-click z poštovního klienta (List-Unsubscribe-Post).
 */
async function unsubscribe(token: string | null): Promise<boolean> {
  const where = token && hasDatabase() ? unsubscribeWhere(token) : null;
  if (!where) return false;
  const db = getDb();
  const rows = await db
    .update(schema.preregistrations)
    .set({ unsubscribedAt: new Date(), marketingConsent: false })
    .where(where)
    .returning({ id: schema.preregistrations.id, email: schema.preregistrations.email, consentAt: schema.preregistrations.marketingConsentAt });
  const row = rows[0];
  if (!row) return false;
  const email = row.email;
  // Odhlášení neprodlužuje uchování předregistrace (R7.3): zůstane jen adresa a datum odhlášení (abychom nic neposlali),
  // u udělaného souhlasu navíc jeho doklad. Povinné sloupce dostanou náhodné hodnoty, které nikam nevedou.
  await db
    .update(schema.preregistrations)
    .set({
      ico: null,
      companyName: null,
      industry: null,
      establishmentsCount: null,
      needs: [],
      utm: null,
      referredBy: null,
      referralCode: shortCode(8),
      confirmTokenHash: sha256(randomToken()),
      ...(row.consentAt ? {} : { confirmedAt: null, consentEvidence: null }),
    })
    .where(eq(schema.preregistrations.id, row.id));
  // i zájem (webinář, kabinet) patří k údajům předregistrace (R7.4)
  await db.delete(schema.preregistrationInterests).where(eq(schema.preregistrationInterests.preregistrationId, row.id));
  await db
    .update(schema.emailOutbox)
    .set({ status: "cancelled", lastError: "UNSUBSCRIBED" })
    .where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.status, "queued"), inArray(schema.emailOutbox.template, ["dis-launch", "app-ready"])));
  return true;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#14211c;text-align:center">
<h1>${title}</h1>${body}<p><a href="/" style="color:#0b7a57">Zpět na EvidujZdarma</a></p>
<p style="margin-top:3em;font-size:13px;color:#66756e">${esc(SITE.independenceNotice)} Provozovatel: ${esc(operatorLine())}.</p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!isUnsubscribeTokenShape(token)) return page("Odkaz je neplatný", "<p>Odkaz pro odhlášení je neplatný nebo neúplný.</p>");
  return page(
    "Odhlásit odběr?",
    `<p>Po odhlášení vám už nebudeme posílat novinky ani upozornění k termínům EET.</p>
<form method="post" action="/api/odhlasit?token=${esc(encodeURIComponent(token))}"><input type="hidden" name="confirm" value="1">
<button type="submit" style="background:#0b7a57;color:#fff;border:0;padding:12px 20px;border-radius:10px;font-weight:600;font-size:16px;cursor:pointer">Odhlásit odběr</button></form>`,
  );
}

export async function POST(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("token"));
  const body = await req.text().catch(() => "");
  // One-click z poštovního klienta čeká jen stavový kód
  if (body.includes("List-Unsubscribe=One-Click")) return new Response(null, { status: ok ? 204 : 404 });
  return ok ? page("Odhlášeno", "<p>Další e-maily vám už posílat nebudeme.</p>") : page("Odkaz je neplatný", "<p>Odkaz pro odhlášení je neplatný nebo už byl použit.</p>");
}
