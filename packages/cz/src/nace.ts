/**
 * Heuristika "EET relevance" podle CZ-NACE.
 *
 * NEJDE o právní posouzení. Říká jen, zda obor typicky přijímá platby od spotřebitelů
 * (hotovost, karta), a proto pravděpodobně spadá do evidence tržeb. Výjimky z EET
 * se posuzují podle zákona a konkrétních plateb — viz průvodce na webu.
 */

export type EetRelevance = "likely" | "possible" | "unlikely";

export interface NaceRule {
  prefix: string;
  label: string;
  relevance: EetRelevance;
  /** slug průvodce /eet-pro/{slug}, pokud existuje */
  guide?: string;
}

// Pořadí: delší (specifičtější) prefixy mají přednost — řešeno v `classifyNace`.
export const NACE_RULES: readonly NaceRule[] = [
  { prefix: "47", label: "Maloobchod", relevance: "likely", guide: "maloobchod" },
  { prefix: "55", label: "Ubytování", relevance: "likely", guide: "ubytovani" },
  { prefix: "56", label: "Stravování a pohostinství", relevance: "likely", guide: "restaurace-a-kavarny" },
  { prefix: "9602", label: "Kadeřnictví a kosmetika", relevance: "likely", guide: "kadernictvi-a-kosmetika" },
  { prefix: "9604", label: "Fitness, sauny, wellness", relevance: "likely" },
  { prefix: "9609", label: "Ostatní osobní služby", relevance: "likely" },
  { prefix: "96", label: "Osobní služby", relevance: "likely" },
  { prefix: "93", label: "Sport, zábava a rekreace", relevance: "likely" },
  { prefix: "952", label: "Opravy výrobků pro osobní potřebu", relevance: "likely", guide: "remeslnici-a-sluzby" },
  { prefix: "4932", label: "Taxislužba", relevance: "likely" },
  { prefix: "452", label: "Opravy a údržba motorových vozidel", relevance: "likely", guide: "remeslnici-a-sluzby" },
  { prefix: "4532", label: "Maloobchod s díly pro vozidla", relevance: "likely" },
  { prefix: "1071", label: "Pekařství a cukrářství", relevance: "likely" },
  { prefix: "79", label: "Cestovní kanceláře a agentury", relevance: "possible" },
  { prefix: "43", label: "Specializované stavební činnosti (řemesla)", relevance: "possible", guide: "remeslnici-a-sluzby" },
  { prefix: "812", label: "Úklidové činnosti", relevance: "possible", guide: "remeslnici-a-sluzby" },
  { prefix: "855", label: "Kurzy a ostatní vzdělávání", relevance: "possible" },
  { prefix: "742", label: "Fotografické činnosti", relevance: "possible" },
  { prefix: "772", label: "Půjčovny", relevance: "possible" },
  { prefix: "75", label: "Veterinární činnosti", relevance: "possible" },
  { prefix: "86", label: "Zdravotní péče", relevance: "possible" },
  { prefix: "90", label: "Tvůrčí, umělecké a zábavní činnosti", relevance: "possible" },
  { prefix: "01", label: "Zemědělství (prodej ze dvora)", relevance: "possible" },
  { prefix: "10", label: "Výroba potravin", relevance: "possible" },
  { prefix: "11", label: "Výroba nápojů", relevance: "possible" },
  { prefix: "45", label: "Obchod a opravy motorových vozidel", relevance: "possible" },
  { prefix: "46", label: "Velkoobchod", relevance: "unlikely" },
  { prefix: "41", label: "Výstavba budov", relevance: "unlikely" },
  { prefix: "42", label: "Inženýrské stavitelství", relevance: "unlikely" },
  { prefix: "49", label: "Pozemní doprava", relevance: "possible" },
  { prefix: "494", label: "Silniční nákladní doprava", relevance: "unlikely" },
  { prefix: "62", label: "IT a programování", relevance: "unlikely" },
  { prefix: "63", label: "Informační činnosti", relevance: "unlikely" },
  { prefix: "64", label: "Finanční služby", relevance: "unlikely" },
  { prefix: "65", label: "Pojišťovnictví", relevance: "unlikely" },
  { prefix: "66", label: "Ostatní finanční činnosti", relevance: "unlikely" },
  { prefix: "68", label: "Činnosti v oblasti nemovitostí", relevance: "unlikely" },
  { prefix: "69", label: "Právní a účetní činnosti", relevance: "unlikely" },
  { prefix: "70", label: "Poradenství v oblasti řízení", relevance: "unlikely" },
  { prefix: "71", label: "Architektonické a inženýrské činnosti", relevance: "unlikely" },
  { prefix: "72", label: "Výzkum a vývoj", relevance: "unlikely" },
  { prefix: "73", label: "Reklama a průzkum trhu", relevance: "unlikely" },
  { prefix: "84", label: "Veřejná správa", relevance: "unlikely" },
];

function digits(code: string): string {
  return code.replace(/\D/g, "");
}

export function classifyNace(code: string): NaceRule | undefined {
  const c = digits(code);
  let best: NaceRule | undefined;
  for (const rule of NACE_RULES) {
    if (c.startsWith(rule.prefix) && (!best || rule.prefix.length > best.prefix.length)) best = rule;
  }
  return best;
}

const ORDER: Record<EetRelevance, number> = { likely: 3, possible: 2, unlikely: 1 };

/** Nejvyšší relevance napříč všemi obory subjektu; bez oborů → "possible". */
export function classifyNaceList(codes: readonly string[]): { relevance: EetRelevance; matched: NaceRule[] } {
  const matched: NaceRule[] = [];
  for (const code of codes) {
    const rule = classifyNace(code);
    if (rule && !matched.includes(rule)) matched.push(rule);
  }
  if (matched.length === 0) return { relevance: "possible", matched };
  const relevance = matched.reduce<EetRelevance>(
    (acc, r) => (ORDER[r.relevance] > ORDER[acc] ? r.relevance : acc),
    "unlikely",
  );
  return { relevance, matched };
}

export const RELEVANCE_LABEL: Record<EetRelevance, string> = {
  likely: "pravděpodobně ano",
  possible: "možná – ověřte",
  unlikely: "spíše ne",
};
