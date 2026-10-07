/**
 * R8.10 (Ф9, Ф12) – odborná revize návodů: Helena Jeřábková, účetní (titul „daňová poradkyně“ je chráněný zákonem
 * 523/1992 – konstantu změní kontrolor po ověření v rejstříku KDP).
 *  - všech 16 návodů: reviewedBy, záznam v historii změn 2026-10-07, index, v sitemap (lastmod = poslední záznam historie)
 *    a v „Návody“ v llms.txt;
 *  - stránka návodu odkazuje na /o-nas#odborna-revize; JSON-LD má reviewedBy (url, jobTitle) a image (PNG ≥ 1200 px);
 *  - /o-nas má sekci #odborna-revize (text doslovně);
 *  - návod bez revize: noindex a bez reviewedBy.
 */
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GUIDES, guideModified, isIndexable } from "@/content/guides";
import { guideJsonLd, guideMetadata } from "@/lib/guide-page";
import { REVIEWER, REVIEWER_TITLE, SITE, absoluteUrl } from "@/lib/site";
import { pageText } from "./helpers/render-text";

const CHANGELOG = { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." };
/** koncepty z C1 – před revizí (gate v c1-draft-guides.test.ts); revize R8.10 se týkala 16 návodů před nimi */
const C1_DRAFTS = new Set(["pokladna-v-mobilu-zdarma", "eet-trhy-stanky", "eet-eshop-dobirka"]);
const REVIEWED = GUIDES.filter((g) => !C1_DRAFTS.has(g.slug));

describe("R8.10 – the guides' expert reviewer", () => {
  it("gate: REVIEWER constants", () => {
    expect(REVIEWER_TITLE).toBe("účetní");
    expect(REVIEWER).toEqual({ name: "Helena Jeřábková", title: "účetní", path: "/o-nas#odborna-revize" });
  });

  it("gate: all 16 guides reviewed, logged on 2026-10-07, indexable; lastmod = the latest changelog entry", () => {
    expect(REVIEWED).toHaveLength(16);
    for (const g of REVIEWED) {
      expect(g.reviewedBy, g.slug).toBe(REVIEWER.name);
      // první záznam revize; u kompletního průvodce ho R10.5 předběhl citát odbornice (týž den)
      expect(g.changelog, g.slug).toContainEqual(CHANGELOG);
      expect(g.changelog?.[0]?.date, g.slug).toBe("2026-10-07");
      expect(isIndexable(g), g.slug).toBe(true);
      expect(guideModified(g), g.slug).toBe("2026-10-07");
    }
  });

  it("gate: sitemap and llms.txt list all 16 guides; sitemap lastmod is the changelog date, not the build date", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = sitemap();
    for (const g of REVIEWED) {
      const e = entries.find((x) => x.url === absoluteUrl(`/navody/${g.slug}`));
      expect(e, g.slug).toBeTruthy();
      expect(e!.lastModified, g.slug).toBe("2026-10-07");
    }
    const { llmsTxt } = await import("@/lib/llms");
    const navody = llmsTxt().split("## Návody")[1]!.split("\n## ")[0]!;
    for (const g of REVIEWED) expect(navody, g.slug).toContain(absoluteUrl(`/navody/${g.slug}`));
  });

  it("gate: the guide page links the reviewer to /o-nas#odborna-revize; JSON-LD has reviewedBy url + jobTitle and a PNG image", async () => {
    const g = GUIDES[0]!;
    const { default: GuidePage } = await import("@/app/(site)/navody/[slug]/page");
    const html = renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: g.slug }) } as never)) as ReactElement);
    expect(html).toMatch(/Odborná revize: <a [^>]*href="\/o-nas#odborna-revize"[^>]*>Helena Jeřábková<\/a>, účetní/);
    const article = guideJsonLd(g).find((x) => x["@type"] === "Article") as Record<string, unknown> & { reviewedBy: Record<string, string>; image: string[] };
    // + description s praxí (R10.5)
    expect(article.reviewedBy).toEqual({ "@type": "Person", name: "Helena Jeřábková", jobTitle: "účetní", url: absoluteUrl("/o-nas#odborna-revize"), description: "účetní s 22 lety praxe" });
    expect(article.image).toContain(absoluteUrl("/opengraph-image"));
    expect(article.dateModified).toBe("2026-10-07");
    expect(guideMetadata(g).robots).toBeUndefined();
  });

  it("gate: a guide without the reviewer is noindex and has no reviewedBy", () => {
    const draft = { ...GUIDES[0]!, slug: "draft", reviewedBy: null, changelog: [] };
    expect(isIndexable(draft)).toBe(false);
    expect(guideMetadata(draft).robots).toEqual({ index: false, follow: true });
    const article = guideJsonLd(draft).find((x) => x["@type"] === "Article")!;
    expect(article).not.toHaveProperty("reviewedBy");
  });

  it("gate: /o-nas has the #odborna-revize section (verbatim)", async () => {
    const { default: About } = await import("@/app/(site)/o-nas/page");
    const html = renderToStaticMarkup(createElement(About as FC));
    expect(html).toMatch(/id="odborna-revize"/);
    const text = pageText(About as FC);
    expect(text).toContain("Odborná revize");
    expect(text).toContain(
      // text rozšířila R10.5 (22 let praxe)
      `Věcnou správnost návodů kontroluje Helena Jeřábková, ${REVIEWER_TITLE} s 22 lety praxe. U každého zkontrolovaného návodu uvádíme, kdo ho zkontroloval. Pokud v návodu najdete chybu, napište nám na ${SITE.email}.`,
    );
    // chráněný titul se nepoužívá, dokud ho kontrolor neověří; „obraťte se na daňového poradce“ je obecná rada, ne tvrzení o revizi
    expect(text).not.toMatch(/revi\w* daňov|daňová poradkyně/i);
  });

  it("the MCP server no longer claims a tax adviser reviewed the guides", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/lib/mcp/server.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/reviewed by a tax adviser|checked by a tax adviser|revizi daňovým poradcem/);
  });
});
