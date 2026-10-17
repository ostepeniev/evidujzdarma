import type { Metadata } from "next";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { MoneyParams } from "@/components/money-params";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { OsvcCalculator } from "@/components/tools/osvc-calculator";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { EXPENSE_FLAT, P2026, kc, uniqueSources, type ParamKey } from "@/lib/money-2026";
import { MONEY_DISCLAIMER, moneyRobots } from "@/lib/money-review";

/**
 * S2/B2 (17. 10. 2026): kalkulačka OSVČ 2026 – daň, sociální a zdravotní pojištění, srovnání s paušální daní. Peněžní
 * kalkulačka = noindex, mimo sitemap/llms/rozcestník, dokud ji nezkontroluje účetní (lib/money-review.ts).
 */
export const metadata: Metadata = {
  title: "Kalkulačka OSVČ 2026: daň, sociální a zdravotní pojištění",
  description:
    "Daň z příjmů a pojistné OSVČ za rok 2026 z příjmů a výdajů – paušálem 80/60/40/30 % i skutečně, hlavní i vedlejší činnost, minimální zálohy 2026 a srovnání s paušální daní.",
  ...canonicalMeta("/kalkulacka-osvc"),
  ...moneyRobots(),
};

const n = (x: number) => x.toLocaleString("cs-CZ");

const FAQ = [
  {
    q: "Jak se počítá daň OSVČ za rok 2026?",
    a: `Od příjmů se odečtou výdaje – skutečné, nebo paušálem. Rozdíl (dílčí základ daně) se zaokrouhlí na stovky dolů a zdaní 15 %, část nad ${n(P2026.hraniceRocni.value)} Kč 23 %. Daň se sníží o slevu na poplatníka ${n(P2026.slevaPoplatnik.value)} Kč a o daňové zvýhodnění na děti; co se do daně nevejde, je daňový bonus.`,
  },
  {
    q: "Jaké jsou výdajové paušály a jejich stropy?",
    a: `${Object.values(EXPENSE_FLAT)
      .map((f) => `${f.rate} % (nejvýše ${n(f.cap)} Kč)`)
      .join(", ")} – podle § 7 odst. 7 zákona o daních z příjmů. 80 % platí pro řemeslné živnosti a zemědělství, 60 % pro ostatní živnosti, 40 % pro jiné příjmy ze samostatné činnosti a 30 % pro nájem majetku v obchodním majetku.`,
  },
  {
    q: "Kolik je minimální záloha na sociální pojištění v roce 2026?",
    a: `U hlavní činnosti ${n(P2026.minZalohaHlavniDoCervna.value)} Kč měsíčně od ledna do června a ${n(P2026.minZalohaHlavniOdCervence.value)} Kč od července – zákon č. 90/2026 Sb. vrátil minimální vyměřovací základ na 35 % průměrné mzdy (${n(P2026.minVzHlavni.value)} Kč měsíčně). Pro přehled za celý rok 2026 se počítá s 35 %. Rozdíl zaplacený navíc vám správa sociálního zabezpečení vrátí na písemnou žádost podanou do 31. 12. 2026. U vedlejší činnosti je minimální záloha ${n(P2026.minZalohaVedlejsi.value)} Kč.`,
  },
  {
    q: "Kolik je minimální záloha na zdravotní pojištění v roce 2026?",
    a: `${n(P2026.minZalohaZdr.value)} Kč měsíčně, z minimálního vyměřovacího základu ${P2026.minVzZdr.value.toLocaleString("cs-CZ")} Kč (polovina průměrné mzdy). Minimum neplatí, pokud jste zároveň zaměstnanec, z jehož mzdy se pojistné odvádí aspoň z minimálního základu, nebo za vás platí pojistné stát (například student nebo důchodce), a to po celý rok. Trvalo-li to jen část roku, minimum se sníží o celé měsíce, kdy to trvalo.`,
  },
  {
    q: "Kdy platím sociální pojištění z vedlejší činnosti?",
    a: `Jen když zisk (dílčí základ daně) za rok 2026 dosáhne aspoň rozhodné částky ${n(P2026.rozhodnaCastka.value)} Kč. Za každý celý měsíc, kdy vedlejší činnost nevykonáváte, se rozhodná částka sníží o ${n(P2026.rozhodnaCastkaMesic.value)} Kč.`,
  },
  {
    q: "Vyplatí se mi paušální daň?",
    a: `V roce 2026 je měsíční paušální záloha ${kc(P2026.pausal1.value)} v 1. pásmu, ${kc(P2026.pausal2.value)} ve 2. a ${kc(P2026.pausal3.value)} ve 3. pásmu. Platí za daň i obě pojistná. Kalkulačka ukáže, které pásmo vám podle příjmů a druhu činnosti připadá a kolik byste zaplatili v běžném režimu. Částka 1. pásma platí díky zákonu č. 90/2026 Sb. pro celý rok 2026. Kdo platil do června ${kc(P2026.pausal1DoCervna.value)}, má přeplatek ${kc(6 * (P2026.pausal1DoCervna.value - P2026.pausal1.value))} a může ho započíst na další zálohy roku 2026.`,
  },
  {
    q: "Co kalkulačka nepočítá?",
    a: `Nižší minimální základ pro začínající OSVČ (${n(P2026.minVzZacinajici.value)} Kč měsíčně – podmínky ověřte u ČSSZ), nepovinné nemocenské pojištění (${P2026.nemocenskeOsvcSazba.value.toLocaleString("cs-CZ")} %, nejméně ${n(P2026.nemocenskeOsvcMin.value)} Kč měsíčně), odpočty od základu daně (penzijní spoření, dary, úroky z hypotéky), souběh se zaměstnáním v jednom přiznání a slevu na pojistném pro OSVČ, které pobírají starobní důchod.`,
  },
];

