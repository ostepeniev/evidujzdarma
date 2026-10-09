import type { MetadataRoute } from "next";
import { GUIDES, guideModified, isIndexable } from "@/content/guides";
import { MYTHS } from "@/content/myths";
import { PRIVACY_DATE_ISO, TERMS_DATE_ISO } from "@/lib/legal";
import { STATIC_PAGES } from "@/lib/static-pages";
import { absoluteUrl } from "@/lib/site";

const latest = (dates: readonly string[]) => dates.reduce((a, b) => (b > a ? b : a));

/**
 * lastmod = skutečné datum změny obsahu (R14.7): návody – poslední záznam historie změn (i revize, R8.10), mýty – asOf,
 * právní dokumenty – jejich datum účinnosti, ostatní – `modified` u stránky v STATIC_PAGES. Nikdy datum sestavení.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const guides = GUIDES.filter(isIndexable);
  const derived: Record<string, string> = {
    "/navody": latest(guides.map(guideModified)),
    "/co-se-o-eet-pise-spatne": latest(MYTHS.map((m) => m.asOf)),
    "/podminky": TERMS_DATE_ISO,
    "/ochrana-osobnich-udaju": PRIVACY_DATE_ISO,
  };
  return [
    ...STATIC_PAGES.map((p) => ({
      url: absoluteUrl(p.path),
      lastModified: derived[p.path] ?? p.modified ?? "",
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...guides.map((g) => ({
      url: absoluteUrl(`/navody/${g.slug}`),
      lastModified: guideModified(g),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
