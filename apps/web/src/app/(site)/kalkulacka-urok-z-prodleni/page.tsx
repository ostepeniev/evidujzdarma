import type { Metadata } from "next";
import { ExternalLink } from "@/components/external-link";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { LateInterestCalculator } from "@/components/tools/late-interest-calculator";
import { ToolFaq } from "@/components/tools/tool-faq";
import { SOURCES } from "@/content/facts";
import { formatCzDate } from "@/lib/doc-tools";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { CNB_REPO_VERIFIED_AT, LATE_INTEREST_MARGIN, halfYearLabel, lateInterestTable } from "@/lib/late-interest";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S2 B1 (17. 10. 2026): zákonný úrok z prodlení – NV č. 351/2013 Sb. § 2 odst. 1 (repo ČNB k prvnímu dni pololetí,
 * v němž došlo k prodlení, + 8 p. b.) a § 3 (1 200 Kč mezi podnikateli). Sazby ČNB v lib/late-interest.ts.
 */
export const metadata: Metadata = {
  title: "Kalkulačka úroku z prodlení 2026: repo ČNB + 8 %",
  description:
    "Zákonný úrok z prodlení podle nařízení vlády č. 351/2013 Sb.: repo sazba ČNB k 1. dni pololetí + 8 p. b. Tabulka sazeb 2024–2026 a 1 200 Kč mezi podnikateli.",
  ...canonicalMeta("/kalkulacka-urok-z-prodleni"),
};

const pct = (n: number) => `${n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

export default function LateInterestPage() {
  const table = lateInterestTable(2024);
  const latest = table[table.length - 1]!;
  const FAQ = [
    {
      q: "Jak vysoký je zákonný úrok z prodlení?",
      a: `Ročně tolik, kolik činí repo sazba ČNB platná první den kalendářního pololetí, ve kterém k prodlení došlo, zvýšená o ${LATE_INTEREST_MARGIN} procentních bodů (§ 2 odst. 1 nařízení vlády č. 351/2013 Sb.). Pro prodlení, které začalo v ${halfYearLabel(latest.halfYear)}, je to ${pct(latest.repo)} + ${LATE_INTEREST_MARGIN} = ${pct(latest.rate)} ročně.`,
    },
    {
      q: "Mění se sazba, když prodlení trvá déle než pololetí?",
      a: "Ne. Rozhoduje pololetí, ve kterém k prodlení došlo, a sazba podle něj platí po celou dobu prodlení – i když se repo sazba ČNB mezitím změní.",
    },
    {
      q: "Od kdy se úrok z prodlení počítá?",
      a: "Ode dne po splatnosti. Dlužník, který svůj dluh řádně a včas neplní, je v prodlení (§ 1968 občanského zákoníku). Úrok může požadovat věřitel, který sám řádně splnil své povinnosti, ledaže dlužník za prodlení neodpovídá (§ 1970). Kalkulačka počítá každý den prodlení jako 1/365 roční sazby.",
    },
    {
      q: "Co je 1 200 Kč za uplatnění pohledávky?",
      a: "Jde-li o závazek mezi podnikateli, nebo o dodávku zboží či služby podnikatele veřejnému zadavateli, činí minimální výše nákladů spojených s uplatněním každé pohledávky 1 200 Kč (§ 3 nařízení vlády č. 351/2013 Sb.).",
    },
    {
      q: "Můžeme si ve smlouvě sjednat jiný úrok z prodlení?",
      a: "Ano. Sazba z nařízení vlády platí, neujednají-li strany jinou (§ 1970 občanského zákoníku). Mezi podnikateli je ale neplatné ujednání o úroku z prodlení, které je pro věřitele zvláště nevýhodné (§ 1964).",
    },
  ];
  const FAQ_SOURCES = [SOURCES.nv351, SOURCES.cnbRepo, SOURCES.cnbRepo2026, SOURCES.oz];

  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Kalkulačka úroku z prodlení"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Úrok z prodlení", path: "/kalkulacka-urok-z-prodleni" },
        ]}
        lead="Zadejte dlužnou částku, den splatnosti a den zaplacení. Úrok spočítáme podle nařízení vlády č. 351/2013 Sb. se sazbou pro pololetí, ve kterém prodlení začalo."
      />
      <div className="container-page py-10">
        <LateInterestCalculator />
        <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="sazby">
          <h2 id="sazby" className="text-2xl font-bold">
            Sazby úroku z prodlení 2024–2026
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            Repo sazba ČNB platná první den pololetí + {LATE_INTEREST_MARGIN} procentních bodů. Sazba podle pololetí, ve kterém prodlení začalo, platí až do
            zaplacení.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-[15px] tabular-nums">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Prodlení začalo v
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Repo sazba ČNB k 1. dni
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Úrok z prodlení ročně
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.halfYear} className="border-b border-line">
                    <th scope="row" className="py-2 pr-4 font-semibold text-ink">
                      {halfYearLabel(row.halfYear)}
                    </th>
                    <td className="py-2 pr-4 text-right text-ink-soft">{pct(row.repo)}</td>
                    <td className="py-2 text-right font-semibold text-ink">{pct(row.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            Repo sazby podle{" "}
            <ExternalLink href={SOURCES.cnbRepo.url} className="underline underline-offset-2">
              České národní banky
            </ExternalLink>
            , ověřeno {formatCzDate(CNB_REPO_VERIFIED_AT)}. Kalkulačka zná sazby pro prodlení od 1. 1. 2014, kdy nařízení vlády č. 351/2013 Sb. nabylo
            účinnosti. Úrok z prodlení s výživným pro nezletilé dítě se od 1. 1. 2026 řídí zvláštním pravidlem (§ 2 odst. 2) – tato kalkulačka ho neřeší.
          </p>
        </section>
        <ToolFaq items={FAQ} sources={FAQ_SOURCES} />
        <RelatedGuides slugs={["eet-remeslnici", "kontaktni-platba", "koho-se-eet-tyka"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
