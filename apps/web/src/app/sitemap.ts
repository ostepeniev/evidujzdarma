import type { MetadataRoute } from "next";
import { FACTS_UPDATED } from "@/content/facts";
import { GUIDES, isIndexable } from "@/content/guides";
import { STATIC_PAGES } from "@/lib/static-pages";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.map((p) => ({
      url: absoluteUrl(p.path),
      lastModified: FACTS_UPDATED,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...GUIDES.filter(isIndexable).map((g) => ({
      url: absoluteUrl(`/navody/${g.slug}`),
      lastModified: g.updated,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
