import "server-only";
import { and, count, eq, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { timelineAt } from "@/content/facts";
import { isInterest, type Interest } from "@/lib/interests";
import { enqueueEmail } from "./mail";
import { isConsentProof } from "./prereg-proof";
import { hmac, randomToken, safeEqual, sha256 } from "./tokens";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
/** Nepotvrzený potvrzovací odkaz platí 30 dní od vydání (B Дрібне 9). Po potvrzení dál ukazuje stav. */
export const CONFIRM_TOKEN_TTL_MS = 30 * 86_400_000;

/** Nový potvrzovací token: do e-mailu jde token, do DB jen jeho SHA-256 (B Дрібне 9). */
export function issueConfirmToken(): { token: string; hash: string } {
  const token = randomToken(24);
  return { token, hash: sha256(token) };
}

/**
 * Odhlašovací token = id + podpis (HMAC s APP_SECRET) – v DB se nic neukládá a odkaz jde vytvořit pro každý
 * e-mail znovu. Starší odkazy (náhodný token) se ověřují podle uloženého hashe.
 *
 * Rozsah je v podepsaném odkazu (R8.2): tento (i starší odkazy) patří do služebních e-mailů – one-click z nich zruší
 * předregistraci. Obchodní sdělení nesou `newsUnsubscribeTokenFor` – one-click z nich jen odvolá souhlas s novinkami.
 */
export function unsubscribeTokenFor(id: string): string {
  return `${id}.${hmac(`unsubscribe:${id}`)}`;
}

/** Odhlašovací odkaz obchodního sdělení: one-click odvolá jen souhlas s novinkami, předregistrace zůstane (R8.2). */
export function newsUnsubscribeTokenFor(id: string): string {
  return `${id}.n.${hmac(`unsubscribe:news:${id}`)}`;
}

/** news = odvolat souhlas s novinkami; all = zrušit předregistraci (záznam-blokace, R7.3). */
export type UnsubscribeScope = "news" | "all";

const SIGNED_UNSUBSCRIBE_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;
const SIGNED_NEWS_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.n\.([A-Za-z0-9_-]{43})$/;

/**
 * Odkaz na stránku stavu potvrzené předregistrace = id + podpis (R7.16, B M4). Připomenutí po opětovném vyplnění
 * formuláře (to může udělat kdokoli) ho nese místo nového potvrzovacího tokenu – uložený token se u potvrzeného
 * záznamu nemění, takže odkaz, který vlastník už má, platí dál. Platí jen pro potvrzený záznam a nic nepotvrzuje.
 */
export function statusTokenFor(id: string): string {
  return `${id}.${hmac(`status:${id}`)}`;
}

/** Řádek předregistrace a rozsah podle odhlašovacího tokenu (null = neplatný token). */
export function parseUnsubscribe(token: string): { where: SQL; scope: UnsubscribeScope } | null {
  const news = SIGNED_NEWS_RE.exec(token);
  if (news) return safeEqual(token, newsUnsubscribeTokenFor(news[1]!)) ? { where: eq(schema.preregistrations.id, news[1]!), scope: "news" } : null;
  const signed = SIGNED_UNSUBSCRIBE_RE.exec(token);
  if (signed) return safeEqual(token, unsubscribeTokenFor(signed[1]!)) ? { where: eq(schema.preregistrations.id, signed[1]!), scope: "all" } : null;
  return TOKEN_RE.test(token) ? { where: eq(schema.preregistrations.unsubscribeTokenHash, sha256(token)), scope: "all" } : null;
}

/** Podmínka na řádek předregistrace podle odhlašovacího tokenu (null = neplatný token). */
export function unsubscribeWhere(token: string) {
  return parseUnsubscribe(token)?.where ?? null;
}

export function isUnsubscribeTokenShape(token: string): boolean {
  return SIGNED_NEWS_RE.test(token) || SIGNED_UNSUBSCRIBE_RE.test(token) || TOKEN_RE.test(token);
}

async function byToken(token: string) {
  if (!hasDatabase()) return null;
  const signed = SIGNED_UNSUBSCRIBE_RE.exec(token);
  if (signed) {
    if (!safeEqual(token, statusTokenFor(signed[1]!))) return null;
    const row = await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.id, signed[1]!) });
    // doklad o odvolaném souhlasu má confirmed_at, ale předregistrace to už není (R9.3)
    return row?.confirmedAt && !isConsentProof(row) ? row : null;
  }
  if (!TOKEN_RE.test(token)) return null;
  const row = await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.confirmTokenHash, sha256(token)) });
  if (!row || isConsentProof(row)) return null;
  // nepotvrzený odkaz po 30 dnech neplatí (nový přijde po opětovném vyplnění formuláře)
  if (!row.confirmedAt && (!row.confirmTokenIssuedAt || Date.now() - row.confirmTokenIssuedAt.getTime() > CONFIRM_TOKEN_TTL_MS)) return null;
  return row;
}

