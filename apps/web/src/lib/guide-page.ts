import type { Metadata } from "next";
import { plainText } from "@/components/rich-text";
import { guideModified, isIndexable } from "@/content/guides";
import type { Guide } from "@/content/guides/types";
import { articleLd, faqLd, howToLd } from "./jsonld";
import { REVIEWER, absoluteUrl } from "./site";
import { canonicalMeta } from "./metadata";

/** Metadata stránky návodu: nerevidovaný návod je noindex (Ф9). */
export function guideMetadata(g: Guide): Metadata {
  return {
    title: g.title,
    description: g.description,
    ...canonicalMeta(`/navody/${g.slug}`, { type: "article", title: g.h1 ?? g.title, description: g.description, modifiedTime: guideModified(g), publishedTime: g.published }),
    robots: isIndexable(g) ? undefined : { index: false, follow: true },
  };
}

/** Kdo návod revidoval – u známé recenzentky i s funkcí a odkazem na /o-nas#odborna-revize (R8.10). */
function reviewerOf(g: Guide): { name: string; jobTitle?: string; url?: string } | undefined {
  if (!g.reviewedBy) return undefined;
  return g.reviewedBy === REVIEWER.name ? { name: REVIEWER.name, jobTitle: REVIEWER.title, url: absoluteUrl(REVIEWER.path) } : { name: g.reviewedBy };
}

/** Strukturovaná data návodu: Article (s revizí a obrázkem), FAQ a HowTo. */
export function guideJsonLd(g: Guide): Record<string, unknown>[] {
  return [
    articleLd({
      title: g.h1 ?? g.title,
      description: g.description,
      path: `/navody/${g.slug}`,
      published: g.published,
      modified: guideModified(g),
      author: g.author,
      reviewer: reviewerOf(g),
    }),
    ...(g.faq?.length ? [faqLd(g.faq.map((f) => ({ q: f.q, a: plainText(f.a) })))] : []),
    ...(g.howTo ? [howToLd(g.howTo)] : []),
  ];
}
