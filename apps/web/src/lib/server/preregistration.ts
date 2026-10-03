import "server-only";
import { and, count, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { DIS_OPENS, timelineAt } from "@/content/facts";
import { isInterest, type Interest } from "@/lib/interests";
import { enqueueEmail } from "./mail";
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
 */
export function unsubscribeTokenFor(id: string): string {
  return `${id}.${hmac(`unsubscribe:${id}`)}`;
}

const SIGNED_UNSUBSCRIBE_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

/** Podmínka na řádek předregistrace podle odhlašovacího tokenu (null = neplatný token). */
export function unsubscribeWhere(token: string) {
  const signed = SIGNED_UNSUBSCRIBE_RE.exec(token);
  if (signed) return safeEqual(token, unsubscribeTokenFor(signed[1]!)) ? eq(schema.preregistrations.id, signed[1]!) : null;
  return TOKEN_RE.test(token) ? eq(schema.preregistrations.unsubscribeTokenHash, sha256(token)) : null;
}

export function isUnsubscribeTokenShape(token: string): boolean {
  return SIGNED_UNSUBSCRIBE_RE.test(token) || TOKEN_RE.test(token);
}

async function byToken(token: string) {
  if (!hasDatabase() || !TOKEN_RE.test(token)) return null;
  const row = await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.confirmTokenHash, sha256(token)) });
  if (!row) return null;
  // nepotvrzený odkaz po 30 dnech neplatí (nový přijde po opětovném vyplnění formuláře)
  if (!row.confirmedAt && Date.now() - row.confirmTokenIssuedAt.getTime() > CONFIRM_TOKEN_TTL_MS) return null;
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
  const asked = await db
    .select({ campaign: schema.preregistrationInterests.campaign })
    .from(schema.preregistrationInterests)
    .where(eq(schema.preregistrationInterests.preregistrationId, row.id));
  const interests = asked.map((i) => i.campaign).filter(isInterest);
  return { confirmed: !!row.confirmedAt, position: before + 1, referralCode: row.referralCode, referrals, interests };
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
  if (!prereg || prereg.unsubscribedAt) return null;
  return { interest, campaign: interest.campaign as Interest, prereg };
}

/** Stav zájmu pro stránku /registrace/zajem – jen čte (Р5). */
export async function lookupInterest(token: string): Promise<{ campaign: Interest; confirmed: boolean } | null> {
  const r = await interestByToken(token);
  return r ? { campaign: r.campaign, confirmed: !!r.interest.confirmedAt } : null;
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
  const disAt = new Date(`${timelineAt(DIS_OPENS).date}T08:00:00+01:00`);
  if (row.marketingConsent && !row.unsubscribedAt && disAt > now) {
    await enqueueEmail({ to: row.email, template: "dis-launch", payload: { unsubscribeToken: unsubscribeTokenFor(row.id) }, dedupeKey: `dis-launch:${row.id}`, sendAfter: disAt });
  }
  return true;
}
