import type { Metadata } from "next";
import { RelatedGuides } from "@/components/related-guides";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { EetOffCalculator } from "@/components/tools/eet-off-calculator";
import { FACTS, SOURCES, formatKc } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { FactsVerified } from "@/components/facts-verified";
import { ExternalLink } from "@/components/external-link";
import { canonicalMeta } from "@/lib/metadata";
import { SERVICE_COPY } from "@/lib/site";
import { DEFAULT_INPUT, calculateEetOff, eetOffYear } from "@/lib/eet-off";

// S2/B2: bod zvratu pro výchozí odhady (300 Kč/h, 21 pracovních dní) – stejný výpočet jako v kalkulačce
const r0 = calculateEetOff(DEFAULT_INPUT);
const y0 = r0.eligible ? eetOffYear(DEFAULT_INPUT, r0) : null;

export const metadata: Metadata = {
  // S4 (23. 10. 2026): hledá se „eet kalkulačka“ / „kalkulačka eet“ (~100 zobrazení za 28 dní, 0 kliků) – přesná fráze na začátek
  title: "EET kalkulačka 2027: evidovat, nebo EET OFF?",
  description:
    "Za minutu a zdarma spočítáte, zda vás vyjde levněji evidovat tržby, nebo platit EET OFF 1 400 Kč měsíčně. Pro paušalisty v 1. pásmu. Oznámení do 11. 1. 2027.",
  ...canonicalMeta("/kalkulacka-eet-off"),
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
    q: "Vyplatí se mi EET OFF, když začínám podnikat v průběhu roku?",
    a: `${FACTS.eetOff.midYear} Kalkulačka proto počítá přirážku i náklady evidence jen za měsíce, kdy podnikáte – vyberte měsíc zahájení.`,
  },
  {
    q: "Co když v průběhu roku překročím 1 milion Kč?",
    a: FACTS.eetOff.overLimit,
  },
  { q: "Můžu EET OFF změnit v polovině roku?", a: `Ne. ${FACTS.eetOff.binding}` },
  { q: "Jak se z EET OFF odhlásit a do kdy?", a: FACTS.eetOff.exit },
  ...(y0 && y0.breakEvenMinutesPerDay !== null
    ? [
        {
          q: "Kolik minut evidence denně vyjde stejně jako přirážka?",
          a: `Při ceně vaší hodiny ${formatKc(DEFAULT_INPUT.hourlyRate)} a ${DEFAULT_INPUT.workDaysPerMonth} pracovních dnech v měsíci stojí přirážka ${formatKc(FACTS.eetOff.surchargeYearly)} ročně stejně jako zhruba ${y0.breakEvenMinutesPerDay.toLocaleString("cs-CZ")} minut evidence denně. S pokladnou za 0 Kč rozhoduje jen čas: zabere-li vám evidence méně, vychází levněji evidovat. Kalkulačka bod zvratu přepočítá podle vašich čísel a ukáže i roční součet s paušální daní.`,
        },
      ]
    : []),
  {
    q: "Musím v EET OFF vydat účtenku, když si ji zákazník vyžádá?",
    a: `Ano. EET OFF vás zbavuje jen evidence tržeb. ${FACTS.receipt.summary}`,
  },
];

export default function EetOffPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="EET kalkulačka: evidovat, nebo EET OFF?"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Kalkulačka EET OFF", path: "/kalkulacka-eet-off" },
        ]}
        lead={
          <>
            EET OFF znamená přirážku <strong>{formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně</strong> k paušální dani místo evidence tržeb. Smí ho zvolit jen
            fyzická osoba v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč. Přihlásit se je nutné do <strong>{FACTS.eetOff.deadline}</strong>. Spočítejte si, co
            vás vyjde levněji – i když začínáte podnikat v průběhu roku.
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
                <ExternalLink href={s.url} className="underline">
                  {s.label}
                </ExternalLink>
              </span>
            ))}
            . Výpočet je orientační, nejde o daňové poradenství.
          </p>
          <FactsVerified />
        </section>
        <RelatedGuides slugs={["eet-off", "eet-a-pausalni-dan", "eet-2-0-kompletni-pruvodce"]} title="Návody k EET OFF a paušální dani" className="mx-auto mt-14 max-w-5xl" />
        <ToolCta text={SERVICE_COPY.calculatorCta} />
      </div>
    </>
  );
}
