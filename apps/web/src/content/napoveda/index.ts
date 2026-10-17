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

/*
 * S3-OPEN (17. 10. 2026, rozhodnutí majitele): nápověda je pro vyhledávače otevřená už před spuštěním pokladny (2. 11. 2026) –
 * index, sitemap (= měření, R16.1) i llms.txt. Články o ovládání pokladny mají do spuštění nahoře poznámku o aktuálnosti
 * (lib/help-page.ts: HELP_APP_ARTICLES, helpLaunchNote); přepínač helpIndexable() zanikl.
 */

/** Poslední změna nápovědy – lastmod rozcestníku v sitemap. */
export function helpModified(): string {
  return HELP_ARTICLES.map((a) => a.updated).reduce((a, b) => (b > a ? b : a));
}