const KEYS = [
  "prumernaMzda",
  "sazbaDane",
  "sazbaDaneVyssi",
  "hraniceRocni",
  "slevaPoplatnik",
  "dite1",
  "dite2",
  "dite3",
  "bonusMinRocni",
  "bonusPrijemRocni",
  "socOsvcSazba",
  "socOsvcPodil",
  "minVzHlavni",
  "minZalohaHlavniDoCervna",
  "minZalohaHlavniOdCervence",
  "minVzVedlejsi",
  "minZalohaVedlejsi",
  "minVzZacinajici",
  "rozhodnaCastka",
  "rozhodnaCastkaMesic",
  "maxVzSoc",
  "zdrOsvcPodil",
  "zdrCelkem",
  "minVzZdr",
  "minZalohaZdr",
  "pausal1",
  "pausal1DoCervna",
  "pausal2",
  "pausal3",
] as const satisfies readonly ParamKey[];

const PAGE_SOURCES = uniqueSources(KEYS, [SOURCES.zdp, SOURCES.zakonPojistneSoc, SOURCES.zakonPojistneZdr, SOURCES.zakon90, SOURCES.danovyRadZaokrouhleni, SOURCES.csszDruhySvc]);

export default function OsvcPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Kalkulačka OSVČ 2026: daň a pojistné"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Kalkulačka OSVČ 2026", path: "/kalkulacka-osvc" },
        ]}
        lead={`Zadejte příjmy a výdaje za rok 2026 a uvidíte daň z příjmů, sociální a zdravotní pojištění – i srovnání s paušální daní. Minimální zálohy počítáme podle zákona č. 90/2026 Sb.`}
      />
      <div className="container-page py-10">
        <OsvcCalculator />
        <MoneyParams keys={KEYS} />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-3 text-base text-muted">
            Zdroje:{" "}
            {PAGE_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>{s.label}</ExternalLink>
              </span>
            ))}
            . {MONEY_DISCLAIMER}
          </p>
        </section>
        <RelatedGuides slugs={["eet-a-pausalni-dan", "eet-off", "koho-se-eet-tyka"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
