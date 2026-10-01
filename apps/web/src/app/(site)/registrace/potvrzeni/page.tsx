import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@ez/db";
import { TIMELINE } from "@/content/facts";
import { enqueueEmail } from "@/lib/server/mail";
import { SITE_URL } from "@/lib/site";
import { CopyLink } from "@/components/copy-link";

export const metadata: Metadata = { title: "Potvrzení registrace", robots: { index: false, follow: false } };

async function confirm(token: string) {
  if (!hasDatabase() || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = getDb();
  const row = await db.query.preregistrations.findFirst({ where: eq(schema.preregistrations.confirmToken, token) });
  if (!row) return null;
  if (!row.confirmedAt) {
    await db
      .update(schema.preregistrations)
      .set({ confirmedAt: new Date() })
      .where(and(eq(schema.preregistrations.id, row.id), isNull(schema.preregistrations.confirmedAt)));
    // Včasný přístup k pokladně je služba, o kterou si uživatel řekl → informační e-mail k 1. 12.
    const appDay = TIMELINE.find((t) => t.date === "2026-12-01");
    if (appDay) {
      const at = new Date(`${appDay.date}T08:00:00+01:00`);
      await enqueueEmail({
        to: row.email,
        template: "app-ready",
        payload: { unsubscribeToken: row.unsubscribeToken },
        dedupeKey: `app-ready:${row.id}`,
        sendAfter: at > new Date() ? at : new Date(),
      });
    }
  }
  const [{ value: before } = { value: 0 }] = await db
    .select({ value: count() })
    .from(schema.preregistrations)
    .where(lt(schema.preregistrations.createdAt, row.createdAt));
  const [{ value: referrals } = { value: 0 }] = await db
    .select({ value: count() })
    .from(schema.preregistrations)
    .where(and(eq(schema.preregistrations.referredBy, row.referralCode), sql`${schema.preregistrations.confirmedAt} is not null`));
  return { position: before + 1, referralCode: row.referralCode, referrals };
}

export default async function ConfirmPage({ searchParams }: PageProps<"/registrace/potvrzeni">) {
  const { token } = await searchParams;
  const result = typeof token === "string" ? await confirm(token) : null;

  return (
    <div className="container-prose py-16 text-center">
      {result ? (
        <div className="space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-700">✓</div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">E-mail je potvrzený</h1>
          <p className="text-xl text-ink-soft">
            Jste <strong className="text-brand-700">{result.position}.</strong> v pořadí na včasný přístup k pokladně.
          </p>
          <div className="mx-auto max-w-xl rounded-2xl bg-sun-100 p-6 text-left">
            <p className="font-semibold">Pozvěte kolegu – oba získáte Premium na 3 měsíce zdarma</p>
            <p className="mt-1 text-sm text-ink-soft">Potvrzených pozvánek: {result.referrals}</p>
            <div className="mt-3">
              <CopyLink url={`${SITE_URL}/?ref=${result.referralCode}`} />
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/navody/eet-2-0-kompletni-pruvodce" className="btn-primary">
              Přečíst průvodce EET 2.0
            </Link>
            <Link href="/kontrola-ico" className="btn-secondary">
              Zkontrolovat IČO
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold">Odkaz už neplatí</h1>
          <p className="text-lg text-ink-soft">Potvrzovací odkaz je neplatný nebo neúplný. Zkuste se zaregistrovat znovu – pošleme nový.</p>
          <Link href="/#registrace" className="btn-primary">
            Zpět na registraci
          </Link>
        </div>
      )}
    </div>
  );
}
