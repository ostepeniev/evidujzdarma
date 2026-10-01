import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { EetOffCalculator } from "@/components/tools/eet-off-calculator";
import { FACTS, SOURCES, formatKc } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Kalkulačka EET OFF 2027 – vyplatí se přirážka?",
  description:
    "Spočítejte, zda se vám vyplatí EET OFF: přirážka 1 400 Kč měsíčně k paušální dani místo evidence tržeb. Pro OSVČ v 1. pásmu s příjmy do 1 mil. Kč. Přihláška do 11. 1. 2027.",
  alternates: { canonical: "/kalkulacka-eet-off" },
};

const FAQ = [
  { q: "Kdo může zvolit EET OFF?", a: FACTS.eetOff.summary },
  { q: "Do kdy se musím přihlásit?", a: FACTS.eetOff.howTo },
  {
    q: "Kolik zaplatím s EET OFF v roce 2027?",
    a: `V 1. pásmu paušálního režimu je oznámená záloha pro rok 2027 ${formatKc(FACTS.pausal[2027].band1)} měsíčně (předběžně). S přirážkou EET OFF ${formatKc(FACTS.eetOff.surchargeMonthly)} to dělá ${formatKc(FACTS.pausal[2027].band1 + FACTS.eetOff.surchargeMonthly)} měsíčně, tedy o ${formatKc(FACTS.eetOff.surchargeMonthly * 12)} ročně víc.`,
  },
  {
    q: "Jak kalkulačka počítá náklady evidence?",
    a: "Sečte čas, který evidenci věnujete (minuty denně × pracovní dny × cena vaší hodiny), měsíční cenu pokladny a pořízení zařízení rozpočítané na 3 roky. Výsledek porovná s ročním součtem přirážky. Pokladna EvidujZdarma je zdarma, takže u nás rozhoduje hlavně čas.",
  },
  {
    q: "Co když v průběhu roku překročím 1 milion Kč?",
    a: "Přesný postup při překročení limitu během roku zatím Finanční správa podrobně nepopsala. Doporučujeme sledovat eet.gov.cz nebo se poradit s daňovým poradcem.",
  },
];

export default function EetOffPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Kalkulačka EET OFF"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Kalkulačka EET OFF", path: "/kalkulacka-eet-off" },
        ]}
        lead={
          <>
            EET OFF znamená přirážku <strong>{formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně</strong> k paušální dani místo evidence tržeb. Smí ho zvolit jen
            fyzická osoba v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč. Přihlásit se je nutné do <strong>{FACTS.eetOff.deadline}</strong>. Spočítejte si, co
            vás vyjde levněji.
          </>
        }
      />
      <div className="container-page py-10">
        <EetOffCalculator />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky k EET OFF</h2>
          <Faq items={FAQ} />
          <p className="mt-4 text-sm text-muted">
            Zdroje:{" "}
            {[SOURCES.eetOff, SOURCES.eetOffJak, SOURCES.pausal2027].map((s, i) => (
              <span key={s.url}>
                {i > 0 && ", "}
                <a href={s.url} className="underline" rel="noopener">
                  {s.label}
                </a>
              </span>
            ))}
            . Výpočet je orientační, nejde o daňové poradenství.
          </p>
        </section>
        <ToolCta text="Rozhodli jste se evidovat? Pokladna EvidujZdarma je zdarma navždy, funguje i bez signálu a zvládne ji každý za 15 minut." />
      </div>
    </>
  );
}
