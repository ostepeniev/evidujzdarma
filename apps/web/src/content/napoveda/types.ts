import type { Block } from "../guides/types";

/**
 * Nápověda k pokladně (S2-A): krátké články „jak to udělám v pokladně EvidujZdarma“. Popisují jen to, co v kódu opravdu
 * je – názvy tlačítek a polí doslovně z aplikace (components/pos, components/setup, components/cabinet). Zákonná fakta
 * jen přes FACTS (content/facts.ts) nebo odkazem na návod (/navody/…). Texty mají stejnou inline syntaxi jako návody:
 *   **tučně**, [text](adresa) – interní adresa začíná „/“. Žádné HTML.
 */
export type HelpTopic = "zaciname" | "prodej" | "uctenky" | "odesilani" | "hotovost" | "obsluha" | "ucetni" | "ucet";

export const HELP_TOPIC_LABEL: Record<HelpTopic, string> = {
  zaciname: "Začínáme",
  prodej: "Prodej a platby",
  uctenky: "Účtenky",
  odesilani: "Odesílání tržeb a vratky",
  hotovost: "Přehled a uzávěrka",
  obsluha: "Obsluha a zařízení",
  ucetni: "Pro účetní",
  ucet: "Účet, certifikát a podpora",
};

/** Pořadí skupin na rozcestníku /napoveda. */
export const HELP_TOPIC_ORDER: readonly HelpTopic[] = ["zaciname", "prodej", "uctenky", "odesilani", "hotovost", "obsluha", "ucetni", "ucet"];

/** Krok postupu – jde i do strukturovaných dat HowTo (text bez syntaxe přes plainText). */
export interface HelpStep {
  name: string;
  text: string;
}

export interface HelpSection {
  /** kotva, např. "caste-chyby" */
  id: string;
  heading: string;
  blocks: Block[];
}

export interface HelpArticle {
  slug: string;
  topic: HelpTopic;
  /** <title> i H1, nejvýš 60 znaků */
  title: string;
  /** meta description, 110–160 znaků */
  description: string;
  /** první odstavec – přímá odpověď */
  lead: string;
  /** postup krok za krokem (HowTo); článek má kroky, oddíly, nebo obojí */
  steps?: HelpStep[];
  /** nadpis postupu (výchozí „Postup“) */
  stepsHeading?: string;
  /** kolik oddílů se vypíše před postupem (výchozí 0 = postup hned po úvodu) */
  stepsAt?: number;
  sections?: HelpSection[];
  /** související články nápovědy (slugy) */
  related: string[];
  /** související návody (slugy z content/guides) – zobrazí se jen ty po odborné revizi */
  guides?: string[];
  /** ISO datum poslední změny obsahu */
  updated: string;
}
