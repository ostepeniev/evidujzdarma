import { RELEVANCE_LABEL, type EetRelevance } from "@ez/cz";
import { FACTS, SOURCES, timelineAt, type Source } from "@/content/facts";

/**
 * FAQ stránek katalogu (S2). Odpovědi skládáme JEN z faktů ve facts.ts a z polí registru – žádný vlastní výklad zákona.
 * Odhad „EET relevance“ je vždy označený jako orientační (heuristika podle oboru, ne právní posouzení).
 */

export interface CatalogFaqItem {
  q: string;
  a: string;
  /** odpověď má na stránce i odkaz (kontrola IČO) */
  link?: { href: string; label: string };
}

/** 1 provozovna / 2 provozovny / 5 provozoven */
export function pluralCs(n: number, forms: [one: string, few: string, many: string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return forms[0];
  if (abs >= 2 && abs <= 4) return forms[1];
  return forms[2];
}

/** „2. 11. 2026“ z ISO data (bez časových pásem). */
function dateCs(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : iso;
}

function uniqueSources(list: readonly Source[]): Source[] {
  return [...new Map(list.map((s) => [s.url, s])).values()];
}

const RELEVANCE_OBOR: Record<EetRelevance, string> = {
  likely: "Zákazníci v oboru obvykle platí osobně (hotově, kartou nebo QR kódem na místě), proto se evidence pravděpodobně týká většiny podnikatelů.",
  possible: "V oboru se platí osobně i převodem na fakturu. Zda evidovat, záleží na tom, jak vám zákazníci platí.",
  unlikely: "V oboru se obvykle platí převodem na fakturu, který se neeviduje. Kdo ale přijímá platby osobně, evidovat musí.",
};

/** FAQ stránky obor × obec (5 otázek). */
export function obecIndustryFaq(input: { industryLabel: string; obec: string; relevance: EetRelevance }): { items: CatalogFaqItem[]; sources: Source[] } {
  const dis = timelineAt("2026-11-01");
  const items: CatalogFaqItem[] = [
    {
      q: `Musí podnikatelé v oboru „${input.industryLabel}“ v obci ${input.obec} evidovat tržby?`,
      a: `${FACTS.whoMust.summary} Povinnost platí od ${FACTS.law.effectiveFrom} (${FACTS.law.sbNo}). Rozhoduje způsob placení, ne obor ani obec. ${RELEVANCE_OBOR[input.relevance]} Náš orientační odhad pro obor: ${RELEVANCE_LABEL[input.relevance]}.`,
    },
    {
      q: "Které platby se evidují a které ne?",
      a: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}`,
    },
    {
      q: "Co když v provozovně vypadne internet?",
      a: FACTS.offline.summary,
    },
    {
      q: "Co je potřeba udělat před 1. 1. 2027?",
      a: `Od ${dis.dateLabel} se v DIS+ (portál MOJE daně) přihlásíte k evidenci tržeb, oznámíte evidenční jednotky a vygenerujete pokladní certifikát. ${FACTS.certificate.summary} Evidovat se musí od ${FACTS.law.effectiveFrom}.`,
    },
    {
      q: "Může malý podnikatel místo evidence platit přirážku (EET OFF)?",
      a: `${FACTS.eetOff.summary} ${FACTS.eetOff.naturalOnly} ${FACTS.eetOff.howTo}`,
    },
  ];
  return {
    items,
    sources: uniqueSources([...FACTS.whoMust.sources, ...FACTS.evidenced.sources, ...FACTS.offline.sources, SOURCES.harmonogram, ...FACTS.certificate.sources, ...FACTS.eetOff.sources]),
  };
}

export interface FirmFaqInput {
  ico: string;
  name: string;
  isNaturalPerson: boolean;
  dic: string | null;
  vatPayer: boolean | null;
  foundedAt: string | null;
  dissolvedAt: string | null;
  /** sídlo – jen u právnických osob (u OSVČ ho stránka vůbec nedostane) */
  seat: string | null;
  /** null = provozovny zatím neověřeny v RŽP */
  establishments: number | null;
  eetRelevance: EetRelevance;
  /** obory, podle kterých jsme odhad udělali (popisky NACE) */
  matched: string[];
  /** datum, ke kterému jsou údaje (ARES/RES) */
  sourceDate: string;
  sourceKind: "ares" | "res";
}

/** FAQ stránky firmy (5–8 otázek) jen z polí registru a z facts.ts. */
export function firmFaq(firm: FirmFaqInput, links: { kontrolaIco: string }): { items: CatalogFaqItem[]; sources: Source[] } {
  const reg = firm.sourceKind === "ares" ? "ARES" : "Registru ekonomických subjektů ČSÚ";
  const asOf = `k ${dateCs(firm.sourceDate)}`;
  const items: CatalogFaqItem[] = [{ q: `Jaké IČO má ${firm.name}?`, a: `${firm.name} má IČO ${firm.ico}.${firm.dic ? ` DIČ: ${firm.dic}.` : ""}` }];

  if (firm.vatPayer !== null) {
    items.push({
      q: `Je ${firm.name} plátce DPH?`,
      a: firm.vatPayer
        ? `Ano. Podle ARES ${asOf} je subjekt veden jako plátce DPH${firm.dic ? ` s DIČ ${firm.dic}` : ""}.`
        : `Podle ARES ${asOf} subjekt není veden jako plátce DPH.${firm.dic ? ` DIČ: ${firm.dic}.` : ""}`,
    });
  }

  if (!firm.isNaturalPerson && firm.seat) {
    items.push({ q: `Kde sídlí ${firm.name}?`, a: `Sídlo podle ${reg} ${asOf}: ${firm.seat}.` });
  }

  if (firm.foundedAt) {
    items.push({
      q: firm.isNaturalPerson ? `Od kdy podniká ${firm.name}?` : `Od kdy existuje ${firm.name}?`,
      a: `Datum vzniku podle ${reg}: ${dateCs(firm.foundedAt)}.${firm.dissolvedAt ? ` Datum zániku: ${dateCs(firm.dissolvedAt)}.` : ""}`,
    });
  }

  if (firm.establishments !== null) {
    const n = firm.establishments;
    items.push({
      q: `Kolik provozoven má ${firm.name}?`,
      a:
        n === 0
          ? "V živnostenském rejstříku nemá evidovanou žádnou aktivní provozovnu."
          : `V živnostenském rejstříku má ${n} ${pluralCs(n, ["aktivní provozovnu", "aktivní provozovny", "aktivních provozoven"])}. Číslo provozovny (IČP) není číslo evidenční jednotky EET – to přidělí Finanční správa v DIS+.`,
    });
  }

  if (!firm.dissolvedAt) {
    const basis = firm.matched.length ? ` (${firm.matched.join(", ")})` : "";
    const verdict: Record<EetRelevance, string> = {
      likely: `Podle oboru činnosti${basis} pravděpodobně ano.`,
      possible: `Možná. Podle oboru činnosti${basis} se to odhadnout nedá, záleží na způsobu placení.`,
      unlikely: `Podle oboru činnosti${basis} spíše ne.`,
    };
    items.push({
      q: `Musí ${firm.name} evidovat tržby (EET 2.0)?`,
      a: `${verdict[firm.eetRelevance]} Od ${FACTS.law.effectiveFrom} musí evidovat každý, kdo přijímá platby osobně (hotově, kartou nebo QR kódem na místě), a to bez ohledu na obor – výjimku mají jen činnosti vyjmuté zákonem (${FACTS.law.sections.exemptions}). Z registru nepoznáme, jak subjekt platby přijímá, takže jde jen o orientační odhad, ne o právní posouzení. Podrobnější výsledek ukáže kontrola IČO.`,
      link: { href: links.kontrolaIco, label: `Kontrola EET pro IČO ${firm.ico}` },
    });
    items.push({
      q: `Může ${firm.name} využít EET OFF?`,
      a: firm.isNaturalPerson
        ? `${FACTS.eetOff.summary} Zda je subjekt v paušálním režimu, z veřejných registrů nezjistíme. ${FACTS.eetOff.howTo}`
        : `Ne. ${FACTS.eetOff.naturalOnly} Právnická osoba, která přijímá platby osobně, eviduje tržby od ${FACTS.law.effectiveFrom}, pokud nejde o činnost vyjmutou zákonem (${FACTS.law.sections.exemptions}).`,
    });
  }

  return { items, sources: uniqueSources([...FACTS.whoMust.sources, ...FACTS.eetOff.sources]) };
}
