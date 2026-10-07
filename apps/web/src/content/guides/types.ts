import type { Source } from "../facts";

/**
 * Obsahový model návodu. Texty podporují jen bezpečnou inline syntaxi:
 *   **tučně**, [odkaz](/navody nebo https://…)
 * Žádné HTML. Každé tvrzení o zákoně musí mít zdroj v `sources`.
 */
export type Block =
  | { p: string }
  | { h3: string }
  | { ul: string[] }
  | { ol: string[] }
  | { table: { head: string[]; rows: string[][]; caption?: string } }
  | { note: string; tone?: "info" | "warn" }
  | { cta: "registrace" | "kontrola-ico" | "eet-off" | "jednotky" | "qr" | "kviz" }
  /** citát s podpisem (bez „—“), např. recenzentky (R10.5) */
  | { quote: string; cite: string };

export interface GuideSection {
  /** kotva pro obsah, např. "kdo-eviduje" */
  id: string;
  heading: string;
  blocks: Block[];
}

export type GuideCategory = "zaklady" | "povinnosti" | "obory" | "prakticke" | "novinky";

export const CATEGORY_LABEL: Record<GuideCategory, string> = {
  zaklady: "Základy EET 2.0",
  povinnosti: "Povinnosti a výjimky",
  prakticke: "Prakticky: DIS+, certifikát, pokladna",
  obory: "EET podle oborů",
  novinky: "Novinky",
};

export interface Guide {
  slug: string;
  category: GuideCategory;
  /** <title> do 60 znaků */
  title: string;
  /** meta description 140–160 znaků */
  description: string;
  /** H1, pokud se liší od title */
  h1?: string;
  /** první odstavec = přímá odpověď ve 40–60 slovech s datem a číslem */
  lead: string;
  /** blok "Stručně" — 3 až 5 faktů */
  summary: string[];
  sections: GuideSection[];
  faq?: { q: string; a: string }[];
  howTo?: { name: string; description: string; steps: { name: string; text: string }[] };
  sources: Source[];
  related: string[];
  /** ISO datum */
  published: string;
  updated: string;
  changelog?: { date: string; text: string }[];
  author?: string;
  /** kdo návod odborně revidoval (REVIEWER.name, R8.10); do té doby null = noindex (Ф9) */
  reviewedBy: string | null;
}
