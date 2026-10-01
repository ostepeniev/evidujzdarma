import type { MetadataRoute } from "next";
import { firmPath } from "@/components/catalog/paths";
import { absoluteUrl } from "@/lib/site";
import { SITEMAP_CHUNK, countIndexableFirms, indexableFirmsChunk } from "@/lib/server/catalog";

// Sitemapy firem po ≤ 50 000 URL: /firma/sitemap/0.xml, /firma/sitemap/1.xml, …
// Počet se mění s importem — generujeme za běhu (DB při buildu nemusí být dostupná).
export const dynamic = "force-dynamic";

export async function generateSitemaps() {
  const total = await countIndexableFirms().catch(() => 0);
  return Array.from({ length: Math.max(1, Math.ceil(total / SITEMAP_CHUNK)) }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  if (!Number.isInteger(id) || id < 0) return [];
  const rows = await indexableFirmsChunk(id).catch(() => []);
  return rows.map((r) => ({
    url: absoluteUrl(firmPath(r)),
    ...(r.updated ? { lastModified: r.updated } : {}),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}
