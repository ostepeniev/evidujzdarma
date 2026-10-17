import type { MetadataRoute } from "next";
import { oborObecPath } from "@/components/catalog/paths";
import { absoluteUrl } from "@/lib/site";
import { SITEMAP_CHUNK, indexableObecIndustryPages } from "@/lib/server/catalog";

// Sitemapy stránek obor × obec po ≤ 50 000 URL: /obor/sitemap/0.xml, … Jen indexované kraje a jen stránky
// s aspoň OBEC_MIN_FIRMS ověřenými subjekty (tenké stránky jsou noindex a do sitemapy nepatří).
export const dynamic = "force-dynamic";

export async function generateSitemaps() {
  const total = (await indexableObecIndustryPages().catch(() => [])).length;
  return Array.from({ length: Math.max(1, Math.ceil(total / SITEMAP_CHUNK)) }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  if (!Number.isInteger(id) || id < 0) return [];
  const pages = await indexableObecIndustryPages().catch(() => []);
  return pages.slice(id * SITEMAP_CHUNK, (id + 1) * SITEMAP_CHUNK).map((p) => ({
    url: absoluteUrl(oborObecPath(p.industry, p)),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}
