import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { INTERESTS, INTEREST_NEXT, isForPos, type Interest } from "@/lib/interests";
import { MARKETING_TEMPLATES } from "@/lib/server/mail";
import { isUnsubscribeTokenShape, ownInterests, parseUnsubscribe, type UnsubscribeScope } from "@/lib/server/preregistration";
import { NOT_CONSENT_PROOF } from "@/lib/server/prereg-proof";
import { randomToken, sha256, shortCode } from "@/lib/server/tokens";
import { SITE, operatorLine } from "@/lib/site";

/**
 * Odhlášení z e-mailů (R8.2). GET jen zobrazí stránku s volbou (GET nesmí měnit stav – Р5), POST provede:
 *  - „Odhlásit jen novinky“ (záznam se souhlasem) = odvolání souhlasu; předregistrace, pořadí, zájmy, app-ready a kód zůstávají;
 *  - „Zrušit předregistraci“ = záznam-blokace (R7.3): zůstane e-mail, datum předregistrace a zrušení (a doklad souhlasu).
 * One-click z poštovního klienta (RFC 8058, List-Unsubscribe-Post) dělá to, co říká rozsah podepsaného odkazu:
 * z obchodního sdělení jen odvolání souhlasu, ze služebního e-mailu zrušení předregistrace.
 * Opakované odhlášení nic neposouvá (Д-1).
 */
type Outcome = "news" | "cancelled";

async function findRow(token: string | null) {
  const parsed = token && hasDatabase() ? parseUnsubscribe(token) : null;
  if (!parsed) return null;
  // doklad o odvolaném souhlasu se odkazem nezruší – jinak by z něj „Zrušit“ udělal novou 3letou blokaci (R9.3)
  const row = await getDb().query.preregistrations.findFirst({ where: and(parsed.where, NOT_CONSENT_PROOF) });
  return row ? { row, scope: parsed.scope } : null;
}

type Row = NonNullable<Awaited<ReturnType<typeof findRow>>>["row"];

/** Odvolání souhlasu s novinkami: zruší jen obchodní sdělení ve frontě; datum odvolání se při opakování nemění. */
async function withdrawConsent(row: Row): Promise<void> {
  const db = getDb();
  await db
    .update(schema.preregistrations)
    .set({ marketingConsent: false, marketingConsentWithdrawnAt: new Date() })
    .where(and(eq(schema.preregistrations.id, row.id), eq(schema.preregistrations.marketingConsent, true), isNull(schema.preregistrations.unsubscribedAt)));
  await db
    .update(schema.emailOutbox)
    .set({ status: "cancelled", lastError: "CONSENT_WITHDRAWN" })
    .where(and(eq(schema.emailOutbox.to, row.email), eq(schema.emailOutbox.status, "queued"), inArray(schema.emailOutbox.template, [...MARKETING_TEMPLATES])));
}

async function cancelPreregistration(row: Row): Promise<void> {
  const db = getDb();
  const now = new Date();
  // Zrušení neprodlužuje uchování předregistrace (R7.3): zůstane jen adresa, datum předregistrace a zrušení (abychom nic
  // neposlali), u udělaného souhlasu navíc jeho doklad a odvolání. Povinné sloupce dostanou náhodné hodnoty, které nikam
  // nevedou; datum potvrzovacího odkazu a jazyk se mažou (Д-6). Už zrušený záznam se nemění (Д-1).
  const rows = await db
    .update(schema.preregistrations)
    .set({
      unsubscribedAt: now,
      marketingConsent: false,
      ...(row.marketingConsentAt && !row.marketingConsentWithdrawnAt ? { marketingConsentWithdrawnAt: now } : {}),
      ico: null,
      companyName: null,
      industry: null,
      establishmentsCount: null,
      needs: [],
      utm: null,
      referredBy: null,
      referralCode: shortCode(8),
      confirmTokenHash: sha256(randomToken()),
      confirmTokenIssuedAt: null,
      locale: null,
      ...(row.marketingConsentAt ? {} : { confirmedAt: null, consentEvidence: null }),
    })
    .where(and(eq(schema.preregistrations.id, row.id), isNull(schema.preregistrations.unsubscribedAt)))
    .returning({ id: schema.preregistrations.id });
  if (!rows.length) return;
  // i zájem (webinář, kabinet) patří k údajům předregistrace (R7.4)
  await db.delete(schema.preregistrationInterests).where(eq(schema.preregistrationInterests.preregistrationId, row.id));
  await db
    .update(schema.emailOutbox)
    .set({ status: "cancelled", lastError: "UNSUBSCRIBED" })
    .where(and(eq(schema.emailOutbox.to, row.email), eq(schema.emailOutbox.status, "queued"), inArray(schema.emailOutbox.template, ["dis-launch", "app-ready"])));
}

async function unsubscribe(token: string | null, action: UnsubscribeScope | null): Promise<Outcome | null> {
  const found = await findRow(token);
  if (!found) return null;
  if (found.row.unsubscribedAt) return "cancelled";
  if ((action ?? found.scope) === "news") {
    await withdrawConsent(found.row);
    return "news";
  }
  await cancelPreregistration(found.row);
  return "cancelled";
}

