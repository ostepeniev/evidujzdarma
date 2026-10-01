import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { Quiz } from "@/components/tools/quiz";
import { FACTS } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Musím evidovat tržby? Kvíz k EET 2.0 (6 otázek)",
  description:
    "Zjistěte za minutu, zda musíte od roku 2027 evidovat tržby v EET 2.0, zda máte výjimku nebo můžete zvolit EET OFF. Kvíz se zdroji z eet.gov.cz, zdarma a bez registrace.",
  alternates: { canonical: "/musim-evidovat" },
};

const FAQ = [
  { q: "Kdo musí od roku 2027 evidovat tržby?", a: FACTS.whoMust.summary },
  { q: "Které platby se evidují?", a: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}` },
  { q: "Kdo má výjimku?", a: FACTS.whoMust.exemptions },
  { q: "Můžu se evidenci vyhnout přirážkou?", a: FACTS.eetOff.summary },
];

export default function QuizPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Musím evidovat tržby?"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Kvíz", path: "/musim-evidovat" },
        ]}
        lead="Evidence tržeb EET 2.0 platí od 1. 1. 2027, ostrý provoz od 1. 2. 2027. Odpovězte na nejvýše 6 otázek a zjistěte, zda se vás týká, zda máte výjimku, nebo můžete zvolit EET OFF."
      />
      <div className="container-page py-10">
        <Quiz />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
        </section>
        <ToolCta />
      </div>
    </>
  );
}
