/**
 * R2.8 – nástroje mluví opatrně („pravděpodobně“, disclaimer) a kalkulačka má přesné hranice.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FACTS } from "@/content/facts";
import { calculateEetOff, DEFAULT_INPUT } from "@/lib/eet-off";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const zero = { ...DEFAULT_INPUT, minutesPerDay: 0, hourlyRate: 0, toolsMonthly: 0, startMonth: 1 };
const verdict = (hardwareOneOff: number) => {
  const r = calculateEetOff({ ...zero, hardwareOneOff });
  return r.eligible ? [r.difference, r.verdict] : [null, null];
};

describe("R2.8 – EET OFF calculator boundaries", () => {
  it("income exactly 1 000 000 Kč is eligible, 1 000 001 Kč is not", () => {
    expect(calculateEetOff({ ...DEFAULT_INPUT, income: 1_000_000 }).eligible).toBe(true);
    expect(calculateEetOff({ ...DEFAULT_INPUT, income: 1_000_001 }).eligible).toBe(false);
  });

  it("tie is strictly below 1 200 Kč difference on both sides", () => {
    // 12 měsíců: přirážka 16 800 Kč; zařízení se rozpočítá na 3 roky
    expect(verdict(3 * 17_999)).toEqual([1199, "tie"]);
    expect(verdict(3 * 18_000)).toEqual([1200, "eet-off"]);
    expect(verdict(3 * 15_601)).toEqual([-1199, "tie"]);
    expect(verdict(3 * 15_600)).toEqual([-1200, "evidence"]);
  });
});

describe("R2.8 – cautious wording", () => {
  it("calculator result card carries the disclaimer and the full-year note", () => {
    const ui = read("src/components/tools/eet-off-calculator.tsx");
    expect(ui).toContain("nejde o daňové poradenství");
    expect(ui).toContain("Evidence vás pravděpodobně vyjde levněji");
    expect(ui).toMatch(/celý kalendářní rok/);
  });

  it("quiz, units wizard and IČO check say 'pravděpodobně' and are not advice", () => {
    const quiz = read("src/components/tools/quiz.tsx");
    expect(quiz).not.toMatch(/title: "Evidence tržeb se vás netýká"|title: "Ano, tržby budete evidovat|title: "Evidovat musíte/);
    expect(quiz).toContain("nejde o daňové poradenství");
    const wizard = read("src/components/tools/units-wizard.tsx");
    expect(wizard).toMatch(/pravděpodobně/i);
    expect(wizard).toContain("nejde o daňové poradenství");
    expect(read("src/components/ico-result.tsx")).toContain("nejde o daňové poradenství");
  });

  it("'příležitostné příjmy' are § 10 ZDP other income; ojedinělá tržba explained per FS", () => {
    expect(FACTS.whoMust.notCovered).toMatch(/ostatní\p{L}* \(příležitostn\p{L}+\) příjm\p{L}* podle § 10 ZDP/u);
    expect(FACTS.whoMust.occasional).toContain("výjimečně a nečekaně");
  });
});
