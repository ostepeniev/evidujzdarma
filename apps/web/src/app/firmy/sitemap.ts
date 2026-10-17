import type { MetadataRoute } from "next";
import { krajByCode } from "@ez/cz";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { krajPath, monthPath, obecHubPath, oborKrajPath } from "@/components/catalog/paths";
import { absoluteUrl } from "@/lib/site";
import { foundingMonths, indexRegions, indexableObecHubs, regionCounts, regionIndustryTotals } from "@/lib/server/catalog";

// Seznamové stránky katalogu (/firmy/sitemap.xml): kraje, obor × kraj, rozcestníky obcí (S3), nové firmy po měsících.
// Jen indexované kraje (postupné spuštění) a jen stránky, které jsou indexovatelné (stejná pravidla jako robots v metadatech).
// Počty jdou z agregací v paměti (lib/server/catalog.ts) – sitemapa nespouští dotaz na každý obor zvlášť.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [{ url: absoluteUrl("/firmy"), changeFrequency: "daily", priority: 0.7 }];
  try {
    const counts = await regionCounts();
    for (const code of indexRegions()) {
      const kraj = krajByCode(code);
      if (!kraj || !counts[code]) continue;
      out.push({ url: absoluteUrl(krajPath(kraj.slug)), changeFrequency: "weekly", priority: 0.6 });
      const totals = await regionIndustryTotals(code);
      for (const ind of CATALOG_INDUSTRIES) {
        if ((totals[ind.slug]?.listable ?? 0) > 0) out.push({ url: absoluteUrl(oborKrajPath(ind.slug, kraj.slug)), changeFrequency: "weekly", priority: 0.6 });
      }
    }
    for (const o of await indexableObecHubs()) out.push({ url: absoluteUrl(obecHubPath(o)), changeFrequency: "weekly", priority: 0.6 });
    for (const m of await foundingMonths(24)) {
      // stránka měsíce se indexuje jen s aspoň jednou jmenovitě uvedenou firmou
      if (m.legal > 0) out.push({ url: absoluteUrl(monthPath(m.month)), changeFrequency: "weekly", priority: 0.5 });
    }
  } catch {
    // DB nedostupná — vrátíme aspoň úvod katalogu
  }
  return out;
}