/** Stav předregistrace pro stránku potvrzení – jen čte, nic nemění (GET nesmí měnit stav, Р5). */
export async function lookupPreregistration(token: string) {
  const row = await byToken(token);
  if (!row) return null;
  const db = getDb();
  const [{ value: before } = { value: 0 }] = await db
    .select({ value: count() })
    .from(schema.preregistrations)
    .where(lt(schema.preregistrations.createdAt, row.createdAt));
  const [{ value: referrals } = { value: 0 }] = await db
    .select({ value: count() })
    .from(schema.preregistrations)
    .where(and(eq(schema.preregistrations.referredBy, row.referralCode), sql`${schema.preregistrations.confirmedAt} is not null`));
  const interests = await ownInterests(row);
  return { confirmed: !!row.confirmedAt, position: before + 1, referralCode: row.referralCode, referrals, interests };
}

/**
 * Zájmy, které adresa vidí jako své – stránka stavu i odhlášení (R9.7). Potvrzená adresa: jen potvrzené zájmy; nepotvrzená:
 * jen ty, které potvrdí její DOI (bez vlastního tokenu) – zájem, který k adrese přidal někdo jiný, se neukáže, dokud ho
 * vlastník nepotvrdí (R8.4, Д-2).
 */
export async function ownInterests(row: { id: string; confirmedAt: Date | null }): Promise<Interest[]> {
  const asked = await getDb()
    .select({ campaign: schema.preregistrationInterests.campaign })
    .from(schema.preregistrationInterests)
    .where(
      and(
        eq(schema.preregistrationInterests.preregistrationId, row.id),
        row.confirmedAt ? isNotNull(schema.preregistrationInterests.confirmedAt) : isNull(schema.preregistrationInterests.confirmTokenHash),
      ),
    );
  return asked.map((i) => i.campaign).filter(isInterest);
}

/** „Pokladna je připravena“ – jen pro předregistraci k pokladně (R7.4, Z3), po potvrzení e-mailu. */
async function scheduleAppReady(row: { id: string; email: string }) {
  const now = new Date();
  const appAt = new Date(`${timelineAt("2026-12-01").date}T08:00:00+01:00`);
  await enqueueEmail({
    to: row.email,
    template: "app-ready",
    payload: { unsubscribeToken: unsubscribeTokenFor(row.id) },
    dedupeKey: `app-ready:${row.id}`,
    sendAfter: appAt > now ? appAt : now,
  });
}

async function interestByToken(token: string) {
  if (!hasDatabase() || !TOKEN_RE.test(token)) return null;
  const db = getDb();
  const interest = await db.query.preregistrationInterests.findFirst({ where: eq(schema.preregistrationInterests.confirmTokenHash, sha256(token)) });
  if (!interest || !isInterest(interest.campaign)) return null;
  // nepotvrzený odkaz platí 30 dní, jako potvrzení předregistrace
  if (!interest.confirmedAt && Date.now() - interest.requestedAt.getTime() > CONFIRM_TOKEN_TTL_MS) return null;
  const prereg = await db.query.preregistrations.findFirst({ where: eq(schema.preregistrations.id, interest.preregistrationId) });
  if (!prereg || prereg.unsubscribedAt || isConsentProof(prereg)) return null;
  return { interest, campaign: interest.campaign as Interest, prereg };
}

/** Stav zájmu pro stránku /registrace/zajem – jen čte (Р5). */
export async function lookupInterest(token: string): Promise<{ campaign: Interest; confirmed: boolean } | null> {
  const r = await interestByToken(token);
  return r ? { campaign: r.campaign, confirmed: !!r.interest.confirmedAt } : null;
}

/**
 * Žádost o potvrzení zájmu vlastním odkazem (R7.4, R8.4): nový nebo dosud nepotvrzený zájem → e-mail „interest-confirm“
 * s odkazem na /registrace/zajem, nejvýš jednou denně. Vrací false, je-li zájem už potvrzený.
 */
export async function requestInterestConfirmation(prereg: { id: string; email: string }, campaign: Interest, now = new Date()): Promise<boolean> {
  const db = getDb();
  const where = and(eq(schema.preregistrationInterests.preregistrationId, prereg.id), eq(schema.preregistrationInterests.campaign, campaign));
  const has = await db.query.preregistrationInterests.findFirst({ where });
  if (has?.confirmedAt) return false;
  const fresh = issueConfirmToken();
  // nový zájem rovnou s vlastním tokenem – DOI ho nepotvrdí
  if (!has) await db.insert(schema.preregistrationInterests).values({ preregistrationId: prereg.id, campaign, confirmTokenHash: fresh.hash, requestedAt: now }).onConflictDoNothing();
  const sent = await enqueueEmail({
    to: prereg.email,
    template: "interest-confirm",
    payload: { interest: campaign, confirmToken: fresh.token, unsubscribeToken: unsubscribeTokenFor(prereg.id) },
    dedupeKey: `interest-confirm:${prereg.id}:${campaign}:${now.toISOString().slice(0, 10)}`,
  });
  if (sent && has) await db.update(schema.preregistrationInterests).set({ confirmTokenHash: fresh.hash, requestedAt: now }).where(where);
  return true;
}

