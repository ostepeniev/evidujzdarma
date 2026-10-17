import type { EetRelevance } from "@ez/cz";
import { FACTS } from "@/content/facts";

/**
 * S3 – panel „EET 2.0 a tato firma“ v katalogu: který návod je pro obor nejvhodnější a jak srozumitelně říct odhad.
 * Čisté funkce (bez DB). Odhad je vždy orientační: o evidenci rozhoduje způsob placení, ne obor (FACTS.evidenced).
 */

export type EetGuideTopic = "ubytovani" | "kadernictvi" | "gastronomie" | "trhy" | "eshop" | "remesla" | "pilir" | "kdo";

export interface EetGuideRef {
  slug: string;
  label: string;
  topic: EetGuideTopic;
}

/**
 * Obor (prefix CZ-NACE) → návod. Pořadí je priorita, když má subjekt víc oborů (hotel s restaurací → ubytování).
 * 55 ubytování, 9602 kadeřnictví a kosmetika, 56 stravování, 4781/4782/4789 stánky a trhy, 4791 zásilkový a internetový
 * prodej, 43/452/812/952 řemesla a služby u zákazníka (stejné prefixy jako obor „Řemesla“ v content/industries.ts).
 */
export const EET_GUIDE_RULES: readonly (EetGuideRef & { prefixes: readonly string[] })[] = [
  { topic: "ubytovani", prefixes: ["55"], slug: "eet-ubytovani", label: "EET u ubytování" },
  { topic: "kadernictvi", prefixes: ["9602"], slug: "eet-kadernictvi-kosmetika", label: "EET pro kadeřnictví a kosmetiku" },
  { topic: "gastronomie", prefixes: ["56"], slug: "eet-gastronomie", label: "EET v gastronomii" },
  { topic: "trhy", prefixes: ["4781", "4782", "4789"], slug: "eet-trhy-stanky", label: "EET na trzích a ve stáncích" },
  { topic: "eshop", prefixes: ["4791"], slug: "eet-eshop-dobirka", label: "EET pro e-shop a dobírku" },
  { topic: "remesla", prefixes: ["43", "452", "812", "952"], slug: "eet-remeslnici", label: "EET pro řemeslníky a služby" },
];

/** Obecný pilíř – pro obory bez vlastního návodu. */
export const EET_PILLAR: EetGuideRef = { topic: "pilir", slug: "eet-2-0-kompletni-pruvodce", label: "EET 2.0: kompletní průvodce" };
/** U oborů, kterých se evidence spíš netýká, je nejužitečnější vysvětlení, kdo evidovat musí. */
export const EET_WHO: EetGuideRef = { topic: "kdo", slug: "koho-se-eet-tyka", label: "Koho se EET týká" };

const digits = (c: string) => c.replace(/\D/g, "");

/**
 * Nejvhodnější návod pro subjekt podle jeho oborů CZ-NACE. `available` = smí se návod ukázat (je po odborné revizi,
 * Ф9); nedostupný oborový návod nahradí pilíř, nedostupný pilíř „Koho se EET týká“.
 */
export function eetGuideFor(nace: readonly string[], relevance: EetRelevance, available: (slug: string) => boolean = () => true): EetGuideRef {
  const codes = nace.map(digits).filter(Boolean);
  const rule = EET_GUIDE_RULES.find((r) => r.prefixes.some((p) => codes.some((c) => c.startsWith(p))));
  const preferred = rule ? { slug: rule.slug, label: rule.label, topic: rule.topic } : relevance === "unlikely" ? EET_WHO : EET_PILLAR;
  if (available(preferred.slug)) return preferred;
  if (available(EET_PILLAR.slug)) return EET_PILLAR;
  return EET_WHO;
}

export interface EetVerdict {
  /** krátký nadpis odhadu */
  title: string;
  /** vysvětlení podle oboru */
  text: string;
  /** vždy stejná výhrada: rozhoduje způsob placení */
  caveat: string;
}

const VERDICT: Record<EetRelevance, { title: string; text: string }> = {
  likely: {
    title: "Pravděpodobně se týká",
    text: `V tomto oboru zákazníci obvykle platí osobně – hotově, kartou nebo QR kódem na místě. Takové platby se od ${FACTS.law.effectiveFrom} evidují.`,
  },
  possible: {
    title: "Může se týkat",
    text: `V tomto oboru se platí osobně i převodem na fakturu. Od ${FACTS.law.effectiveFrom} se evidují jen platby přijaté osobně, převod na účet ne.`,
  },
  unlikely: {
    title: "Spíš se netýká",
    text: "V tomto oboru se obvykle platí převodem na fakturu, a ten se neeviduje. Kdo ale přijme platbu osobně (hotově, kartou nebo QR kódem na místě), eviduje ji.",
  },
};

export const EET_CAVEAT =
  "Rozhoduje způsob placení, ne obor. Z registru nepoznáme, jak firma platby přijímá, proto jde jen o orientační odhad, ne o právní posouzení.";

export function eetVerdict(relevance: EetRelevance): EetVerdict {
  return { ...VERDICT[relevance], caveat: EET_CAVEAT };
}
