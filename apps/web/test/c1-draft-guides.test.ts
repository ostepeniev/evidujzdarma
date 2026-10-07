/**
 * C1 (SEO-блок, 7. 10. 2026) – tři nové návody jako koncepty: reviewedBy null = noindex, mimo sitemap, llms.txt i MCP,
 * dokud je nezkontroluje odbornice (Ф9). Každý: přímá odpověď na začátku (2–3 věty), zdroje jen ze SOURCES, FAQ, HowTo,
 * historie změn, odkazy na existující návody. Dobírka bez jednoznačného zdroje = „zatím není jisté“ + otázka pro poradce.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOURCES } from "@/content/facts";
import { GUIDES, getGuide, isIndexable } from "@/content/guides";
import { guideJsonLd, guideMetadata } from "@/lib/guide-page";
import { absoluteUrl } from "@/lib/site";

const DRAFTS = ["pokladna-v-mobilu-zdarma", "eet-trhy-stanky", "eet-eshop-dobirka"] as const;
const ALL_SOURCES = new Set<string>(Object.values(SOURCES).map((s) => s.url));
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
/** Věty: konec věty je .!? a za ním velké písmeno (ne „1. 1. 2027“). */
const sentences = (s: string) => plain(s).split(/(?<=[.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/).filter(Boolean);
const words = (s: string) => plain(s).split(/\s+/).filter(Boolean).length;
const text = (slug: string) => JSON.stringify(getGuide(slug));

describe("C1 – three draft guides", () => {
  it("gate: the drafts exist, are not reviewed and therefore noindex, without reviewedBy in JSON-LD", () => {
    for (const slug of DRAFTS) {
      const g = getGuide(slug);
      expect(g, slug).toBeTruthy();
      expect(g!.reviewedBy, slug).toBeNull();
      expect(isIndexable(g!), slug).toBe(false);
      expect(guideMetadata(g!).robots, slug).toEqual({ index: false, follow: true });
      expect(guideJsonLd(g!).find((x) => x["@type"] === "Article"), slug).not.toHaveProperty("reviewedBy");
    }
  });

  it("gate: drafts stay out of the sitemap, llms.txt and the MCP index", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = sitemap().map((e) => e.url);
    const { llmsTxt, llmsFullTxt } = await import("@/lib/llms");
    const { publicGuides } = await import("@/lib/mcp/guides");
    for (const slug of DRAFTS) {
      expect(urls, slug).not.toContain(absoluteUrl(`/navody/${slug}`));
      expect(llmsTxt(), slug).not.toContain(`/navody/${slug})`);
      expect(llmsFullTxt(), slug).not.toContain(`/navody/${slug}`);
      expect(publicGuides().map((g) => g.slug), slug).not.toContain(slug);
    }
  });

  it("gate: shape – title ≤ 60, description 140–160, a direct answer in 2–3 sentences (40–60 words), 3–5 summary facts", () => {
    for (const slug of DRAFTS) {
      const g = getGuide(slug)!;
      expect(g.title.length, `${slug} title`).toBeLessThanOrEqual(60);
      expect(g.description.length, `${slug} description`).toBeGreaterThanOrEqual(140);
      expect(g.description.length, `${slug} description`).toBeLessThanOrEqual(160);
      expect(sentences(g.lead).length, `${slug} lead sentences: ${JSON.stringify(sentences(g.lead))}`).toBeGreaterThanOrEqual(2);
      expect(sentences(g.lead).length, `${slug} lead sentences`).toBeLessThanOrEqual(3);
      expect(words(g.lead), `${slug} lead words`).toBeGreaterThanOrEqual(40);
      expect(words(g.lead), `${slug} lead words`).toBeLessThanOrEqual(60);
      expect(g.lead, `${slug} lead has the date`).toMatch(/1\. 1\. 2027/);
      expect(g.summary.length, slug).toBeGreaterThanOrEqual(3);
      expect(g.summary.length, slug).toBeLessThanOrEqual(5);
    }
  });

  it("gate: sources only from SOURCES; FAQ, HowTo, changelog; related guides exist and are reviewed", () => {
    for (const slug of DRAFTS) {
      const g = getGuide(slug)!;
      expect(g.sources.length, slug).toBeGreaterThanOrEqual(3);
      for (const s of g.sources) expect(ALL_SOURCES.has(s.url), `${slug}: ${s.url}`).toBe(true);
      expect(g.faq?.length ?? 0, slug).toBeGreaterThanOrEqual(4);
      expect(g.howTo?.steps.length ?? 0, slug).toBeGreaterThanOrEqual(3);
      expect(g.changelog?.length ?? 0, slug).toBeGreaterThanOrEqual(1);
      expect(g.published, slug).toBe("2026-10-07");
      expect(g.related.length, slug).toBeGreaterThanOrEqual(2);
      for (const r of g.related) {
        const rel = GUIDES.find((x) => x.slug === r);
        expect(rel, `${slug} → ${r}`).toBeTruthy();
        expect(isIndexable(rel!), `${slug} → ${r}`).toBe(true);
      }
    }
  });

  it("gate: topic-specific content", () => {
    const pokladna = text("pokladna-v-mobilu-zdarma");
    expect(pokladna).toContain("/srovnani/moje-eet");
    expect(pokladna).toContain("MOJE eet");
    expect(pokladna).toMatch(/certifikát/);
    expect(pokladna).toMatch(/48 hodin/);

    const trhy = text("eet-trhy-stanky");
    expect(trhy).toMatch(/mobilní provozovn/);
    expect(trhy).toMatch(/48 hodin/);
    expect(trhy).toContain("§ 7");
    expect(trhy).toMatch(/QR/);

    const eshop = text("eet-eshop-dobirka");
    expect(eshop).toMatch(/zatím není jisté/i);
    expect(eshop).toMatch(/osobní(m)? odběr/);
    expect(eshop).toMatch(/platební brán/);
  });

  it("gate: the dobírka question is in the list for the tax adviser", () => {
    const list = readFileSync(new URL("../../../docs/revize-danovy-poradce.md", import.meta.url), "utf8");
    expect(list).toMatch(/C1[^\n]*eet-eshop-dobirka/);
    expect(list).toMatch(/[Dd]obírk[^\n]*dopravc/);
  });
});
