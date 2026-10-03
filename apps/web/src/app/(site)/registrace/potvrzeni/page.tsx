import type { Metadata } from "next";
import Link from "next/link";
import { INTEREST_LABEL, INTEREST_NEXT } from "@/lib/interests";
import { lookupPreregistration } from "@/lib/server/preregistration";
import { SITE_URL } from "@/lib/site";
import { CopyLink } from "@/components/copy-link";

export const metadata: Metadata = { title: "Potvrzení registrace", robots: { index: false, follow: false } };

export default async function ConfirmPage({ searchParams }: PageProps<"/registrace/potvrzeni">) {
  const { token } = await searchParams;
  // Stránka jen čte stav; potvrzení proběhne až tlačítkem (POST) – odkaz v e-mailu nic nemění (Р5).
  const result = typeof token === "string" ? await lookupPreregistration(token) : null;
  // přihláška na webinář nebo zájem o kabinet není předregistrace k pokladně – stránka to nesmí tvrdit (R7.4)
  const forPos = !result || result.interests.length === 0 || result.interests.includes("pokladna");
  const other = result?.interests.filter((i) => i !== "pokladna") ?? [];

  return (
    <div className="container-prose py-16 text-center">
      {result && !result.confirmed ? (
        <div className="space-y-6">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Potvrďte prosím e-mail</h1>
          <p className="text-lg text-ink-soft">
            Jedním kliknutím potvrdíte, že e-mail patří vám. {forPos ? "Pak vám pošleme včasný přístup k pokladně." : other.map((i) => INTEREST_NEXT[i]).join(" ")}
          </p>
          <form method="post" action="/api/registrace/potvrdit">
            <input type="hidden" name="token" value={String(token)} />
            <button type="submit" className="btn-primary px-8 py-4 text-lg">
              Potvrdit e-mail
            </button>
          </form>
        </div>
      ) : result && !forPos ? (
        <div className="space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-700">✓</div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">E-mail je potvrzený</h1>
          {other.map((i) => (
            <p key={i} className="text-xl text-ink-soft">
              {INTEREST_LABEL[i].charAt(0).toUpperCase() + INTEREST_LABEL[i].slice(1)}: {INTEREST_NEXT[i]}
            </p>
          ))}
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/ucetni/hromadna-kontrola" className="btn-primary">
              Hromadná kontrola IČO
            </Link>
          </div>
        </div>
      ) : result ? (
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
