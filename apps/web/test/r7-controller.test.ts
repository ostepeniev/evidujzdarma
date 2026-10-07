import { describe, expect, it } from "vitest";
import { canonicalMeta, OG_IMAGE } from "@/lib/metadata";
import { GUIDES, isIndexable } from "@/content/guides";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Рецензія №7: правки контролера перед деплоєм R8.10/R9.
describe("review 7 – controller fixes", () => {
  it("canonicalMeta keeps og:image (Next replaces the whole openGraph object per layer)", () => {
    const m = canonicalMeta("/cenik", { title: "Ceník" });
    const og = m.openGraph as { url?: string; images?: unknown[] };
    expect(og.url).toBe("/cenik");
    expect(og.images).toEqual([OG_IMAGE]);
    expect(OG_IMAGE.url).toBe("/opengraph-image");
  });

  it("the /navody hub lists only reviewed guides", () => {
    const src = readFileSync(join(__dirname, "../src/app/(site)/navody/page.tsx"), "utf8");
    expect(src).toMatch(/GUIDES\.filter\(\(g\) => g\.category === cat && isIndexable\(g\)\)/);
    expect(GUIDES.some((g) => !isIndexable(g))).toBe(true); // C1 koncepty existují, ale v seznamu nejsou
  });

  it("guide CTA does not claim a working register while /pokladna is closed", () => {
    const src = readFileSync(join(__dirname, "../src/components/guide-blocks.tsx"), "utf8");
    expect(src).toContain("Pokladnu pro EET 2.0 zdarma připravujeme – bude fungovat i bez signálu.");
    expect(src).toContain('isClosed("/pokladna")');
  });
});
