import type { Metadata } from "next";
import { plainText } from "@/components/rich-text";
import { guideModified, isIndexable } from "@/content/guides";
import type { Guide } from "@/content/guides/types";
import { articleLd, faqLd, howToLd } from "./jsonld";
import { REVIEWER, REVIEWER_PROFILE, absoluteUrl } from "./site";
import { canonicalMeta } from "./metadata";

/** Šablona titulku přidává „ | EvidujZdarma“ (15 znaků); delší titulek by vyhledávač ve výsledcích ořízl (S1). */
const TITLE_SUFFIX = 15;
const TITLE_MAX = 62;

/** Titulek návodu: dlouhý jde bez přípony značky, aby se ve výsledcích vešel celý. */
export function guideTitle(g: Guide): Metadata["title"] {
  return g.title.length + TITLE_SUFFIX > TITLE_MAX ? { absolute: g.title } : g.title;
}

/** Metadata stránky návodu: nerevidovaný návod je noindex (Ф9). */
export function guideMetadata(g: Guide): Metadata {
  return {
    title: guideTitle(g),
    description: g.description,
    ...canonicalMeta(`/navody/${g.slug}`, { type: "article", title: g.h1 ?? g.title, description: g.description, modifiedTime: guideModified(g), publishedTime: g.published }),
    robots: isIndexable(g) ? undefined : { index: false, follow: true },
  };
}

/** Kdo návod revidoval – u známé recenzentky i s funkcí, praxí (R10.5) a odkazem na /o-nas#odborna-revize (R8.10). */
function reviewerOf(g: Guide): { name: string; jobTitle?: string; url?: string; description?: string } | undefined {
  if (!g.reviewedBy) return undefined;
  return g.reviewedBy === REVIEWER.name
    ? { name: REVIEWER.name, jobTitle: REVIEWER.title, url: absoluteUrl(REVIEWER.path), description: REVIEWER_PROFILE }
    : { name: g.reviewedBy };
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
