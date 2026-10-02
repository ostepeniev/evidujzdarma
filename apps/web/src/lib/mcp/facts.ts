/** Fakta o EET 2.0 rozdělená na témata pro MCP nástroj eet_get_facts (jediný zdroj: facts.ts). */
import { FACTS, LAW_HISTORY, TIMELINE, formatKc, type Source } from "@/content/facts";

export const FACT_TOPICS = [
  "law",
  "timeline",
  "january_pilot",
  "who_must",
  "exemptions",
  "evidenced_payments",
  "offline",
  "receipt",
  "units",
  "certificate",
  "eet_off",
  "flat_tax",
  "tax_credit",
  "penalties",
  "moje_eet",
  "law_history",
] as const;
export type FactTopic = (typeof FACT_TOPICS)[number];

export interface FactItem {
  topic: FactTopic;
  title: string;
  text: string;
  sources: Source[];
}

const uniq = (sources: readonly Source[]): Source[] => [...new Map(sources.map((s) => [s.url, s])).values()];

export function factItem(topic: FactTopic): FactItem {
  switch (topic) {
    case "law":
      return {
        topic,
        title: "Zákon o evidenci tržeb (EET 2.0)",
        text: `${FACTS.law.name}, ${FACTS.law.printNo}. Podepsán ${FACTS.law.signedOn}, účinnost od ${FACTS.law.effectiveFrom} (${FACTS.law.sections.effect}). Číslo ve Sbírce zákonů zatím nebylo zveřejněno.`,
        sources: [...FACTS.law.sources],
      };
    case "timeline":
      return {
        topic,
        title: "Harmonogram",
        text: TIMELINE.map((t) => `${t.dateLabel} – ${t.title}: ${t.action}`).join("\n"),
        sources: uniq(TIMELINE.map((t) => t.source)),
      };
    case "january_pilot":
      return { topic, title: "Leden 2027 („pilotní“ měsíc)", text: FACTS.pilot.summary, sources: [...FACTS.pilot.sources] };
    case "who_must":
      return { topic, title: "Kdo musí evidovat", text: `${FACTS.whoMust.summary} ${FACTS.whoMust.notCovered}`, sources: [...FACTS.whoMust.sources] };
    case "exemptions":
      return { topic, title: "Výjimky a příležitostné tržby", text: `${FACTS.whoMust.exemptions}\n${FACTS.whoMust.occasional}`, sources: [...FACTS.whoMust.sources] };
    case "evidenced_payments":
      return {
        topic,
        title: "Které platby se evidují",
        text: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced} ${FACTS.evidenced.prepayments}`,
        sources: [...FACTS.evidenced.sources],
      };
    case "offline":
      return { topic, title: "Výpadek spojení a lhůta 48 hodin", text: `${FACTS.offline.summary} ${FACTS.offline.responseTimeout}`, sources: [...FACTS.offline.sources] };
    case "receipt":
      return { topic, title: "Účtenka a POK", text: `${FACTS.receipt.summary} ${FACTS.confirmation.summary} ${FACTS.confirmation.onReceipt}`, sources: uniq([...FACTS.receipt.sources, ...FACTS.confirmation.sources]) };
    case "units":
      return { topic, title: "Evidenční jednotky", text: `${FACTS.units.summary} ${FACTS.units.allUnits} ${FACTS.units.change}`, sources: [...FACTS.units.sources] };
    case "certificate":
      return { topic, title: "Pokladní certifikát", text: FACTS.certificate.summary, sources: [...FACTS.certificate.sources] };
    case "eet_off":
      return {
        topic,
        title: "Režim EET OFF",
        text: [
          FACTS.eetOff.summary,
          `Přirážka ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně = ${formatKc(FACTS.eetOff.surchargeYearly)} ročně.`,
          FACTS.eetOff.howTo,
          FACTS.eetOff.naturalOnly,
          FACTS.eetOff.binding,
          FACTS.eetOff.midYear,
          FACTS.eetOff.overLimit,
          FACTS.eetOff.exit,
        ].join(" "),
        sources: [...FACTS.eetOff.sources],
      };
    case "flat_tax": {
      const p = FACTS.pausal;
      return {
        topic,
        title: "Paušální záloha (měsíčně)",
        text: `2026: 1. pásmo ${formatKc(p[2026].band1)}, 2. pásmo ${formatKc(p[2026].band2)}, 3. pásmo ${formatKc(p[2026].band3)}. 2027 (předběžně): 1. pásmo ${formatKc(p[2027].band1)}, 2. pásmo ${formatKc(p[2027].band2)}, 3. pásmo ${formatKc(p[2027].band3)}. S přirážkou EET OFF v 1. pásmu 2027: ${formatKc(p[2027].band1 + FACTS.eetOff.surchargeMonthly)}.`,
        sources: [...p.sources],
      };
    }
    case "tax_credit":
      return { topic, title: "Sleva na dani až 5 000 Kč", text: FACTS.taxCredit.summary, sources: [...FACTS.taxCredit.sources] };
    case "penalties":
      return { topic, title: "Pokuty", text: FACTS.penalties.summary, sources: [...FACTS.penalties.sources] };
    case "moje_eet":
      return { topic, title: "Státní aplikace MOJE eet", text: FACTS.mojeEet.summary, sources: [...FACTS.mojeEet.sources] };
    case "law_history":
      return {
        topic,
        title: "Jak zákon vznikal",
        text: LAW_HISTORY.map((s) => `${s.dateLabel} – ${s.text}`).join("\n"),
        sources: uniq(LAW_HISTORY.map((s) => s.source)),
      };
  }
}
