import type { Metadata } from "next";
import Link from "next/link";
import { INTEREST_NEXT, INTEREST_REQUEST } from "@/lib/interests";
import { lookupInterest } from "@/lib/server/preregistration";

export const metadata: Metadata = { title: "Potvrzení žádosti", robots: { index: false, follow: false } };

/** Potvrzení zájmu (webinář, kabinet…) už známé adresy – stránka jen čte, potvrdí tlačítko (POST), R7.4. */
export default async function InterestPage({ searchParams }: PageProps<"/registrace/zajem">) {
  const { token } = await searchParams;
  const result = typeof token === "string" ? await lookupInterest(token) : null;

  return (
    <div className="container-prose py-16 text-center">
      {result && !result.confirmed ? (
        <div className="space-y-6">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Potvrďte prosím žádost</h1>
          <p className="text-lg text-ink-soft">
            Žádost {INTEREST_REQUEST[result.campaign]}. {INTEREST_NEXT[result.campaign]}
          </p>
          <form method="post" action="/api/registrace/zajem">
            <input type="hidden" name="token" value={String(token)} />
            <button type="submit" className="btn-primary px-8 py-4 text-lg">
              Potvrdit žádost
            </button>
          </form>
        </div>
      ) : result ? (
        <div className="space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-700">✓</div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Hotovo, žádost je potvrzená</h1>
          <p className="text-xl text-ink-soft">{INTEREST_NEXT[result.campaign]}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold">Odkaz už neplatí</h1>
          <p className="text-lg text-ink-soft">Odkaz je neplatný nebo neúplný. Vyplňte prosím formulář znovu – pošleme nový.</p>
          <Link href="/" className="btn-primary">
            Zpět na úvod
          </Link>
        </div>
      )}
    </div>
  );
}
