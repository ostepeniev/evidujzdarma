import type { Metadata } from "next";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { MoneyParams } from "@/components/money-params";
import { PageHeader } from "@/components/page-header";
import { ReviewNote } from "@/components/review-note";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { NetWageCalculator } from "@/components/tools/net-wage-calculator";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { P2026, kc, uniqueSources, type ParamKey } from "@/lib/money-2026";
import { MONEY_DISCLAIMER, MONEY_REVIEWED_ON, moneyRobots } from "@/lib/money-review";
import { calculateNetWage } from "@/lib/net-wage";

/**
 * S2/B2 (17. 10. 2026): kalkulačka čisté mzdy 2026. Peněžní kalkulačka: index, sitemap, llms a rozcestník až po kontrole
 * účetní (lib/money-review.ts, MONEY_CALCULATORS_REVIEWED) – zkontrolovala ji 17. 10. 2026 (S3-OPEN, ReviewNote).
 */
export const metadata: Metadata = {
  title: "Kalkulačka čisté mzdy 2026 – výpočet z hrubé mzdy",
  description:
    "Spočítejte čistou mzdu za rok 2026: sociální 7,1 % a zdravotní pojištění 4,5 %, záloha na daň 15 % a 23 %, sleva na poplatníka 2 570 Kč a daňové zvýhodnění na děti. I náklady zaměstnavatele.",
  ...canonicalMeta("/kalkulacka-cista-mzda"),
  ...moneyRobots(),
};

const ex = calculateNetWage({ gross: 40_000, declaration: true, children: 0 });
const exNet = ex.ok ? kc(ex.net) : "";
const m = (x: number) => (x / 12).toLocaleString("cs-CZ");

const FAQ = [
  {
    q: "Jak se počítá čistá mzda v roce 2026?",
    a: `Z hrubé mzdy se odečte sociální pojištění zaměstnance 7,1 % a zdravotní pojištění 4,5 %. Záloha na daň je 15 % ze základu zaokrouhleného na stokoruny nahoru (23 % z části nad ${P2026.hraniceMesicni.value.toLocaleString("cs-CZ")} Kč) a sníží se o slevu na poplatníka a o daňové zvýhodnění na děti. Například z hrubé mzdy 40 000 Kč vychází s podepsaným prohlášením čistá mzda ${exNet}.`,
  },
  {
    q: "Kolik je sleva na poplatníka v roce 2026?",
    a: `${P2026.slevaPoplatnik.value.toLocaleString("cs-CZ")} Kč ročně, tedy ${m(P2026.slevaPoplatnik.value)} Kč měsíčně (§ 35ba zákona o daních z příjmů). U zaměstnavatele ji uplatníte jen s podepsaným prohlášením poplatníka, a to jen u jednoho zaměstnavatele.`,
  },
  {
    q: "Kolik je daňové zvýhodnění na děti v roce 2026?",
    a: `Na první dítě ${P2026.dite1.value.toLocaleString("cs-CZ")} Kč ročně (${m(P2026.dite1.value)} Kč měsíčně), na druhé ${P2026.dite2.value.toLocaleString("cs-CZ")} Kč (${m(P2026.dite2.value)} Kč měsíčně), na třetí a každé další ${P2026.dite3.value.toLocaleString("cs-CZ")} Kč (${m(P2026.dite3.value)} Kč měsíčně). Co se nevejde do zálohy na daň, vyplatí zaměstnavatel jako daňový bonus – měsíčně od 50 Kč a při mzdě aspoň ${Math.floor(P2026.minimalniMzda.value / 2).toLocaleString("cs-CZ")} Kč (polovina minimální mzdy).`,
  },
  {
    q: "Od jaké mzdy se platí daň 23 %?",
    a: `U měsíční zálohy z části základu nad ${P2026.hraniceMesicni.value.toLocaleString("cs-CZ")} Kč (trojnásobek průměrné mzdy ${P2026.prumernaMzda.value.toLocaleString("cs-CZ")} Kč). V ročním zúčtování nebo přiznání z části základu daně nad ${P2026.hraniceRocni.value.toLocaleString("cs-CZ")} Kč (36násobek průměrné mzdy).`,
  },
  {
    q: "Jak se částky zaokrouhlují?",
    a: "Pojistné se zaokrouhluje na celé koruny nahoru. Základ pro výpočet zálohy na daň se zaokrouhluje na celé stokoruny nahoru (do 100 Kč na celé koruny) a záloha na celé koruny nahoru – tak to pro rok 2026 stanoví § 38h zákona o daních z příjmů.",
  },
  {
    q: "Kolik za zaměstnance platí zaměstnavatel?",
    a: "K hrubé mzdě přidává sociální pojištění 24,8 % a zdravotní pojištění 9 % (dvě třetiny z celkových 13,5 %). Celková cena práce je tedy zhruba o třetinu vyšší než hrubá mzda.",
  },
  {
    q: "Mám nárok na slevu na studenta?",
    a: "Pro rok 2026 ji zákon o daních z příjmů mezi slevami na dani (§ 35ba) neuvádí. Kalkulačka ji proto nepočítá.",
  },
  {
    q: "Co kalkulačka nepočítá?",
    a: `Dohody o provedení práce a o pracovní činnosti, srážkovou daň, mzdy pod ${P2026.rozhodnyPrijemZam.value.toLocaleString("cs-CZ")} Kč, slevy na invaliditu a dítě s průkazem ZTP/P, doplatek zdravotního pojištění do minimální mzdy, slevu zaměstnavatele na pojistném a roční zúčtování. Ve složitějších případech se obraťte na mzdovou účetní.`,
  },
];

const KEYS = [
  "prumernaMzda",
  "minimalniMzda",
  "socZamestnanec",
  "zdrCelkem",
  "socZamestnavatel",
  "sazbaDane",
  "sazbaDaneVyssi",
  "hraniceMesicni",
  "hraniceRocni",
  "slevaPoplatnik",
  "dite1",
  "dite2",
  "dite3",
  "bonusMinMesicni",
  "maxVzSoc",
  "rozhodnyPrijemZam",
] as const satisfies readonly ParamKey[];

const PAGE_SOURCES = uniqueSources(KEYS, [SOURCES.zdp, SOURCES.zakonPojistneSoc, SOURCES.zakonPojistneZdr]);

export default function NetWagePage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Kalkulačka čisté mzdy 2026"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Čistá mzda 2026", path: "/kalkulacka-cista-mzda" },
        ]}
        lead={`Zadejte hrubou mzdu a zjistíte, kolik dostanete na účet a kolik vás platí zaměstnavatel. Počítáme s parametry pro rok 2026 přímo ze zákona, ČSSZ a VZP.`}
      >
        <ReviewNote date={MONEY_REVIEWED_ON} />
      </PageHeader>
      <div className="container-page py-10">
        <NetWageCalculator />
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
        <RelatedGuides slugs={["koho-se-eet-tyka", "eet-2-0-kompletni-pruvodce", "pokladna-v-mobilu-zdarma"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
