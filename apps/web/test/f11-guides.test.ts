/**
 * Ф11 (controller, review #4): guides follow the FS seminar for developers.
 * Záloha a doplatek = two ordinary payments; dárkový poukaz is evidenced only when sold;
 * „částka určená k čerpání“ and „čerpání“ belong to credit only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("../src/content/guides/", import.meta.url);
const guides = readdirSync(dir)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
  .map((f) => ({ f, s: readFileSync(new URL(f, dir), "utf8") }));

const WRONG: [RegExp, string][] = [
  [/(poukaz\w*|zálohy?)[^"\n]{0,80}evidují dvakrát/i, "vouchers or deposits evidenced twice"],
  [/poukaz\w*[^"\n]{0,40}při prodeji i při uplatnění/i, "voucher evidenced when redeemed"],
  [/[Uu]platnění dárkového poukazu", "\*\*Ano\*\*/, "voucher redemption marked as evidenced"],
  [/záloh\w*[^"\n]{0,60}jako částk\w* určen\w* k (pozdějšímu )?čerpání/i, "deposit sent as amount for later drawing"],
  [/čerpání(m)? zálohy/i, "drawing of a deposit"],
];

describe("Ф11 – guides on zálohy, kredit and dárkové poukazy", () => {
  for (const [re, what] of WRONG) {
    it(`no guide says: ${what}`, () => {
      const hits = guides.filter((g) => re.test(g.s)).map((g) => g.f);
      expect(hits).toEqual([]);
    });
  }

  it("guides that explain čerpání cite the FS seminar", () => {
    const missing = guides
      .filter((g) => /určen\w* k (pozdějšímu |následnému )?čerpání/.test(g.s))
      .filter((g) => !g.s.includes("SOURCES.seminarVyvojari"))
      .map((g) => g.f);
    expect(missing).toEqual([]);
  });
});
