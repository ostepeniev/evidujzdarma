/**
 * S7-VIZ (28. 10. 2026): vizuální bloky v návodech (stats, timeline, story, conditions) a tři nové návody z oficiálních
 * příkladů MF a FS. Rozhodnutí vlastníka (DECISIONS Ф15): basis "official" → indexuje se hned, ale strojové kanály
 * (llms.txt, MCP) je vydají až po odborné revizi (Ф9).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuideBlock } from "@/components/guide-blocks";
import { SOURCES } from "@/content/facts";
import { GUIDES, getGuide, isIndexable, isMachineReadable } from "@/content/guides";
import type { Block } from "@/content/guides/types";

const NEW = ["eet-2-0-v-prikladech", "spropitne-a-eet", "prvni-tyden-s-eet"] as const;
const html = (b: Block) => renderToStaticMarkup(GuideBlock({ block: b }));

describe("S7-VIZ – visual blocks", () => {
  it("gate: each new block type renders its data and a data-block marker", () => {
    expect(html({ stats: [{ value: "7 %", label: "tržeb", note: "strop" }] })).toMatch(/data-block="stats"[\s\S]*7 %[\s\S]*tržeb[\s\S]*strop/);
    expect(html({ timeline: [{ date: "1. 11.", title: "DIS+", text: "certifikát" }] })).toMatch(/data-block="timeline"[\s\S]*1\. 11\.[\s\S]*DIS\+[\s\S]*certifikát/);
    expect(html({ story: [{ time: "08:10", title: "Snídaně", text: "jedna tržba" }] })).toMatch(/data-block="story"[\s\S]*08:10[\s\S]*Snídaně[\s\S]*jedna tržba/);
    const c = html({ conditions: [{ title: "A", text: "a" }, { title: "B", text: "b" }, { title: "C", text: "c" }] });
    expect(c).toContain('data-block="conditions"');
    expect(c.match(/>\+</g)?.length).toBe(2);
  });

  it("gate: key guides got visuals (pillar timeline + conditions, EET OFF stats, offline timeline, gastro stats)", () => {
    const has = (slug: string, key: string) => getGuide(slug)!.sections.some((s) => s.blocks.some((b) => key in b));
    expect(has("eet-2-0-kompletni-pruvodce", "timeline")).toBe(true);
    expect(has("eet-2-0-kompletni-pruvodce", "conditions")).toBe(true);
    expect(has("eet-off", "stats")).toBe(true);
    expect(has("eet-bez-internetu", "timeline")).toBe(true);
    expect(has("eet-gastronomie", "stats")).toBe(true);
  });
});

describe("S7-VIZ – new guides from official examples", () => {
  it("gate: basis official, not reviewed yet → indexable for search, not for machine channels", () => {
    for (const slug of NEW) {
      const g = getGuide(slug)!;
      expect(g, slug).toBeTruthy();
      expect(g.basis, slug).toBe("official");
      expect(g.reviewedBy, slug).toBeNull();
      expect(isIndexable(g), slug).toBe(true);
      expect(isMachineReadable(g), slug).toBe(false);
      expect(g.sources.map((s) => s.url), slug).toContain(SOURCES.seminarVyvojari.url);
    }
  });

  it("gate: every guide marked official uses only public sources and no tax advice beyond the official slide", () => {
    for (const g of GUIDES.filter((x) => x.basis === "official")) {
      const t = JSON.stringify(g);
      expect(t, g.slug).not.toMatch(/doporučujeme zvolit|vyplatí se vám|měli byste zvolit EET OFF/i);
    }
  });

  it("gate: 15 situations are numbered 1–15 in the examples guide", () => {
    const t = JSON.stringify(getGuide("eet-2-0-v-prikladech"));
    for (let i = 1; i <= 15; i++) expect(t, String(i)).toContain(`${i}. `);
  });

  it("gate: each new guide uses at least one visual block", () => {
    for (const slug of NEW) {
      const g = getGuide(slug)!;
      const visual = g.sections.some((s) => s.blocks.some((b) => "stats" in b || "timeline" in b || "story" in b || "conditions" in b));
      expect(visual, slug).toBe(true);
    }
  });
});
