import type { MetadataRoute } from "next";
import { sitePages } from "@/lib/site-pages";
import { absoluteUrl } from "@/lib/site";

/** Hlavní sitemap – rejstřík stránek (lib/site-pages.ts); stejné cesty počítá měření návštěvnosti (R16.1). */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitePages().map((p) => ({ url: absoluteUrl(p.path), lastModified: p.lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
}
