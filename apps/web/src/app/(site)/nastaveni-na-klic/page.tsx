import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ServiceOrderForm } from "@/components/service-order-form";
import { SERVICE_FAQ, SETUP_SERVICE, SETUP_STEPS, TAX_PARTNER, serviceDeadlines, setupIncludes } from "@/content/services";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OPERATOR, SITE, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * S5-SLUŽBY (26. 10. 2026): „Nastavení EET na klíč“ – placená technická pomoc s DIS+, certifikátem a pokladnou,
 * písemně, bez telefonu. Trychtýř: kalkulačka EET OFF, stránky „EET pro …“, návody → tato stránka → poptávka (e-mail
 * provozovateli). Daňovou část nenabízíme, dokud nemáme partnerskou daňovou poradkyni (content/services.ts, TAX_PARTNER).
 */
const PATH = "/nastaveni-na-klic";

export const metadata: Metadata = {
  title: { absolute: "Nastavení EET na klíč za 990 Kč – bez telefonování" },
  description:
    "Pomůžeme vám s EET 2.0: postup pro DIS+ a pokladní certifikát na míru, kontrola a nastavení pokladny. Písemně, bez volání, 990 Kč, platíte až po dokončení.",
  ...canonicalMeta(PATH),
};

function serviceLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: SETUP_SERVICE.name,
    serviceType: "Technická pomoc s nastavením evidence tržeb EET 2.0",
    url: absoluteUrl(PATH),
    areaServed: { "@type": "Country", name: "Česká republika" },
    availableLanguage: ["cs"],
    provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE.name, legalName: OPERATOR.name },
    offers: { "@type": "Offer", price: String(SETUP_SERVICE.price), priceCurrency: "CZK", url: absoluteUrl(`${PATH}#poptavka`) },
  };
}

export default function SetupServicePage() {
  const includes = setupIncludes();
  return (
    <>
      <JsonLd data={[serviceLd(), faqLd(SERVICE_FAQ)]} />
      <PageHeader
        title="Nastavení EET 2.0 na klíč – bez telefonování"
        crumbs={[{ name: "Nastavení na klíč", path: PATH }]}
        lead={
          <>
            Pošlete poptávku a my vám připravíme přesný postup pro DIS+ a pokladní certifikát, zkontrolujeme, že je vše hotové, a připravíme nastavení
            pokladny EvidujZdarma. Všechno písemně e-mailem – nikam nevoláte. <strong>{SETUP_SERVICE.priceLabel}</strong>, platíte až po dokončení.
          </>
        }
      >
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="#poptavka" className="btn-primary px-6 py-3 text-lg no-underline">
            Poptat nastavení
          </a>
          <Link href="/navody/jak-aktivovat-dis-a-certifikat" className="btn-secondary px-6 py-3 text-lg no-underline">
            Zvládnu sám – návod zdarma
          </Link>
        </div>
      </PageHeader>

      <section className="container-page py-12" aria-labelledby="cena-h">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 id="cena-h" className="text-3xl font-bold tracking-tight">
              Co dostanete
            </h2>
            <ul className="mt-6 space-y-3 text-[17px] text-ink">
              {includes.map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="text-brand-600">
                    ✓
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="card self-start border-2 border-brand-500 p-6 sm:p-8" aria-label="Cena">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{SETUP_SERVICE.name}</p>
            <p className="mt-3 text-5xl font-extrabold tracking-tight text-ink">{SETUP_SERVICE.priceLabel}</p>
            <p className="mt-1 text-[15px] text-muted">{SETUP_SERVICE.priceNote}</p>
            <p className="mt-4 text-[15px] text-ink-soft">{SETUP_SERVICE.payment}</p>
            <p className="mt-2 text-[15px] text-ink-soft">{SETUP_SERVICE.responseTime}</p>
            <a href="#poptavka" className="btn-primary mt-6 w-full py-3 text-center no-underline">
              Poptat nastavení
            </a>
          </aside>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-14" aria-labelledby="postup-h">
        <div className="container-page">
          <h2 id="postup-h" className="text-3xl font-bold tracking-tight">
            Jak to probíhá
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SETUP_STEPS.map((s, i) => (
              <li key={s.title} className="card p-5">
                <p className="text-sm font-semibold text-brand-700">Krok {i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="terminy-h">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 id="terminy-h" className="text-3xl font-bold tracking-tight">
              Termíny, které hlídáme
            </h2>
            <ul className="mt-6 space-y-4">
              {serviceDeadlines().map((d) => (
                <li key={d.label} className="flex gap-4">
                  <span className="w-28 shrink-0 font-semibold text-ink">{d.label}</span>
                  <span className="text-[15px] text-ink-soft">{d.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="rounded-2xl border border-sun-300 bg-sun-100 p-6" aria-labelledby="eetoff-h" data-tax-partner={TAX_PARTNER.enabled ? "on" : "off"}>
            <h2 id="eetoff-h" className="text-xl font-bold text-ink">
              EET ON, nebo EET OFF?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{TAX_PARTNER.notice}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/kalkulacka-eet-off" className="btn-primary no-underline">
                Spočítat v kalkulačce zdarma →
              </Link>
              <Link href="/navody/eet-off" className="btn-ghost">
                Návod k EET OFF
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section id="poptavka" className="scroll-mt-24 border-t border-line bg-brand-50 py-14" aria-labelledby="poptavka-h">
        <div className="container-page max-w-2xl">
          <h2 id="poptavka-h" className="text-center text-3xl font-bold tracking-tight">
            Poptat nastavení na klíč
          </h2>
          <p className="mt-3 text-center text-lg text-ink-soft">
            Bez telefonu – odpovíme e-mailem. Raději píšete sami? Napište na{" "}
            <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(SETUP_SERVICE.name)}`} className="font-medium text-brand-700 underline">
              {SITE.email}
            </a>
            .
          </p>
          <div className="card mt-8 p-6 sm:p-8">
            <ServiceOrderForm />
          </div>
        </div>
      </section>

      <section className="container-page max-w-3xl py-14" aria-labelledby="faq-h">
        <h2 id="faq-h" className="mb-6 text-2xl font-bold">
          Časté otázky
        </h2>
        <Faq items={SERVICE_FAQ} />
        <p className="mt-6 text-sm text-muted">
          Službu poskytuje {OPERATOR.name}, IČO {OPERATOR.ico}. {SITE.independenceNotice} Nejde o daňové poradenství.
        </p>
      </section>
    </>
  );
}