/** Potvrzení zájmu už známé adresy (R7.4) – jen POSTem. Záznam předregistrace se nemění. */
export async function confirmInterest(token: string): Promise<boolean> {
  const r = await interestByToken(token);
  if (!r) return false;
  if (r.interest.confirmedAt) return true;
  const updated = await getDb()
    .update(schema.preregistrationInterests)
    .set({ confirmedAt: new Date() })
    .where(and(eq(schema.preregistrationInterests.id, r.interest.id), isNull(schema.preregistrationInterests.confirmedAt)))
    .returning({ id: schema.preregistrationInterests.id });
  if (updated.length && r.campaign === "pokladna" && r.prereg.confirmedAt) await scheduleAppReady(r.prereg);
  return true;
}

/**
 * Potvrzení e-mailu (DOI) – jen přes POST. Teprve teď se plánují e-maily k termínům:
 * včasný přístup k pokladně (o který si uživatel řekl) a s marketingovým souhlasem i informace k DIS+.
 */
export async function confirmPreregistration(token: string): Promise<boolean> {
  const row = await byToken(token);
  if (!row) return false;
  if (row.confirmedAt) return true;
  const db = getDb();
  const updated = await db
    .update(schema.preregistrations)
    .set({ confirmedAt: new Date() })
    .where(and(eq(schema.preregistrations.id, row.id), isNull(schema.preregistrations.confirmedAt)))
    .returning({ id: schema.preregistrations.id });
  if (!updated.length) return true;
  const now = new Date();
  // DOI potvrdí i zájem podaný spolu s předregistrací (bez vlastního tokenu) – R7.4
  const confirmed = await db
    .update(schema.preregistrationInterests)
    .set({ confirmedAt: now })
    .where(
      and(eq(schema.preregistrationInterests.preregistrationId, row.id), isNull(schema.preregistrationInterests.confirmedAt), isNull(schema.preregistrationInterests.confirmTokenHash)),
    )
    .returning({ campaign: schema.preregistrationInterests.campaign });
  const wantsPos = confirmed.some((i) => i.campaign === "pokladna");
  if (wantsPos) await scheduleAppReady(row);
  // zájmy, které k ještě nepotvrzené adrese přidalo další vyplnění formuláře (možná někdo jiný): DOI je nepotvrdí,
  // vlastník teď dostane jejich potvrzení zvlášť (R8.4, Д-3)
  const pending = await db
    .select({ campaign: schema.preregistrationInterests.campaign })
    .from(schema.preregistrationInterests)
    .where(and(eq(schema.preregistrationInterests.preregistrationId, row.id), isNull(schema.preregistrationInterests.confirmedAt), isNotNull(schema.preregistrationInterests.confirmTokenHash)));
  for (const p of pending) if (isInterest(p.campaign)) await requestInterestConfirmation(row, p.campaign, now);
  // e-mail ke spuštění DIS+ už se neplánuje podle kalendáře – tvrdí fakt o FS, spouští ho ručně provozovatel (R7.6)
  return true;
}

/**
 * E-mail „Evidence tržeb v DIS+ je spuštěná“ (dis-launch) – ruční spuštění provozovatelem po ověření, že FS
 * DIS+ skutečně spustila (R7.6). Jen potvrzeným adresám se souhlasem a bez odhlášení; při odeslání se to
 * kontroluje znovu (mail.ts). Vrací počet nově zařazených e-mailů.
 */
export async function queueDisLaunch(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.preregistrations.id, email: schema.preregistrations.email })
    .from(schema.preregistrations)
    .where(and(eq(schema.preregistrations.marketingConsent, true), isNotNull(schema.preregistrations.confirmedAt), isNull(schema.preregistrations.unsubscribedAt)));
  let queued = 0;
  for (const r of rows) {
    // obchodní sdělení: odhlášení z něj odvolá jen souhlas, předregistrace zůstane (R8.2)
    if (await enqueueEmail({ to: r.email, template: "dis-launch", payload: { unsubscribeToken: newsUnsubscribeTokenFor(r.id) }, dedupeKey: `dis-launch:${r.id}` })) queued++;
  }
  return queued;
}
