/**
 * R2.10 – funkce, které pokladna ještě nemá (SMS účtenky, Tap to Pay, USB tiskárna, čtečka kódů,
 * PDF doklad, export do Pohody/Money), se na webu neprodávají jako hotové: buď „připravujeme“, nebo pryč.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPARISON_ROWS } from "@/content/comparison";
import { FEATURE_MATRIX, PLANS } from "@/content/pricing";
import { llmsTxt } from "@/lib/llms";

const NOT_YET = /SMS|USB|čtečk|PDF|Pohod|Money|ABRA|Tap to Pay|SoftPOS/i;
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("R2.10 – not-yet-existing features are labelled 'připravujeme'", () => {
  it("our column in the MOJE eet comparison", () => {
    for (const r of COMPARISON_ROWS) if (NOT_YET.test(r.ours)) expect(r.ours, r.feature).toMatch(/připravujeme/i);
  });

  it("landing feature tiles and llms.txt intro", () => {
    const landing = read("src/app/(site)/page.tsx");
    for (const m of landing.matchAll(/text: "([^"]+)"/g)) if (NOT_YET.test(m[1]!)) expect(m[1], m[1]).toMatch(/připravujeme/i);
    const intro = llmsTxt().split("\n").find((l) => l.startsWith("> "))!;
    if (NOT_YET.test(intro)) expect(intro).toMatch(/připravujeme/i);
  });

  it("the free plan promises only what exists; Premium is marked as later", () => {
    const free = PLANS.find((p) => p.id === "zdarma")!;
    for (const f of free.features) expect(f).not.toMatch(NOT_YET);
    for (const row of FEATURE_MATRIX) if (row.free === true) expect(row.feature).not.toMatch(NOT_YET);
    expect(PLANS.find((p) => p.id === "premium")!.status).not.toBe("prereg");
  });

  it("export hints say Pohoda/Money are being prepared", () => {
    for (const f of ["src/components/setup/setup-app.tsx", "src/components/cabinet/cabinet-app.tsx", "src/app/(site)/ucetni/page.tsx"]) {
      for (const line of read(f).split("\n").filter((l) => /Pohod|Money/.test(l))) expect(line, f).toMatch(/připravujeme/i);
    }
  });
});
