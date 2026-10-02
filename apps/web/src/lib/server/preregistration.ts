import "server-only";
import { and, count, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { DIS_OPENS, timelineAt } from "@/content/facts";
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
  return { confirmed: !!row.confirmedAt, position: before + 1, referralCode: row.referralCode, referrals };
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
  const appAt = new Date(`${timelineAt("2026-12-01").date}T08:00:00+01:00`);
  await enqueueEmail({
    to: row.email,
    template: "app-ready",
    payload: { unsubscribeToken: unsubscribeTokenFor(row.id) },
    dedupeKey: `app-ready:${row.id}`,
    sendAfter: appAt > now ? appAt : now,
  });
  const disAt = new Date(`${timelineAt(DIS_OPENS).date}T08:00:00+01:00`);
  if (row.marketingConsent && !row.unsubscribedAt && disAt > now) {
    await enqueueEmail({ to: row.email, template: "dis-launch", payload: { unsubscribeToken: unsubscribeTokenFor(row.id) }, dedupeKey: `dis-launch:${row.id}`, sendAfter: disAt });
  }
  return true;
}
