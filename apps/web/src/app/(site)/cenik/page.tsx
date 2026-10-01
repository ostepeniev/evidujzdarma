import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { AddonCard, FeatureMatrix, PlanCard } from "@/components/pricing/plan-card";
import { ToolCta } from "@/components/tool-cta";
import { ADDONS, PARTNER_PLAN, PLANS, PRICING_FAQ, PRICING_NOTICE, PRICING_UPDATED } from "@/content/pricing";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ceník – pokladna EET 2.0 zdarma navždy",
  description:
    "Pokladna pro EET 2.0 zdarma navždy: offline režim, 5 uživatelů, 3 evidenční jednotky, doklad e-mailem i CSV. Premium za 149 Kč/měsíc přidá SMS účtenky a exporty",
  alternates: { canonical: "/cenik" },
};

function offerLd(o: { name: string; price: number; monthly?: boolean; from?: boolean; description: string }) {
  const base = {
    "@type": "Offer",
    name: o.name,
    description: o.description,
    priceCurrency: "CZK",
    url: absoluteUrl("/cenik"),
  };
  if (!o.monthly) return { ...base, price: String(o.price) };
  return {
    ...base,
    price: String(o.price),
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      priceCurrency: "CZK",
      ...(o.from ? { minPrice: o.price } : { price: o.price }),
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
    },
  };
}

function productLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "EvidujZdarma – pokladna pro EET 2.0",
    description:
      "Nezávislá pokladna pro evidenci tržeb EET 2.0. Bezplatný tarif navždy, placené doplňky Premium, Terminál, Nastavení na klíč a API.",
    brand: { "@type": "Brand", name: "EvidujZdarma" },
    url: absoluteUrl("/cenik"),
    offers: [
      ...PLANS.map((p) => offerLd({ name: p.name, price: p.price, monthly: p.monthly, description: p.tagline })),
      {
        "@type": "Offer",
        name: "Premium – roční platba",
        price: "1490",
        priceCurrency: "CZK",
        url: absoluteUrl("/cenik"),
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          priceCurrency: "CZK",
          price: 1490,
          referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "ANN" },
        },
      },
      ...ADDONS.map((a) => offerLd({ name: a.name, price: a.price, monthly: a.monthly, from: a.from, description: a.text })),
    ],
    seller: { "@id": `${SITE_URL}/#organization` },
  };
}

export default function PricingPage() {
  return (
    <>
      <JsonLd data={[productLd(), faqLd(PRICING_FAQ)]} />
      <PageHeader
        title="Ceník: pokladna zdarma navždy"
        crumbs={[{ name: "Ceník", path: "/cenik" }]}
        lead="Evidence tržeb pro EET 2.0 je u nás zdarma – bez zkušební doby a bez platební karty. Platit budete jen za doplňky, které opravdu chcete."
      />

      <div className="container-page py-10 sm:py-14">
        <p role="note" className="mx-auto max-w-3xl rounded-2xl border border-sun-300 bg-sun-100 p-4 text-[15px] text-ink sm:p-5">
          <strong>Předběžný ceník.</strong> {PRICING_NOTICE}
        </p>

        <section aria-labelledby="tarify" className="mt-10">
          <h2 id="tarify" className="sr-only">
            Tarify
          </h2>
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            {PLANS.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
        </section>

        <section aria-labelledby="doplnky" className="mt-16">
          <h2 id="doplnky" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Doplňky a služby
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">Fungují s bezplatným i placeným tarifem. Všechny zatím připravujeme.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ADDONS.map((a) => (
              <AddonCard key={a.id} addon={a} />
            ))}
          </div>
        </section>

        <section aria-labelledby="partner" className="mt-16 rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="chip bg-white text-brand-700 ring-1 ring-brand-200">Pro účetní a daňové kanceláře</p>
              <h2 id="partner" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                {PARTNER_PLAN.name}: {PARTNER_PLAN.priceLabel}
              </h2>
              <p className="mt-2 text-lg text-ink-soft">{PARTNER_PLAN.text}</p>
              <Link href={PARTNER_PLAN.cta.href} className="btn-primary mt-6">
                {PARTNER_PLAN.cta.label}
              </Link>
            </div>
            <ul className="space-y-3 text-[15px] text-ink">
              {PARTNER_PLAN.bullets.map((b) => (
                <li key={b} className="flex gap-3 rounded-xl bg-white p-4">
                  <span aria-hidden="true" className="text-brand-600">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="srovnani-tarifu" className="mx-auto mt-16 max-w-3xl">
          <h2 id="srovnani-tarifu" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Zdarma a Premium v jedné tabulce
          </h2>
          <div className="mt-6">
            <FeatureMatrix />
          </div>
          <p className="mt-3 text-sm text-muted">
            Ceník platí ke dni {new Date(PRICING_UPDATED).toLocaleDateString("cs-CZ")}. Jak si stojíme proti bezplatné státní
            aplikaci, ukazuje{" "}
            <Link href="/srovnani/moje-eet" className="underline underline-offset-2">
              srovnání s MOJE eet
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="faq" className="mx-auto mt-16 max-w-3xl">
          <h2 id="faq" className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Časté otázky k ceníku
          </h2>
          <Faq items={PRICING_FAQ} />
          <ToolCta
            title="Začněte zdarma, zbytek počká"
            text="Předregistrujte se k bezplatné pokladně. O placených doplňcích vám dáme vědět, až budou hotové – a rozhodnete se sami."
          />
        </section>
      </div>
    </>
  );
}
