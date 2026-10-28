import type { Metadata } from "next";
import { plainText } from "@/components/rich-text";
import type { Block } from "@/content/guides/types";
import type { HelpArticle } from "@/content/napoveda/types";
import { articleLd, howToLd } from "./jsonld";
import { isClosed } from "./launch";
import { canonicalMeta } from "./metadata";

/**
 * S3-OPEN (17. 10. 2026, rozhodnutí majitele): nápověda je pro vyhledávače otevřená už před spuštěním pokladny. Články, které
 * popisují ovládání naší pokladny (aplikace), mají do spuštění nahoře poznámku o aktuálnosti; obecné články (co je EET,
 * pojmy, povinnosti, kontakt) ji nemají. Rozlišení je jen tady – těla článků se kvůli tomu nemění (upravuje je proud POKLADNA).
 * Nový článek zařaďte do jednoho ze seznamů (test s3-open hlídá, že je zařazený každý).
 */
export const HELP_APP_ARTICLES: readonly string[] = [
  // Začínáme
  "prvni-spusteni",
  "firma-a-ares",
  "evidencni-jednotky",
  "pokladni-certifikat",
  "rezim-evidence",
  "zarizeni-jako-pokladna",
  // Prodej a platby
  "prvni-prodej",
  "katalog-rychla-tlacitka",
  "zpusoby-platby",
  "qr-platba",
  "rozdelena-platba",
  "poukazy-kredit-zalohy",
  // Účtenky
  "tisk-uctenky",
  "uctenka-emailem-a-qr",
  "pok-na-uctence",
  // Odesílání tržeb a vratky
  "prodej-bez-signalu",
  "stav-trzby",
  "odmitnuta-trzba",
  "vratka",
  // Přehled, uzávěrka, obsluha a zařízení
  "denni-prehled",
  "denni-uzaverka",
  "pokladni-a-pin",
  "vice-zarizeni",
  // Pro účetní
  "export-pro-ucetni",
  "propojeni-s-ucetni",
  // Účet a certifikát
  "platnost-certifikatu",
  "zmeny-v-provozovne",
  "zruseni-uctu",
  "bezpecnost",
];

/** Obecné články bez poznámky o aktuálnosti – nepopisují ovládání pokladny. */
export const HELP_GENERAL_ARTICLES: readonly string[] = ["podpora"];

export const isAppHelpArticle = (slug: string): boolean => HELP_APP_ARTICLES.includes(slug);

/** Poznámka o aktuálnosti (doslovně podle rozhodnutí majitele 17. 10. 2026). */
export const HELP_LAUNCH_NOTE =
  "Pokladnu EvidujZdarma spouštíme 2. 11. 2026. Návod popisuje, jak bude fungovat; po spuštění ho podle potřeby upřesníme. Aktuální k 17. 10. 2026.";

/**
 * Poznámka nahoře na stránce nápovědy: jen dokud je pokladna zavřená (isClosed("/pokladna"), pravidlo 7 / R17) a jen
 * u článků o ovládání pokladny a na rozcestníku (slug undefined). Po spuštění zmizí sama – zůstane „Aktualizováno …“.
 */
export function helpLaunchNote(slug?: string): string | null {
  if (!isClosed("/pokladna")) return null;
  return slug === undefined || isAppHelpArticle(slug) ? HELP_LAUNCH_NOTE : null;
}

/** Den zveřejnění nápovědy (S2-A, commit b89d89c) – datePublished v JSON-LD. */
export const HELP_PUBLISHED = "2026-10-17";

/** Šablona titulku přidává „ | EvidujZdarma“ (15 znaků); delší titulek jde bez přípony (jako u návodů, S1). */
const TITLE_SUFFIX = 15;
const TITLE_MAX = 62;

export const helpPath = (slug: string) => `/napoveda/${slug}`;

export function helpTitle(a: Pick<HelpArticle, "title">): Metadata["title"] {
  return a.title.length + TITLE_SUFFIX > TITLE_MAX ? { absolute: a.title } : a.title;
}

/** S3-OPEN: robots se nevypisuje (platí index,follow z layoutu) – nápověda je indexovatelná i před spuštěním pokladny. */
export function helpMetadata(a: HelpArticle): Metadata {
  return {
    title: helpTitle(a),
    description: a.description,
    ...canonicalMeta(helpPath(a.slug), { type: "article", title: a.title, description: a.description, modifiedTime: a.updated }),
  };
}

/**
 * Strukturovaná data článku: TechArticle s dateModified (= „Aktualizováno“ na stránce) u každého článku, HowTo jen u článku
 * s postupem. Drobečková navigace (BreadcrumbList) je v PageHeader.
 */
export function helpJsonLd(a: HelpArticle): Record<string, unknown>[] {
  const article = {
    ...articleLd({ title: a.title, description: a.description, path: helpPath(a.slug), published: HELP_PUBLISHED, modified: a.updated }),
    "@type": "TechArticle",
  };
  if (!a.steps?.length) return [article];
  return [article, howToLd({ name: a.title, description: plainText(a.lead), steps: a.steps.map((s) => ({ name: s.name, text: plainText(s.text) })) })];
}

function blockText(b: Block): string[] {
  if ("p" in b) return [b.p];
  if ("h3" in b) return [b.h3];
  if ("ul" in b) return b.ul;
  if ("ol" in b) return b.ol;
  if ("table" in b) return [...b.table.head, ...b.table.rows.flat(), b.table.caption ?? ""];
  if ("note" in b) return [b.note];
  if ("quote" in b) return [b.quote];
  if ("stats" in b) return b.stats.flatMap((x) => [x.value, x.label, x.note ?? ""]);
  if ("timeline" in b) return b.timeline.flatMap((x) => [x.date, x.title, x.text ?? ""]);
  if ("story" in b) return b.story.flatMap((x) => [x.time, x.title, x.text]);
  if ("conditions" in b) return b.conditions.flatMap((x) => [x.title, x.text]);
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
