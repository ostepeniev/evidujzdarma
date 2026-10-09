import type { Metadata } from "next";
import Link from "next/link";
import { ComparisonTable } from "@/components/comparison-table";
import { Faq } from "@/components/faq";
import { IcoQuickCheck } from "@/components/ico-quick-check";
import { PollWidget } from "@/components/poll-widget";
import { PreregForm } from "@/components/prereg-form";
import { PosPreview } from "@/components/pos-preview";
import { Countdown, Timeline } from "@/components/timeline";
import { LANDING_FAQ, WHO_MUST } from "@/content/landing";
import { FACTS_UPDATED } from "@/content/facts";
import { POLLS } from "@/content/polls";
import { JsonLd, faqLd, softwareApplicationLd } from "@/lib/jsonld";
import { ExternalLink } from "@/components/external-link";
import { canonicalMeta } from "@/lib/metadata";
import { SERVICE_COPY } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Evidence tržeb EET 2.0 zdarma – pokladna i bez signálu | EvidujZdarma" },
  description: SERVICE_COPY.home,
  ...canonicalMeta("/"),
};

// Odpočet a "nejbližší termín" se mění denně.
export const revalidate = 3600;

const BENEFITS = [
  { title: "Prodej na 3 dotyky", text: "Částka nebo tlačítko zboží → způsob platby → hotovo. Na účtence může být i kód POK od Finanční správy (není povinný)." },
  { title: "I bez signálu", text: "Tržby se uloží v zařízení a odešlou se samy, jakmile bude připojení. Lhůtu pro dodatečné odeslání pohlídáme." },
  { title: "Až 5 uživatelů zdarma", text: "Každá pokladní má vlastní PIN, vy vidíte všechny tržby a denní přehled." },
  { title: "Účtenka papírově i digitálně", text: "Tisk na Bluetooth tiskárnu, e-mail nebo QR kód na displeji. Odkaz v SMS připravujeme." },
  { title: "Pro účetní", text: "Export CSV zdarma, hromadná kontrola IČO a přehled připravenosti všech klientů." },
  { title: "Bezpečně v EU", text: "Data na serverech v Evropské unii, klíče certifikátů šifrovaně, heslo k certifikátu neukládáme." },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={[softwareApplicationLd(), faqLd(LANDING_FAQ)]} />

      {/* Hero */}
      <section className="border-b border-line bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.35fr_1fr]">
          <div className="max-w-3xl">
            <p className="chip mb-5 bg-white text-brand-700 ring-1 ring-brand-200">EET 2.0 · platí od roku 2027</p>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-6xl">
              Evidence tržeb EET 2.0 <span className="text-brand-600">zdarma</span>.
            </h1>
            <p className="mt-5 text-xl leading-relaxed text-ink-soft sm:text-2xl">
              {SERVICE_COPY.hero}
            </p>
            <div className="mt-8 max-w-2xl">
              <IcoQuickCheck />
              <p className="mt-3 text-sm text-muted">
                Zdarma a bez registrace. Údaje bereme z veřejného registru ARES.
              </p>
            </div>
            <div className="mt-8">
              <Countdown />
            </div>
          </div>
          <div className="hidden lg:block">
            <PosPreview />
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="container-page py-16" aria-labelledby="terminy">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="terminy" className="text-3xl font-bold tracking-tight sm:text-4xl">
              Termíny EET 2.0
            </h2>
            <p className="mt-2 text-lg text-ink-soft">Co a kdy udělat, aby vás start evidence nezaskočil.</p>
          </div>
          <Link href="/navody/eet-2-0-kompletni-pruvodce" className="btn-ghost">
            Kompletní průvodce EET 2.0 →
          </Link>
        </div>
        <Timeline />
        <p className="mt-4 text-sm text-muted">
          Ověřeno k {new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")}. Zdroj:{" "}
          <ExternalLink href="https://eet.gov.cz" className="underline">
            eet.gov.cz
          </ExternalLink>{" "}
          a tiskové zprávy Finanční správy a Ministerstva financí.
        </p>
      </section>

      {/* Benefits */}
      <section className="border-y border-line bg-surface py-16" aria-labelledby="proc">
        <div className="container-page">
          <h2 id="proc" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pokladna, která vám nebude překážet
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="card">
                <h3 className="text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-ink-soft">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="container-page py-16" aria-labelledby="srovnani">
        <h2 id="srovnani" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Férové srovnání se státní aplikací MOJE eet
        </h2>
        <p className="mt-2 max-w-3xl text-lg text-ink-soft">
          {SERVICE_COPY.compareIntro}
        </p>
        <div className="mt-8">
          <ComparisonTable />
        </div>
      </section>

      {/* Who must */}
      <section className="border-y border-line bg-surface py-16" aria-labelledby="kdo">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="kdo" className="text-3xl font-bold tracking-tight sm:text-4xl">
              Kdo musí evidovat
            </h2>
            <p className="mt-3 text-lg text-ink-soft">Stručný přehled. Přesné podmínky a výjimky najdete v návodech a v kvízu.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/musim-evidovat" className="btn-primary">
                Kvíz: Musím evidovat?
              </Link>
              <Link href="/navody/koho-se-eet-tyka" className="btn-secondary">
                Koho se EET týká
              </Link>
            </div>
          </div>
          <ul className="space-y-3">
            {WHO_MUST.map((w) => (
              <li key={w.title} className="card flex gap-4 p-5">
                <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-full ${w.tone === "yes" ? "bg-brand-500" : w.tone === "maybe" ? "bg-sun-500" : "bg-line"}`} />
                <div>
                  <h3 className="font-semibold">{w.title}</h3>
                  <p className="mt-1 text-[15px] text-ink-soft">{w.text}</p>
                  {w.href && (
                    <Link href={w.href} className="mt-1 inline-block text-[15px] font-medium text-brand-700 underline underline-offset-4">
                      {w.linkLabel}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pre-registration */}
      <section id="registrace" className="container-page scroll-mt-24 py-16" aria-labelledby="registrace-h">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 id="registrace-h" className="text-3xl font-bold tracking-tight sm:text-4xl">
              Předregistrace k pokladně zdarma
            </h2>
            <p className="mt-3 text-lg text-ink-soft">Pošleme vám osobní EET plán podle vašeho IČO a termínů a dáme vědět, jakmile bude pokladna připravená.</p>
            <ul className="mt-6 space-y-3 text-[17px]">
              {[
                { t: "Osobní checklist: co udělat od 1. 11., do 1. 12. a do 1. 1." },
                { t: "Návod k DIS+ a certifikátu krok za krokem" },
                { t: "Včasný přístup k pokladně podle pořadí" },
                // akce má pravidla (Ц3, R7.10)
                { t: "Za pozvaného kolegu Premium na 3 měsíce pro oba", rules: true },
              ].map(({ t, rules }) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="text-brand-600">
                    ✓
                  </span>
                  <span>
                    {t}
                    {rules && (
                      <>
                        {" "}
                        <Link href="/pravidla-doporuceni" className="text-base text-muted underline underline-offset-2">
                          Pravidla akce
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6 shadow-sm sm:p-8">
            <PreregForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-prose py-16" aria-labelledby="faq">
        <h2 id="faq" className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
          Časté otázky k EET 2.0
        </h2>
        <Faq items={LANDING_FAQ} />
      </section>

      {/* Anketa + rozpory */}
      <section className="border-t border-line bg-surface py-16" aria-label="Anketa a omyly o EET 2.0">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <PollWidget poll={POLLS["eet2-souhlas"]} />
          <div className="space-y-4">
            <Link href="/co-se-o-eet-pise-spatne" className="card block transition-colors hover:border-brand-200">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Pozor na omyly</p>
              <p className="mt-1 text-xl font-bold text-ink">Co se o EET 2.0 píše špatně</p>
              <p className="mt-2 text-[15px] text-ink-soft">
                Výjimka do 50 000 Kč, evidence až od února nebo sleva 5 000 Kč pro každého – porovnali jsme to se schváleným zákonem.
              </p>
            </Link>
            <Link href="/stav-eet" className="card block transition-colors hover:border-brand-200">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Monitor</p>
              <p className="mt-1 text-xl font-bold text-ink">Je EET dole?</p>
              <p className="mt-2 text-[15px] text-ink-soft">Aktuální dostupnost rozhraní Finanční správy a historie výpadků, měřeno každých 5 minut.</p>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
