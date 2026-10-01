import type { MetadataRoute } from "next";
import { establishmentPath } from "@/components/catalog/paths";
import { absoluteUrl } from "@/lib/site";
import { SITEMAP_CHUNK, countIndexableEstablishments, indexableEstablishmentsChunk } from "@/lib/server/catalog";

// Sitemapy provozoven po ≤ 50 000 URL: /provozovna/sitemap/0.xml, …
export const dynamic = "force-dynamic";

export async function generateSitemaps() {
  const total = await countIndexableEstablishments().catch(() => 0);
  return Array.from({ length: Math.max(1, Math.ceil(total / SITEMAP_CHUNK)) }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  if (!Number.isInteger(id) || id < 0) return [];
  const rows = await indexableEstablishmentsChunk(id).catch(() => []);
  return rows.map((r) => ({
    url: absoluteUrl(establishmentPath(r)),
    ...(r.updated ? { lastModified: r.updated } : {}),
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));
}
