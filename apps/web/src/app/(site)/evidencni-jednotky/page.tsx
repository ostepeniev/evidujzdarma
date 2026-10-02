import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { UnitsWizard } from "@/components/tools/units-wizard";
import { FACTS, SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { FactsVerified } from "@/components/facts-verified";

export const metadata: Metadata = {
  title: "Průvodce evidenčními jednotkami EET 2.0",
  description:
    "Které evidenční jednotky oznámit v DIS+? Stálá a mobilní provozovna, automat, web, vozidlo i podnikání bez provozovny. Interaktivní průvodce k EET 2.0 zdarma.",
  alternates: { canonical: "/evidencni-jednotky" },
};

const FAQ = [
  { q: "Co je evidenční jednotka?", a: FACTS.units.summary },
  { q: "Jaké typy evidenčních jednotek DIS+ nabízí?", a: `V DIS+ vybíráte z typů: ${FACTS.units.types.join(", ")}.` },
  { q: "Do kdy musím oznámit změnu?", a: FACTS.units.change },
  {
    q: "Je číslo provozovny z živnostenského rejstříku totéž co číslo evidenční jednotky?",
    a: "Ne. IČP je identifikátor provozovny v živnostenském rejstříku. Číslo evidenční jednotky přidělí Finanční správa v DIS+ a pokladna ho posílá s každou tržbou.",
  },
];

export default function UnitsPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Průvodce evidenčními jednotkami"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Evidenční jednotky", path: "/evidencni-jednotky" },
        ]}
        lead="Evidenční jednotka je místo nebo způsob, kde přijímáte tržby – provozovna, stánek, automat, web nebo vozidlo. Oznamují se v DIS+ od 1. 11. 2026. Vyplňte, kde prodáváte, a uvidíte, které jednotky oznámit."
      />
      <div className="container-page py-10">
        <UnitsWizard />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-4 text-sm text-muted">
            Zdroj:{" "}
            <a href={SOURCES.jakZacit.url} className="underline" rel="noopener">
              {SOURCES.jakZacit.label}
            </a>
            . Orientační průvodce, nejde o daňové poradenství.
          </p>
          <FactsVerified />
        </section>
        <ToolCta />
      </div>
    </>
  );
}
