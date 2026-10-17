import type { Metadata } from "next";
import { czHolidays, weekdayCs } from "@ez/cz/holidays";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { DueDateCalculator } from "@/components/tools/due-date-calculator";
import { ToolFaq } from "@/components/tools/tool-faq";
import { FACTS, SOURCES } from "@/content/facts";
import { formatCzDate } from "@/lib/doc-tools";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S2 B1 (17. 10. 2026): datum splatnosti faktury (§ 605 a § 607 OZ) se svátky podle zákona č. 245/2000 Sb.
 * Právní poznámka jen v rozsahu textu zákona – zda § 607 platí i pro sjednanou splatnost, zákon výslovně neříká.
 */
export const metadata: Metadata = {
  title: "Datum splatnosti faktury: kalkulačka se svátky 2026 a 2027",
  description:
    "Spočítejte datum splatnosti faktury: datum vystavení + počet dní. Uvidíte den v týdnu, zda splatnost nepadá na víkend nebo svátek, a nejbližší pracovní den.",
  ...canonicalMeta("/nastroje/datum-splatnosti"),
};

const FAQ = [
  {
    q: "Od kterého dne se splatnost počítá?",
    a: "Lhůta určená ve dnech začíná dnem, který následuje po skutečnosti rozhodné pro její počátek (§ 605 odst. 1 občanského zákoníku). Faktura vystavená 1. 10. se splatností 14 dní je tedy splatná 15. 10.",
  },
  {
    q: "Co když splatnost připadne na víkend nebo svátek?",
    a: "U lhůt platí § 607 občanského zákoníku: připadne-li poslední den lhůty na sobotu, neděli nebo svátek, je posledním dnem lhůty nejbližší následující pracovní den. Pro sjednanou splatnost faktury to zákon výslovně neuvádí. Chcete-li jistotu, napište na fakturu konkrétní datum, které připadá na pracovní den.",
  },
  {
    q: "Jaká je splatnost, když ji smlouva ani faktura neurčuje?",
    a: "Mezi podnikateli je cena za dodané zboží nebo službu splatná do 30 dnů od doručení faktury (§ 1963 odst. 1 občanského zákoníku). Splatnost delší než 60 dní musí být výslovně ujednaná a nesmí být pro věřitele zvláště nevýhodná (§ 1963 odst. 2).",
  },
  {
    q: "Kdy je faktura zaplacená včas?",
    a: "Při placení přes banku je dluh splněn připsáním částky na účet banky příjemce (§ 1957 odst. 1 občanského zákoníku). Rozhoduje tedy, kdy peníze dorazí, ne kdy je plátce odešle.",
  },
  {
    q: "Eviduje se zaplacení faktury v EET 2.0?",
    a: `${FACTS.evidenced.notEvidenced} ${FACTS.evidenced.summary}`,
  },
];

const FAQ_SOURCES = [SOURCES.oz, SOURCES.svatky, SOURCES.kdoMusi];

const YEARS = [2026, 2027] as const;

export default function DueDatePage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Datum splatnosti faktury"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Datum splatnosti", path: "/nastroje/datum-splatnosti" },
        ]}
        lead="Zadejte datum vystavení a počet dní. Ukážeme den splatnosti i den v týdnu a upozorníme, když vyjde na víkend nebo státní svátek."
      />
      <div className="container-page py-10">
        <DueDateCalculator />
        <section className="mx-auto mt-14 max-w-4xl" aria-labelledby="svatky">
          <h2 id="svatky" className="text-2xl font-bold">
            Státní a ostatní svátky 2026 a 2027
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            Dny pracovního klidu podle zákona č. 245/2000 Sb. Velký pátek a Velikonoční pondělí se mění podle data Velikonoc.
          </p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {YEARS.map((y) => (
              <table key={y} className="w-full text-left text-[15px]">
                <caption className="mb-2 text-left text-lg font-bold text-ink">{y}</caption>
                <tbody>
                  {czHolidays(y).map((h) => (
                    <tr key={h.date} className="border-b border-line align-top">
                      <th scope="row" className="whitespace-nowrap py-2 pr-3 font-semibold tabular-nums text-ink">
                        {formatCzDate(h.date)}
                      </th>
                      <td className="py-2 pr-3 text-muted">{weekdayCs(h.date)}</td>
                      <td className="py-2 text-ink-soft">{h.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>
        <ToolFaq items={FAQ} sources={FAQ_SOURCES} />
        <RelatedGuides slugs={["kontaktni-platba", "eet-remeslnici", "eet-eshop-dobirka"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
