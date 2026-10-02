import "server-only";
import { and, count, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { DIS_OPENS, timelineAt } from "@/content/facts";
import { enqueueEmail } from "./mail";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

async function byToken(token: string) {
  if (!hasDatabase() || !TOKEN_RE.test(token)) return null;
  return (await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.confirmToken, token) })) ?? null;
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
    payload: { unsubscribeToken: row.unsubscribeToken },
    dedupeKey: `app-ready:${row.id}`,
    sendAfter: appAt > now ? appAt : now,
  });
  const disAt = new Date(`${timelineAt(DIS_OPENS).date}T08:00:00+01:00`);
  if (row.marketingConsent && !row.unsubscribedAt && disAt > now) {
    await enqueueEmail({ to: row.email, template: "dis-launch", payload: { unsubscribeToken: row.unsubscribeToken }, dedupeKey: `dis-launch:${row.id}`, sendAfter: disAt });
  }
  return true;
}
