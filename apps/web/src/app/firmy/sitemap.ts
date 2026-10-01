import type { MetadataRoute } from "next";
import { krajByCode } from "@ez/cz";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { krajPath, monthPath, oborKrajPath } from "@/components/catalog/paths";
import { absoluteUrl } from "@/lib/site";
import { foundingMonths, indexRegions, industryRegionCount, regionCounts } from "@/lib/server/catalog";

// Seznamové stránky katalogu (/firmy/sitemap.xml): kraje, obor × kraj, nové firmy po měsících.
// Jen indexované kraje (postupné spuštění) a jen neprázdné stránky.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [{ url: absoluteUrl("/firmy"), changeFrequency: "daily", priority: 0.7 }];
  try {
    const counts = await regionCounts();
    for (const code of indexRegions()) {
      const kraj = krajByCode(code);
      if (!kraj || !counts[code]) continue;
      out.push({ url: absoluteUrl(krajPath(kraj.slug)), changeFrequency: "weekly", priority: 0.6 });
      for (const ind of CATALOG_INDUSTRIES) {
        if ((await industryRegionCount(ind.nace, code)) > 0) {
          out.push({ url: absoluteUrl(oborKrajPath(ind.slug, kraj.slug)), changeFrequency: "weekly", priority: 0.6 });
        }
      }
    }
    for (const m of await foundingMonths(24)) {
      out.push({ url: absoluteUrl(monthPath(m.month)), changeFrequency: "weekly", priority: 0.5 });
    }
  } catch {
    // DB nedostupná — vrátíme aspoň úvod katalogu
  }
  return out;
}
