import type { Metadata } from "next";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ReviewNote } from "@/components/review-note";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { TipsCalculator } from "@/components/tools/tips-calculator";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { kc } from "@/lib/money-2026";
import { MONEY_DISCLAIMER, MONEY_REVIEWED_ON, moneyRobots } from "@/lib/money-review";
import { TIPS_DEFAULT, TIP_EXEMPT_PERCENT, TIP_RULE_FROM, calculateTips } from "@/lib/tips";

/**
 * S2/B2 (17. 10. 2026): spropitné ze stravovacích služeb – § 6 odst. 9 písm. g) a odst. 19 ZDP ve znění zákona č. 180/2026 Sb.
 * Kalkulačka jen přepočítává doslovné znění zákona. Co zákon neříká, je v bloku „Co zákon výslovně neřeší“ a v otázkách pro
 * účetní (hlášení S2/B2). Index až po kontrole účetní (lib/money-review.ts) – zkontrolovala ji 17. 10. 2026.
 */
export const metadata: Metadata = {
  title: "Kalkulačka spropitného 2027: osvobození do 7 % v gastronomii",
  description:
    "Spropitné zaměstnanců v restauraci či kavárně je od 1. 1. 2027 osvobozené od daně do 7 % měsíčních příjmů podniku ze stravovacích služeb. Spočítejte limit na zaměstnance a část nad limit.",
  ...canonicalMeta("/kalkulacka-spropitne"),
  ...moneyRobots(),
};

const ex = calculateTips(TIPS_DEFAULT);

const FAQ = [
  {
    q: "Od kdy je spropitné osvobozené?",
    a: `Od ${TIP_RULE_FROM}, kdy nabývá účinnosti zákon č. 180/2026 Sb. Ten kromě evidence tržeb mění i zákon o daních z příjmů – nové znění § 6 odst. 9 písm. g) osvobozuje spropitné ze stravovacích služeb.`,
  },
  {
    q: "Počítá se 7 % z každého účtu?",
    a: `Ne. Zákon limit nepočítá z jednotlivého účtu ani z jednotlivé platby. Limit je měsíční a vychází z měsíčních příjmů zaměstnavatele ze stravovacích služeb: ${TIP_EXEMPT_PERCENT} % z nich se rozdělí mezi zaměstnance, kteří v daném měsíci spropitné dostali. Spropitné 20 % z jednoho účtu tak může být celé osvobozené, pokud se zaměstnanec za měsíc vejde do svého limitu.`,
  },
  {
    q: "Na koho se osvobození vztahuje?",
    a: "Na zaměstnance, který pracuje v provozovně stravovacích služeb, kde je spropitné obvyklé. Provozovnou se rozumí provozovna podle živnostenského zákona, ve které se připravují a prodávají pokrmy k přímé spotřebě na místě. Spropitné musí host dát dobrovolně a v přímé souvislosti se stravovací službou. Na podnikatele (OSVČ) a jejich vlastní spropitné se toto osvobození nevztahuje – týká se příjmů zaměstnanců.",
  },
  {
    q: "Jak se limit dělí mezi zaměstnance?",
    a: `Dvěma způsoby. Buď rovným dílem: ${TIP_EXEMPT_PERCENT} % měsíčních příjmů ze stravovacích služeb vydělené počtem zaměstnanců, kteří v měsíci spropitné dostali. Nebo částkou, kterou určí zaměstnavatel – úhrn osvobozeného spropitného všech jeho zaměstnanců ale nesmí přesáhnout ${TIP_EXEMPT_PERCENT} % těchto příjmů. Příklad: při příjmech ${kc(TIPS_DEFAULT.monthlyFoodIncome)} je limit ${kc(ex.cap)} za měsíc; dostanou-li spropitné ${ex.recipients} zaměstnanci, připadá rovným dílem na každého ${ex.perEmployeeLimit === null ? "0 Kč" : kc(ex.perEmployeeLimit)}.`,
  },
  {
    q: "Co s částí spropitného nad limit?",
    a: "Je to zdanitelný příjem zaměstnance ze závislé činnosti. Za plátce příjmu v podobě spropitného se podle § 6 odst. 19 zákona o daních z příjmů považuje zaměstnavatel. Jak ji zdanit, vykázat a zda se z ní platí pojistné, Finanční správa zatím podrobně nepopsala – proberte to s účetní.",
  },
  {
    q: "Eviduje se spropitné v EET 2.0?",
    a: "Výslovné stanovisko Finanční správy zatím není. Když host zaplatí kartou i se spropitným, pokladna pracuje s celkovou přijatou částkou. Spropitné, které host dá číšníkovi přímo do ruky, je jiná situace. Postup doporučujeme probrat s účetní.",
  },
];

/** Co z doslovného znění zákona neplyne – kalkulačka to nerozhoduje (otázky pro účetní v hlášení S2/B2). */
const OPEN = [
  "Zda se u plátce DPH počítají „měsíční příjmy ze stravovacích služeb“ s DPH, nebo bez ní, a zda do nich patří i spropitné zaplacené kartou přes pokladnu podniku.",
  "Koho přesně započítat do počtu zaměstnanců pro rovný díl (například brigádníky na dohodu nebo kuchaře, kteří se o spropitné dělí).",
  "Jak doložit, že osvobozené částky určil zaměstnavatel (druhý způsob), a v jaké formě.",
  "Jak zaměstnavatel jako plátce zdaní část nad limit, když spropitné dal host zaměstnanci přímo do ruky, a zda se z ní platí sociální a zdravotní pojištění.",
];

const PAGE_SOURCES = [SOURCES.sbirka, SOURCES.zdp, SOURCES.zakonUplne];

export default function TipsPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Kalkulačka spropitného od roku 2027"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Spropitné v gastronomii", path: "/kalkulacka-spropitne" },
        ]}
        lead={`Od ${TIP_RULE_FROM} je spropitné zaměstnanců v restauracích, kavárnách a bistrech osvobozené od daně – do ${TIP_EXEMPT_PERCENT} % měsíčních příjmů podniku ze stravovacích služeb. Spočítejte limit na zaměstnance a část, která se do něj nevejde.`}
      >
        <ReviewNote date={MONEY_REVIEWED_ON} />
      </PageHeader>
      <div className="container-page py-10">
        <TipsCalculator />
        <section className="mx-auto mt-14 max-w-3xl rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="co-zakon-neresi">
          <h2 id="co-zakon-neresi" className="text-xl font-bold">
            Co zákon výslovně neřeší
          </h2>
          <p className="mt-2 text-[15px] text-ink-soft">Výklad Finanční správy k novému osvobození jsme k 17. 10. 2026 nenašli. Tyto otázky proto doporučujeme probrat s účetní:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] text-ink-soft">
            {OPEN.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>
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
            . Znění § 6 odst. 9 písm. g) a odst. 19 zákona o daních z příjmů podle zákona č. 180/2026 Sb. (část druhá, účinnost {TIP_RULE_FROM}). {MONEY_DISCLAIMER}
          </p>
        </section>
        <RelatedGuides slugs={["eet-gastronomie", "kontaktni-platba", "musim-vydavat-uctenku"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
