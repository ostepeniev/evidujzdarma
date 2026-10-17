import type { Metadata } from "next";
import { EetChecklist } from "@/components/eet-checklist";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { CHECKLIST } from "@/content/checklist";
import { FACTS, SOURCES } from "@/content/facts";
import { JsonLd, faqLd, howToLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/** S1 (17. 10. 2026): checklist EET 2.0 k odškrtání a tisku – kroky z revidovaného kompletního průvodce. */
export const metadata: Metadata = {
  title: "Checklist EET 2.0: co udělat do 1. 1. 2027",
  description:
    "Osm kroků k EET 2.0 k odškrtání a tisku: kontrola, DIS+ od 1. 11. 2026, evidenční jednotky, certifikát, pokladna, EET OFF a test v prosinci. Zdarma.",
  ...canonicalMeta("/checklist-eet"),
};

const FAQ = [
  {
    q: "Kdy se dá v DIS+ přihlásit k evidenci tržeb?",
    a: "Od 1. 11. 2026. Ve stejné době oznámíte evidenční jednotky a vygenerujete pokladní certifikát. Evidovat se musí od 1. 1. 2027.",
  },
  {
    q: "Co když nestihnu všechno do konce roku?",
    a: "Povinnost evidovat platí od 1. 1. 2027 bez přechodného období, proto doporučujeme mít přihlášení, jednotky, certifikát a pokladnu hotové v prosinci. Za neodeslání údajů o tržbě hrozí pokuta až 500 000 Kč (§ 24).",
  },
  {
    q: "Ukládáte, co jsem odškrtl?",
    a: "Ne. Odškrtnutí platí jen v otevřené stránce. Chcete-li si postup schovat, checklist si vytiskněte nebo uložte jako PDF.",
  },
];

const FAQ_SOURCES = [SOURCES.zakonUplne, SOURCES.jakZacit, SOURCES.eetOff];

export default function ChecklistPage() {
  return (
    <>
      <JsonLd
        data={[
          howToLd({
            name: "Jak se připravit na EET 2.0",
            description: "Kroky, které musí podnikatel udělat před 1. 1. 2027.",
            steps: CHECKLIST.map((s) => ({ name: `${s.when}: ${s.title}`, text: s.text })),
          }),
          faqLd(FAQ),
        ]}
      />
      <PageHeader
        title="Checklist EET 2.0"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Checklist EET 2.0", path: "/checklist-eet" },
        ]}
        lead={`Osm kroků, které je potřeba udělat před 1. 1. 2027 – od kontroly, zda se vás EET týká, po zkoušku pokladny v prosinci. Odškrtávejte, nebo si seznam vytiskněte. Lhůta pro EET OFF končí ${FACTS.eetOff.deadline}.`}
      />
      <div className="container-page py-10">
        <EetChecklist />
        <section className="no-print mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-3 text-base text-muted">
            Zdroje:{" "}
            {FAQ_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>{s.label}</ExternalLink>
              </span>
            ))}
          </p>
        </section>
        <div className="no-print">
          <RelatedGuides slugs={["eet-2-0-kompletni-pruvodce", "jak-aktivovat-dis-a-certifikat", "evidencni-jednotka"]} className="mx-auto mt-14 max-w-5xl" />
          <ToolCta />
        </div>
      </div>
    </>
  );
}
