/** Vyhledávání v návodech pro MCP (jednoduché skórování bez externího indexu – návodů jsou desítky). */
import { plainText } from "@/components/rich-text";
import { GUIDES, getGuide, guideModified, isIndexable } from "@/content/guides";
import type { Block, Guide } from "@/content/guides/types";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function blockText(b: Block): string {
  if ("p" in b) return b.p;
  if ("h3" in b) return b.h3;
  if ("ul" in b) return b.ul.join(" ");
  if ("ol" in b) return b.ol.join(" ");
  if ("table" in b) return [...b.table.head, ...b.table.rows.flat()].join(" ");
  if ("note" in b) return b.note;
  return "";
}

const index = GUIDES.map((g) => ({
  guide: g,
  title: fold(`${g.h1 ?? ""} ${g.title}`),
  description: fold(g.description),
  lead: fold(plainText(`${g.lead} ${g.summary.join(" ")}`)),
  body: fold(plainText(g.sections.map((s) => `${s.heading} ${s.blocks.map(blockText).join(" ")}`).join(" ") + " " + (g.faq ?? []).map((f) => `${f.q} ${f.a}`).join(" "))),
}));

export interface GuideHit {
  slug: string;
  title: string;
  description: string;
  updated: string;
  reviewed: boolean;
  score: number;
}

function count(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

/**
 * Návody, které smí strojové kanály vydat (Ф9): jen po odborné revizi (isIndexable, stejně jako
 * llms.txt). Rozhoduje se při každém dotazu, takže po revizi se návod objeví bez restartu.
 */
export function publicGuides(): Guide[] {
  return GUIDES.filter(isIndexable);
}

export function publicGuide(slug: string): Guide | undefined {
  const g = getGuide(slug);
  return g && isIndexable(g) ? g : undefined;
}

/** Odkaz na návod jen tehdy, smí-li ho MCP vydat. */
export function publicGuidePath(slug: string): string | null {
  return publicGuide(slug) ? `/navody/${slug}` : null;
}

export function searchGuides(query: string, limit: number): GuideHit[] {
  const terms = fold(query)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (!terms.length) return [];
  return index
    .filter((x) => isIndexable(x.guide))
    .map((x) => ({
      x,
      score: terms.reduce((s, t) => s + 6 * count(x.title, t) + 3 * count(x.description, t) + 2 * count(x.lead, t) + Math.min(5, count(x.body, t)), 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ x, score }) => toHit(x.guide, score));
}

export function toHit(g: Guide, score = 0): GuideHit {
  return { slug: g.slug, title: g.h1 ?? g.title, description: g.description, updated: guideModified(g), reviewed: !!g.reviewedBy, score };
}
