import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ServiceOrderForm } from "@/components/service-order-form";
import {
  EXISTING_POS_SERVICE,
  SERVICE_FAQ,
  SERVICE_PARTNER_LINE,
  SETUP_SERVICE,
  SETUP_STEPS,
  TAX_PARTNER,
  WHY_CHEAPER,
  serviceDeadlines,
  setupIncludes,
} from "@/content/services";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OPERATOR, SITE, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * S5-SLUŽBY (26. 10. 2026): „Nastavení EET na klíč“ – placená technická pomoc s DIS+, certifikátem a pokladnou,
 * písemně, bez telefonu. Trychtýř: kalkulačka EET OFF, stránky „EET pro …“, návody → tato stránka → poptávka (e-mail
 * provozovateli). Daňovou část nenabízíme, dokud nemáme partnerského daňového poradce (content/services.ts, TAX_PARTNER).
 * К13 (31. 10. 2026): cena bez DPH i s DPH, 3 kroky, balíček „Připojení stávající pokladny“ (#stavajici-pokladna).
 */
const PATH = "/nastaveni-na-klic";

export const metadata: Metadata = {
  title: { absolute: `Nastavení EET na klíč za ${SETUP_SERVICE.priceExVatLabel}` },
  description: `EET 2.0 na klíč: DIS+, připojení certifikátu a kontrola pokladny. Písemně, bez volání, ${SETUP_SERVICE.priceLabel}. Platíte až po dokončení.`,
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
    // К13: Offer.price = cena s DPH; priceSpecification uvádí obě ceny (provozovatel je plátce DPH)
    offers: {
      "@type": "Offer",
      price: SETUP_SERVICE.priceInclVat.toFixed(2),
      priceCurrency: "CZK",
      url: absoluteUrl(`${PATH}#poptavka`),
      priceSpecification: [
        { "@type": "PriceSpecification", price: SETUP_SERVICE.priceInclVat, priceCurrency: "CZK", valueAddedTaxIncluded: true },
        { "@type": "PriceSpecification", price: SETUP_SERVICE.price, priceCurrency: "CZK", valueAddedTaxIncluded: false },
      ],
    },
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
            Pošlete poptávku a my s vámi projdeme tři kroky: DIS+ a evidenční jednotky, připojení certifikátu se zkušebním spuštěním a kontrolu
            nastavení pokladny. Všechno písemně e-mailem – nikam nevoláte. <strong>{SETUP_SERVICE.priceLabel}</strong>, platíte až po dokončení. Máte
            už pokladnu z první EET? Podívejte se na <a href="#stavajici-pokladna" className="font-medium text-brand-700 underline">
              připojení stávající pokladny
            </a>.
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
            <p className="mt-3 text-5xl font-extrabold tracking-tight text-ink">{SETUP_SERVICE.priceExVatLabel}</p>
            <p className="mt-2 text-lg font-semibold text-ink">{SETUP_SERVICE.priceInclVatLabel}</p>
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
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
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

      {/* К13 (31. 10. 2026): balíček pro podnikatele s pokladnou z první EET nebo jiným systémem */}
      <section id="stavajici-pokladna" className="container-page scroll-mt-24 py-14" aria-labelledby="stavajici-h">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="stavajici-h" className="text-3xl font-bold tracking-tight">
            {EXISTING_POS_SERVICE.name}
          </h2>
          <p className="text-[15px] font-semibold text-brand-700">
            {EXISTING_POS_SERVICE.priceLabel} – {EXISTING_POS_SERVICE.priceNote}
          </p>
        </div>
        <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-soft">
          Máte pokladnu z první EET (2016–2020) nebo jiný pokladní systém? Pro EET 2.0 potřebuje nový pokladní certifikát z DIS+ a ID
          evidenčních jednotek. Připojit ji můžete třemi cestami:
        </p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {EXISTING_POS_SERVICE.options.map((o, i) => (
            <li key={o.title} className="card p-5">
              <p className="text-sm font-semibold text-brand-700">Možnost {i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{o.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{o.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href="/nastaveni-na-klic?balicek=pripojeni#poptavka" className="btn-primary px-6 py-3 no-underline" data-service-package="pripojeni">
            Poptat připojení pokladny
          </a>
          <Link href="/navody/pokladna-z-eet-1-0" className="btn-secondary px-6 py-3 no-underline">
            Návod zdarma: Mám pokladnu z EET 1.0
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-14" aria-labelledby="levneji-h">
        <div className="container-page max-w-3xl">
          <h2 id="levneji-h" className="text-3xl font-bold tracking-tight">
            Proč může být EvidujZdarma pro malé podnikatele levnější
          </h2>
          <ul className="mt-6 space-y-3 text-[17px] text-ink">
            {WHY_CHEAPER.map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden="true" className="text-brand-600">
                  ✓
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[15px] text-muted">Samotná pokladna EvidujZdarma je zdarma; platíte jen za nastavení, pokud o něj stojíte.</p>
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
            Poptat nastavení nebo připojení pokladny
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
          Službu poskytuje {OPERATOR.name}, IČO {OPERATOR.ico}, DIČ {OPERATOR.dic}. {SERVICE_PARTNER_LINE} {SITE.independenceNotice} Nejde o daňové
          poradenství.
        </p>
      </section>
    </>
  );
}