const RESULT: Record<Outcome, string> = {
  news: "Odhlášeno z novinek. Předregistrace zůstává.",
  cancelled: "Předregistrace je zrušená. Už vám nic nepošleme.",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#14211c;text-align:center">
<h1>${title}</h1>${body}<p><a href="/" style="color:#0b7a57">Zpět na EvidujZdarma</a></p>
<p style="margin-top:3em;font-size:13px;color:#66756e">${esc(SITE.independenceNotice)} Provozovatel: ${esc(operatorLine())}.</p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * Co zůstane po „Odhlásit jen novinky“ – slib jen toho, co opravdu přijde (R9.7): A = app-ready ve frontě (odkaz na pokladnu),
 * B = potvrzené zájmy mimo pokladnu (její slib platí jen s A – app-ready mohl už odejít), C = nic z toho.
 */
async function newsNote(row: Row, interests: readonly Interest[]): Promise<string> {
  const [appReady] = await getDb()
    .select({ id: schema.emailOutbox.id })
    .from(schema.emailOutbox)
    .where(and(eq(schema.emailOutbox.dedupeKey, `app-ready:${row.id}`), eq(schema.emailOutbox.status, "queued")))
    .limit(1);
  if (appReady) return "Předregistrace zůstane: pošleme vám odkaz, až pokladnu spustíme.";
  const next = row.confirmedAt ? INTERESTS.filter((i) => i !== "pokladna" && interests.includes(i)) : [];
  return next.length ? `Předregistrace zůstane. ${next.map((i) => INTEREST_NEXT[i]).join(" ")}` : "Předregistrace zůstane. Dál vám pošleme jen e-maily, které se jí týkají.";
}

const TITLE = "Odhlášení z e-mailů";
const BUTTON = "background:#0b7a57;color:#fff;border:0;padding:12px 20px;border-radius:10px;font-weight:600;font-size:16px;cursor:pointer";
const BUTTON_SECONDARY = "background:#fff;color:#14211c;border:1px solid #c9d3cd;padding:12px 20px;border-radius:10px;font-weight:600;font-size:16px;cursor:pointer";

function choice(token: string, action: UnsubscribeScope, label: string, note: string, style: string): string {
  return `<form method="post" action="/api/odhlasit?token=${esc(encodeURIComponent(token))}" style="margin:24px 0 0"><input type="hidden" name="action" value="${action}">
<button type="submit" style="${style}">${esc(label)}</button></form><p style="font-size:15px;color:#3d4a44;margin:8px 0 0">${esc(note)}</p>`;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const found = isUnsubscribeTokenShape(token) ? await findRow(token) : null;
  if (!found) return page("Odkaz je neplatný", "<p>Odkaz pro odhlášení je neplatný nebo neúplný.</p>");
  const { row } = found;
  if (row.unsubscribedAt) return page(TITLE, `<p>${esc(RESULT.cancelled)}</p>`);
  const interests = await ownInterests(row);
  // pořadí a odkaz pro pozvání má jen předregistrace k pokladně – jako na stránce stavu (R9.9)
  const forPos = isForPos(interests);
  if (row.marketingConsent) {
    return page(
      TITLE,
      `<p>Můžete se odhlásit jen z novinek k EET, nebo zrušit celou předregistraci.</p>
${choice(token, "news", "Odhlásit jen novinky", await newsNote(row, interests), BUTTON)}
${choice(
  token,
  "all",
  "Zrušit předregistraci",
  forPos
    ? "Přijdete o pořadí na včasný přístup, odkaz pro pozvání kolegů a přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali."
    : "Přijdete o přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali.",
  BUTTON_SECONDARY,
)}`,
    );
  }
  return page(
    TITLE,
    `<p>${
      forPos
        ? "Posíláme vám jen e-maily k vaší předregistraci. Odhlášením ji zrušíte: přijdete o pořadí na včasný přístup, odkaz pro pozvání kolegů a přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali."
        : "Posíláme vám jen e-maily k vaší předregistraci. Odhlášením ji zrušíte i s přihláškami (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali."
    }</p>
<form method="post" action="/api/odhlasit?token=${esc(encodeURIComponent(token))}"><input type="hidden" name="action" value="all">
<button type="submit" style="${BUTTON}">Zrušit předregistraci</button></form>`,
  );
}

export async function POST(req: Request) {
  const body = await req.text().catch(() => "");
  // One-click z poštovního klienta čeká jen stavový kód; rozsah určí podepsaný odkaz
  const oneClick = body.includes("List-Unsubscribe=One-Click");
  const action = new URLSearchParams(body).get("action");
  const outcome = await unsubscribe(new URL(req.url).searchParams.get("token"), oneClick ? null : action === "news" || action === "all" ? action : null);
  if (oneClick) return new Response(null, { status: outcome ? 204 : 404 });
  return outcome ? page(TITLE, `<p>${esc(RESULT[outcome])}</p>`) : page("Odkaz je neplatný", "<p>Odkaz pro odhlášení je neplatný.</p>");
}
