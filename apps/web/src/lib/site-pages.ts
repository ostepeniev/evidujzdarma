import { GUIDES, guideModified, isIndexable } from "@/content/guides";
import { MYTHS } from "@/content/myths";
import { HELP_ARTICLES, helpIndexable, helpModified } from "@/content/napoveda";
import { PRIVACY_DATE_ISO, TERMS_DATE_ISO } from "@/lib/legal";
import { STATIC_PAGES } from "@/lib/static-pages";

export interface SitePage {
  path: string;
  lastModified: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}

const latest = (dates: readonly string[]) => dates.reduce((a, b) => (b > a ? b : a));

/**
 * Rejstřík stránek webu – jediný zdroj pro sitemap.xml i pro měření návštěvnosti (R16.1: /api/m počítá jen tyto cesty).
 * Statické stránky + ověřené (indexovatelné) návody + nápověda k pokladně (jen když je pokladna otevřená).
 * lastmod = skutečné datum změny obsahu (R14.7): návody – poslední záznam historie změn (i revize, R8.10), mýty – asOf,
 * právní dokumenty – jejich datum účinnosti, ostatní – `modified` u stránky v STATIC_PAGES. Nikdy datum sestavení.
 */
export function sitePages(): SitePage[] {
  const guides = GUIDES.filter(isIndexable);
  const derived: Record<string, string> = {
    "/navody": latest(guides.map(guideModified)),
    "/co-se-o-eet-pise-spatne": latest(MYTHS.map((m) => m.asOf)),
    "/podminky": TERMS_DATE_ISO,
    "/ochrana-osobnich-udaju": PRIVACY_DATE_ISO,
  };
  return [
    ...STATIC_PAGES.map((p) => ({ path: p.path, lastModified: derived[p.path] ?? p.modified ?? "", changeFrequency: p.changeFrequency, priority: p.priority })),
    ...guides.map((g) => ({ path: `/navody/${g.slug}`, lastModified: guideModified(g), changeFrequency: "weekly" as const, priority: 0.8 })),
    // S2-A: nápověda k pokladně – do sitemap (a tím do měření, R16.1) až po otevření pokladny (helpIndexable)
    ...(helpIndexable()
      ? [
          { path: "/napoveda", lastModified: helpModified(), changeFrequency: "monthly" as const, priority: 0.6 },
          ...HELP_ARTICLES.map((a) => ({ path: `/napoveda/${a.slug}`, lastModified: a.updated, changeFrequency: "monthly" as const, priority: 0.5 })),
        ]
      : []),
  ];
}
