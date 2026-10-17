import type { Metadata } from "next";
import { plainText } from "@/components/rich-text";
import { helpIndexable } from "@/content/napoveda";
import type { Block } from "@/content/guides/types";
import type { HelpArticle } from "@/content/napoveda/types";
import { howToLd } from "./jsonld";
import { canonicalMeta } from "./metadata";

/** Šablona titulku přidává „ | EvidujZdarma“ (15 znaků); delší titulek jde bez přípony (jako u návodů, S1). */
const TITLE_SUFFIX = 15;
const TITLE_MAX = 62;

export const helpPath = (slug: string) => `/napoveda/${slug}`;

export function helpTitle(a: Pick<HelpArticle, "title">): Metadata["title"] {
  return a.title.length + TITLE_SUFFIX > TITLE_MAX ? { absolute: a.title } : a.title;
}

/** Dokud je pokladna zavřená: noindex,follow (S2-A). Po otevření se robots nevypisuje – platí index,follow z layoutu. */
export function helpRobots(): Metadata["robots"] {
  return helpIndexable() ? undefined : { index: false, follow: true };
}

export function helpMetadata(a: HelpArticle): Metadata {
  return {
    title: helpTitle(a),
    description: a.description,
    ...canonicalMeta(helpPath(a.slug), { type: "article", title: a.title, description: a.description, modifiedTime: a.updated }),
    robots: helpRobots(),
  };
}

/** Strukturovaná data článku s postupem: HowTo (drobečková navigace je v PageHeader). */
export function helpJsonLd(a: HelpArticle): Record<string, unknown>[] {
  if (!a.steps?.length) return [];
  return [howToLd({ name: a.title, description: plainText(a.lead), steps: a.steps.map((s) => ({ name: s.name, text: plainText(s.text) })) })];
}

function blockText(b: Block): string[] {
  if ("p" in b) return [b.p];
  if ("h3" in b) return [b.h3];
  if ("ul" in b) return b.ul;
  if ("ol" in b) return b.ol;
  if ("table" in b) return [...b.table.head, ...b.table.rows.flat(), b.table.caption ?? ""];
  if ("note" in b) return [b.note];
  if ("quote" in b) return [b.quote];
  return [];
}

/** Viditelný text článku bez syntaxe (úvod, postup, oddíly) – pro kontrolu délky a pro testy. */
export function helpPlainText(a: HelpArticle): string {
  const parts = [
    a.lead,
    ...(a.steps ?? []).flatMap((s) => [s.name, s.text]),
    ...(a.sections ?? []).flatMap((s) => [s.heading, ...s.blocks.flatMap(blockText)]),
  ];
  return parts.map(plainText).join(" ");
}

/** Počet slov článku (zadání S2-A: 120–350). */
export function helpWordCount(a: HelpArticle): number {
  return helpPlainText(a)
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
