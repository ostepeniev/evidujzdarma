import { isClosed } from "@/lib/launch";
import type { HelpArticle, HelpTopic } from "./types";
import { ODESILANI } from "./odesilani";
import { PRODEJ } from "./prodej";
import { PROVOZ } from "./provoz";
import { UCET } from "./ucet";
import { UCETNI } from "./ucetni";
import { UCTENKY } from "./uctenky";
import { ZACINAME } from "./zaciname";

/**
 * Registr nápovědy k pokladně (S2-A). Nový článek: přidejte ho do souboru podle tématu. Pořadí = pořadí na rozcestníku
 * v rámci tématu.
 */
export const HELP_ARTICLES: readonly HelpArticle[] = [...ZACINAME, ...PRODEJ, ...UCTENKY, ...ODESILANI, ...PROVOZ, ...UCETNI, ...UCET];

const BY_SLUG = new Map(HELP_ARTICLES.map((a) => [a.slug, a]));

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return BY_SLUG.get(slug);
}

export function helpArticlesIn(topic: HelpTopic): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.topic === topic);
}

/**
 * Nápověda popisuje pokladnu, která se otevírá 2. 11. 2026. Dokud je /pokladna v CLOSED_SECTIONS, jsou stránky nápovědy
 * noindex,follow, nejsou v sitemap (tedy ani v měření návštěvnosti, R16.1) ani v llms.txt. Commit otevření (odebrání
 * „/pokladna“ z lib/launch.ts) je zpřístupní vyhledávačům sám – nic dalšího se měnit nemusí.
 */
export function helpIndexable(): boolean {
  return !isClosed("/pokladna");
}

/** Poznámka nahoře na stránkách nápovědy, dokud je pokladna zavřená (doslovně ze zadání S2-A). */
export const HELP_CLOSED_NOTE = "Pokladnu spouštíme 2. 11. 2026 – návod popisuje, jak bude fungovat.";

/** Poslední změna nápovědy – lastmod rozcestníku v sitemap. */
export function helpModified(): string {
  return HELP_ARTICLES.map((a) => a.updated).reduce((a, b) => (b > a ? b : a));
}
