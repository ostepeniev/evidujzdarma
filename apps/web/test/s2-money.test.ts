/**
 * S2/B2 – peněžní kalkulačky 2026 (čistá mzda, OSVČ, spropitné) a rozšíření kalkulačky EET OFF.
 *  - parametry 2026 = vzorce zákona (průměrná mzda 48 967 Kč → hranice, minima, zálohy, paušální pásma) a úřední příklady
 *    (ČSSZ: úspora 8 577 Kč, záloha 5 420 Kč z 18 560 Kč; VZP: 3 024 Kč z minimální mzdy);
 *  - ručně přepočítané příklady (výpočty jsou rozepsané u každého testu);
 *  - přepínač MONEY_CALCULATORS_REVIEWED: dokud je false, noindex a nikde v sitemap, llms.txt ani /nastroje.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FC } from "react";
import { describe, expect, it } from "vitest";
import { pageText } from "./helpers/render-text";
import { FACTS } from "@/content/facts";
import { DEFAULT_INPUT, calculateEetOff, eetOffYear } from "@/lib/eet-off";
import { llmsTxt } from "@/lib/llms";
import { P2026, ceilAdvanceBase, childBenefitMonthly, childBenefitYearly, floor100, pctCeil, progressiveTaxCeil } from "@/lib/money-2026";
import { MONEY_CALCULATORS_REVIEWED, MONEY_DISCLAIMER, MONEY_PAGES } from "@/lib/money-review";
import { calculateNetWage, type NetWageInput } from "@/lib/net-wage";
import { OSVC_DEFAULT, calculateOsvc, type OsvcInput } from "@/lib/osvc-2026";
import { sitePages } from "@/lib/site-pages";
import { STATIC_PAGES } from "@/lib/static-pages";
import { TIPS_DEFAULT, calculateTips } from "@/lib/tips";
import * as NetWagePage from "@/app/(site)/kalkulacka-cista-mzda/page";
import * as OsvcPage from "@/app/(site)/kalkulacka-osvc/page";
import * as TipsPage from "@/app/(site)/kalkulacka-spropitne/page";

const SRC = join(__dirname, "../src");
const AVG = P2026.prumernaMzda.value;

describe("S2/B2 – 2026 parameters follow the statutory formulas", () => {
  it("average wage 2026 = 46 278 × 1,0581 rounded up; tax and insurance limits derive from it", () => {
    expect(Math.ceil(46_278 * 1.0581)).toBe(48_967);
    expect(AVG).toBe(48_967);
    expect(P2026.hraniceMesicni.value).toBe(3 * AVG); // § 38h odst. 2 ZDP
    expect(P2026.hraniceRocni.value).toBe(36 * AVG); // § 16 odst. 1 ZDP
    expect(P2026.maxVzSoc.value).toBe(48 * AVG); // § 15a z. č. 589/1992 Sb.
  });

  it("OSVČ minimum bases: 35 % / 25 % / 11 % of the average wage rounded up (§ 14 odst. 5, § 5d), health 50 % (§ 3a)", () => {
    expect(P2026.minVzHlavni.value).toBe(Math.ceil(0.35 * AVG)); // 17 139
    expect(P2026.minVzZacinajici.value).toBe(Math.ceil(0.25 * AVG)); // 12 242
    expect(P2026.minVzVedlejsi.value).toBe(Math.ceil(0.11 * AVG)); // 5 387
    expect(P2026.minVzZdr.value).toBe(AVG / 2); // 24 483,50
    expect(P2026.rozhodnaCastka.value).toBe(Math.ceil(2.4 * AVG)); // 117 521
    expect(P2026.rozhodnaCastkaMesic.value).toBe(Math.ceil(P2026.rozhodnaCastka.value / 12)); // 9 794
  });

  it("official minimum advances = rate × minimum base rounded up (ČSSZ, VZP)", () => {
    expect(pctCeil(Math.ceil(0.4 * AVG), 29.2)).toBe(P2026.minZalohaHlavniDoCervna.value); // 19 587 → 5 720
    expect(pctCeil(P2026.minVzHlavni.value, 29.2)).toBe(P2026.minZalohaHlavniOdCervence.value); // 17 139 → 5 005
    expect(pctCeil(P2026.minVzVedlejsi.value, 29.2)).toBe(P2026.minZalohaVedlejsi.value); // 5 387 → 1 574
    expect(pctCeil(P2026.minVzZdr.value, 13.5)).toBe(P2026.minZalohaZdr.value); // 24 483,50 → 3 306
    expect(pctCeil(P2026.minVzZacinajici.value, 29.2)).toBe(3_575); // ČSSZ: začínající OSVČ 3 575 Kč
  });

  it("official examples: ČSSZ saving 8 577 Kč (40 % → 35 % for a full year), ČSSZ advance 5 420 Kč, VZP minimum 3 024 Kč", () => {
    expect(pctCeil(Math.ceil(0.4 * AVG) * 12, 29.2) - pctCeil(P2026.minVzHlavni.value * 12, 29.2)).toBe(8_577); // 68 633 − 60 056
    expect(pctCeil(18_560, 29.2)).toBe(5_420);
    expect(pctCeil(P2026.minimalniMzda.value, 13.5)).toBe(3_024);
  });

  it("paušální pásma 2026 = 100 / 4 963 / 9 320 Kč daň + sociální (§ 14 odst. 3) + zdravotní (§ 3a odst. 5) záloha", () => {
    const band1Social = (minVz: number) => pctCeil(Math.ceil(minVz * 1.15), 29.2);
    expect(100 + band1Social(P2026.minVzHlavni.value) + P2026.minZalohaZdr.value).toBe(P2026.pausal1.value); // 100 + 5 756 + 3 306 = 9 162
    expect(100 + band1Social(Math.ceil(0.4 * AVG)) + P2026.minZalohaZdr.value).toBe(P2026.pausal1DoCervna.value); // 100 + 6 578 + 3 306 = 9 984
    expect(4_963 + pctCeil(28_050, 29.2) + pctCeil(319_200 / 12, 13.5)).toBe(P2026.pausal2.value); // 4 963 + 8 191 + 3 591
    expect(9_320 + pctCeil(42_900, 29.2) + pctCeil(470_400 / 12, 13.5)).toBe(P2026.pausal3.value); // 9 320 + 12 527 + 5 292
    expect(P2026.pausal1.value).toBe(FACTS.pausal[2026].band1);
    expect(6 * (P2026.pausal1DoCervna.value - P2026.pausal1.value)).toBe(4_932); // FS: přeplatek za leden až červen
  });

  it("monthly credits are exactly 1/12 of the annual amounts", () => {
    expect(P2026.slevaPoplatnik.value / 12).toBe(2_570);
    expect(childBenefitMonthly(1)).toBe(1_267);
    expect(childBenefitMonthly(2)).toBe(1_267 + 1_860);
    expect(childBenefitMonthly(4)).toBe(1_267 + 1_860 + 2 * 2_320);
    expect(childBenefitYearly(3)).toBe(15_204 + 22_320 + 27_840);
    expect(P2026.bonusPrijemRocni.value).toBe(6 * P2026.minimalniMzda.value);
  });

  it("rounding helpers: percent up to whole Kč, advance base up to hundreds, tax base down to hundreds", () => {
    expect(pctCeil(40_000, 7.1)).toBe(2_840);
    expect(pctCeil(40_001, 13.5)).toBe(5_401); // 5 400,135
    expect(pctCeil(0, 29.2)).toBe(0);
    expect(ceilAdvanceBase(35_250)).toBe(35_300);
    expect(ceilAdvanceBase(40_000)).toBe(40_000);
    expect(ceilAdvanceBase(99.2)).toBe(100);
    expect(floor100(320_099)).toBe(320_000);
    expect(progressiveTaxCeil(200_000, 146_901)).toBe(34_248); // 22 035,15 + 12 212,77
  });
});

/** upozornění jako jeden řetězec s obyčejnými mezerami (cs-CZ odděluje tisíce pevnou mezerou) */
const flat = (w: readonly string[]) => w.join(" ").replace(/\s/g, " ");

const wage = (gross: number, declaration = true, children = 0) => {
  const r = calculateNetWage({ gross, declaration, children } satisfies NetWageInput);
  if (!r.ok) throw new Error(r.reason);
  return r;
};

describe("S2/B2 – net wage 2026 (worked examples by hand)", () => {
  it("40 000 Kč, prohlášení, bez dětí → čistá 31 930 Kč, cena práce 53 520 Kč", () => {
    // sociální 7,1 % = 2 840; zdravotní 13,5 % = 5 400 → třetina 1 800; záloha 15 % z 40 000 = 6 000 − 2 570 = 3 430
    const r = wage(40_000);
    expect([r.socialEmployee, r.healthTotal, r.healthEmployee, r.advanceBase, r.advance, r.taxpayerCredit, r.advanceAfterCredits]).toEqual([2_840, 5_400, 1_800, 40_000, 6_000, 2_570, 3_430]);
    expect(r.net).toBe(31_930);
    // zaměstnavatel: 24,8 % = 9 920; zdravotní 5 400 − 1 800 = 3 600
    expect([r.socialEmployer, r.healthEmployer, r.employerCost]).toEqual([9_920, 3_600, 53_520]);
  });

  it("35 250 Kč, 1 dítě → základ 35 300, čistá 29 702 Kč", () => {
    // sociální 2 502,75 → 2 503; zdravotní 4 758,75 → 4 759, třetina 1 586,33 → 1 587; záloha 15 % z 35 300 = 5 295
    // − 2 570 = 2 725 − 1 267 (sleva na dítě) = 1 458; čistá 35 250 − 2 503 − 1 587 − 1 458 = 29 702
    const r = wage(35_250, true, 1);
    expect([r.socialEmployee, r.healthEmployee, r.advanceBase, r.advance, r.childCredit, r.childBonus, r.advanceAfterCredits]).toEqual([2_503, 1_587, 35_300, 5_295, 1_267, 0, 1_458]);
    expect(r.net).toBe(29_702);
    expect(r.employerCost).toBe(35_250 + 8_742 + (4_759 - 1_587)); // 47 164
  });

  it("30 000 Kč, 2 děti → daňový bonus 1 197 Kč, čistá 27 717 Kč", () => {
    // záloha 4 500 − 2 570 = 1 930; zvýhodnění 1 267 + 1 860 = 3 127 → sleva 1 930, bonus 1 197
    const r = wage(30_000, true, 2);
    expect([r.socialEmployee, r.healthEmployee, r.advanceAfterCredits, r.childCredit, r.childBonus]).toEqual([2_130, 1_350, 0, 1_930, 1_197]);
    expect(r.net).toBe(27_717);
  });

  it("200 000 Kč → 23 % nad 146 901 Kč, čistá 145 122 Kč, upozornění na strop pojistného", () => {
    // záloha 15 % × 146 901 + 23 % × 53 099 = 34 247,92 → 34 248 − 2 570 = 31 678; sociální 14 200; zdravotní 9 000
    const r = wage(200_000);
    expect([r.advance, r.advanceAfterCredits, r.socialEmployee, r.healthEmployee]).toEqual([34_248, 31_678, 14_200, 9_000]);
    expect(r.net).toBe(145_122);
    expect(flat(r.warnings)).toMatch(/23 %/);
    expect(flat(r.warnings)).toMatch(/maximálního vyměřovacího základu/);
  });

  it("bez prohlášení se sleva ani děti neuplatní (40 000 Kč → 29 360 Kč)", () => {
    const r = wage(40_000, false, 2);
    expect([r.taxpayerCredit, r.childCredit, r.childBonus, r.advanceAfterCredits]).toEqual([0, 0, 0, 6_000]);
    expect(r.net).toBe(29_360);
  });

  it("10 000 Kč, 3 děti → bonus se nevyplatí (mzda pod polovinou minimální mzdy 11 200 Kč), upozornění na minimální základ", () => {
    const r = wage(10_000, true, 3);
    expect([r.socialEmployee, r.healthEmployee, r.advance, r.taxpayerCredit, r.childBonus, r.childBonusLost]).toEqual([710, 450, 1_500, 1_500, 0, 5_447]);
    expect(r.net).toBe(8_840);
    expect(flat(r.warnings)).toMatch(/11 200 Kč/);
    expect(flat(r.warnings)).toMatch(/minimální mzda/);
  });

  it("a bonus below 50 Kč is not paid monthly", () => {
    // 17 100 Kč: záloha 15 % z 17 100 = 2 565 → sleva 2 565 (zbylých 5 Kč propadá); dítě 1 267 → bonus 1 267 (≥ 50) – vyplatí se
    expect(wage(17_100, true, 1).childBonus).toBe(1_267);
    // 21 400 Kč: záloha 3 210 − 2 570 = 640; dítě 1 267 → sleva 640, bonus 627
    expect(wage(21_400, true, 1).childBonus).toBe(627);
    // 25 800 Kč: záloha 3 870 − 2 570 = 1 300 → sleva 1 267, bonus 0
    expect(wage(25_800, true, 1).childBonus).toBe(0);
    // 25 500 Kč: záloha 3 825 − 2 570 = 1 255 → sleva 1 255, bonus 12 Kč < 50 → nevyplácí se
    const r = wage(25_500, true, 1);
    expect([r.childCredit, r.childBonus, r.childBonusLost]).toEqual([1_255, 0, 12]);
  });

  it("wages below 4 500 Kč are out of scope", () => {
    expect(calculateNetWage({ gross: 4_000, declaration: true, children: 0 }).ok).toBe(false);
    expect(calculateNetWage({ gross: 4_500, declaration: true, children: 0 }).ok).toBe(true);
  });
});

const osvc = (o: Partial<OsvcInput>) => calculateOsvc({ ...OSVC_DEFAULT, ...o });

describe("S2/B2 – OSVČ 2026 (worked examples by hand)", () => {
  it("800 000 Kč, paušál 60 %, hlavní → daň 17 160, sociální 60 056 (minimum), zdravotní 39 664 (minimum), celkem 116 880; 1. pásmo levnější", () => {
    // výdaje 480 000; základ 320 000; daň 48 000 − 30 840; sociální VZ max(176 000; 17 139 × 12 = 205 668) × 29,2 % = 60 055,06 → 60 056
    // zdravotní VZ max(160 000; 293 802) × 13,5 % = 39 663,27 → 39 664
    const r = osvc({});
    expect([r.expenses, r.profit, r.taxBase, r.taxBeforeCredits, r.tax]).toEqual([480_000, 320_000, 320_000, 48_000, 17_160]);
    expect([r.social.base, r.social.premium, r.health.base, r.health.premium]).toEqual([205_668, 60_056, 293_802, 39_664]);
    expect(r.total).toBe(116_880);
    expect(r.cheapestPausal?.band).toBe(1);
    expect(r.cheapestPausal?.yearly).toBe(12 * 9_162);
  });

  it("2 000 000 Kč, paušál 80 % (právě na stropu 1,6 mil.) → sociální z 55 % zisku", () => {
    const r = osvc({ income: 2_000_000, expenseRate: 80 });
    expect([r.expenses, r.expensesCapped, r.profit, r.tax]).toEqual([1_600_000, false, 400_000, 29_160]);
    expect([r.social.base, r.social.premium, r.health.premium]).toEqual([220_000, 64_240, 39_664]);
    expect(r.total).toBe(29_160 + 64_240 + 39_664);
    expect(r.pausal.map((b) => b.available)).toEqual([true, true, true]); // 80 %: 1. pásmo až do 2 mil. Kč
  });

  it("3 000 000 Kč, paušál 60 % → strop výdajů 1,2 mil., 23 % nad 1 762 812 Kč, paušální režim nelze", () => {
    // daň 15 % × 1 762 812 + 23 % × 37 188 = 264 421,80 + 8 553,24 = 272 975,04 → 272 976 − 30 840 = 242 136
    const r = osvc({ income: 3_000_000, expenseRate: 60 });
    expect([r.expenses, r.expensesCapped, r.profit, r.taxBeforeCredits, r.tax]).toEqual([1_200_000, true, 1_800_000, 272_976, 242_136]);
    expect([r.social.premium, r.health.premium]).toEqual([289_080, 121_500]); // 990 000 × 29,2 %; 900 000 × 13,5 %
    expect(r.cheapestPausal).toBeNull();
  });

  it("vedlejší činnost pod rozhodnou částkou → bez sociálního pojištění, zdravotní bez minima", () => {
    const r = osvc({ income: 150_000, activity: "vedlejsi" }); // zisk 60 000 < 117 521
    expect([r.social.participates, r.social.premium, r.health.base, r.health.premium, r.tax]).toEqual([false, 0, 30_000, 4_050, 0]);
    expect(r.taxpayerCredit).toBe(9_000); // sleva jen do výše daně
  });

  it("vedlejší činnost nad rozhodnou částkou a snížení rozhodné částky za měsíce bez činnosti", () => {
    const r = osvc({ income: 400_000, expenseRate: 40, activity: "vedlejsi" }); // zisk 240 000
    expect([r.social.participates, r.social.base, r.social.premium, r.health.premium, r.tax]).toEqual([true, 132_000, 38_544, 16_200, 5_160]);
    expect(osvc({ income: 150_000, activity: "vedlejsi", months: 6 }).social.threshold).toBe(117_521 - 6 * 9_794);
    // zisk přesně na rozhodné částce = účast („dosáhl aspoň“)
    const atThreshold = osvc({ income: 117_521, realExpenses: 0, activity: "vedlejsi" });
    expect([atThreshold.social.participates, atThreshold.social.base]).toEqual([true, 64_644]); // 55 % = 64 637 < 5 387 × 12
  });

  it("skutečné výdaje, ztráta a 6 měsíců činnosti", () => {
    const real = osvc({ income: 1_000_000, realExpenses: 700_000 });
    expect([real.profit, real.tax, real.social.premium, real.health.premium, real.total]).toEqual([300_000, 14_160, 60_056, 39_664, 113_880]);
    const loss = osvc({ income: 100_000, realExpenses: 150_000 });
    expect([loss.profit, loss.taxBase, loss.tax, loss.social.premium, loss.health.premium]).toEqual([-50_000, 0, 0, 60_056, 39_664]);
    // 6 měsíců: sociální min 17 139 × 6 = 102 834 → 30 027,53 → 30 028; zdravotní 24 483,50 × 6 = 146 901 → 19 831,64 → 19 832
    const half = osvc({ income: 400_000, months: 6 });
    expect([half.social.base, half.social.premium, half.health.base, half.health.premium, half.tax]).toEqual([102_834, 30_028, 146_901, 19_832, 0]);
    expect(half.cheapestPausal?.yearly).toBe(6 * 9_162);
  });

  it("daňový bonus na děti při příjmech aspoň 134 400 Kč", () => {
    // zisk 120 000 → daň 18 000, sleva na poplatníka 18 000; zvýhodnění 15 204 + 22 320 = 37 524 → celé jako bonus
    const r = osvc({ income: 300_000, children: 2 });
    expect([r.tax, r.childCredit, r.childBonus]).toEqual([0, 0, 37_524]);
    expect(r.total).toBe(-37_524 + 60_056 + 39_664);
    expect(osvc({ income: 130_000, children: 1 }).childBonus).toBe(0); // příjmy pod 6× minimální mzdou
  });

  it("maximum vyměřovacího základu pro sociální pojištění 2 350 416 Kč", () => {
    const r = osvc({ income: 6_000_000, realExpenses: 1_000_000 });
    expect([r.social.capped, r.social.base, r.social.premium]).toEqual([true, 2_350_416, 686_322]); // 686 321,47 → 686 322
  });
});

describe("S2/B2 – tips (§ 6 odst. 9 písm. g) ZDP from 1. 1. 2027)", () => {
  it("default: 7 % of 400 000 = 28 000 Kč; 3 recipients → 9 333,33 Kč each; employer-set amounts can exempt all 24 000 Kč", () => {
    const r = calculateTips(TIPS_DEFAULT);
    expect([r.cap, r.recipients, r.perEmployeeLimit]).toEqual([28_000, 3, 9_333.33]);
    expect(r.rows).toEqual([
      { tip: 12_000, exempt: 9_333.33, over: 2_666.67 },
      { tip: 9_000, exempt: 9_000, over: 0 },
      { tip: 3_000, exempt: 3_000, over: 0 },
    ]);
    expect([r.totalTips, r.exemptA, r.overA, r.exemptBMax, r.overBMin]).toEqual([24_000, 21_333.33, 2_666.67, 24_000, 0]);
  });

  it("employees without tips do not count; over the cap in both ways", () => {
    const r = calculateTips({ monthlyFoodIncome: 100_000, tips: [10_000, 0] });
    expect([r.cap, r.recipients, r.perEmployeeLimit, r.overA, r.exemptBMax, r.overBMin]).toEqual([7_000, 1, 7_000, 3_000, 7_000, 3_000]);
  });

  it("no tips → no limit per employee; haléře round down", () => {
    expect(calculateTips({ monthlyFoodIncome: 50_000, tips: [0, 0] }).perEmployeeLimit).toBeNull();
    const r = calculateTips({ monthlyFoodIncome: 100_000.01, tips: [1, 1, 1] });
    expect([r.cap, r.perEmployeeLimit]).toEqual([7_000, 2_333.33]);
  });
});

describe("S2/B2 – EET OFF: annual sum with the flat tax and break-even (instead of a duplicate page)", () => {
  it("default 300 Kč/h, 21 days, 5 min/day → 13,3 min/day break-even; 2027 totals", () => {
    const r = calculateEetOff(DEFAULT_INPUT);
    if (!r.eligible) throw new Error("eligible");
    const y = eetOffYear(DEFAULT_INPUT, r);
    const pausal = 12 * FACTS.pausal[2027].band1;
    expect(y).toEqual({ pausalTotal: pausal, withEetOff: pausal + 16_800, withEvidence: pausal + 6_300, breakEvenMinutesPerDay: 13.3 });
    expect(eetOffYear({ ...DEFAULT_INPUT, hourlyRate: 0 }, r).breakEvenMinutesPerDay).toBeNull();
  });

  it("no separate /kalkulacka-pausal-vs-eet-off page exists", () => {
    expect(() => readFileSync(join(SRC, "app/(site)/kalkulacka-pausal-vs-eet-off/page.tsx"))).toThrow();
  });
});

describe("S2/B2 – review flag: noindex and unlisted until the accountant's review", () => {
  const pages = [
    ["/kalkulacka-cista-mzda", NetWagePage],
    ["/kalkulacka-osvc", OsvcPage],
    ["/kalkulacka-spropitne", TipsPage],
  ] as const;

  it("MONEY_PAGES lists exactly the three money calculators", () => {
    expect(MONEY_PAGES.map((p) => p.path)).toEqual(pages.map((p) => p[0]));
  });

  it("gate: robots noindex,follow while MONEY_CALCULATORS_REVIEWED is false (and index after the flip)", async () => {
    for (const [path, mod] of pages) {
      if (!MONEY_CALCULATORS_REVIEWED) expect(mod.metadata.robots, path).toEqual({ index: false, follow: true });
      else expect(mod.metadata.robots, path).toBeUndefined();
      expect(mod.metadata.alternates?.canonical).toBe(path);
    }
  });

  it("gate: not in sitemap/STATIC_PAGES, llms.txt or /nastroje while false", async () => {
    const sitemap = sitePages().map((p) => p.path);
    const statics = STATIC_PAGES.map((p) => p.path);
    const llms = llmsTxt();
    const { default: Tools } = await import("@/app/(site)/nastroje/page");
    const tools = pageText(Tools as FC);
    for (const m of MONEY_PAGES) {
      if (!MONEY_CALCULATORS_REVIEWED) {
        expect(sitemap, m.path).not.toContain(m.path);
        expect(statics, m.path).not.toContain(m.path);
        expect(llms, m.path).not.toContain(m.path);
        expect(tools, m.path).not.toContain(m.title);
      } else {
        expect(sitemap).toContain(m.path);
        expect(llms).toContain(m.path);
        expect(tools).toContain(m.title);
      }
    }
  });

  it("gate: every money calculator shows the disclaimer verbatim, a FAQ with sources, and no browser storage", async () => {
    expect(MONEY_DISCLAIMER).toBe("Orientační výpočet, nejde o daňové poradenství.");
    for (const [path, mod] of pages) {
      const text = pageText(mod.default as FC);
      expect(text, path).toContain(MONEY_DISCLAIMER);
      expect(text, path).toContain("Časté otázky");
      expect(text, path).toContain("Zdroje:");
      expect(text, path).toContain("Předregistrovat zdarma"); // ToolCta
    }
    for (const f of ["components/tools/net-wage-calculator.tsx", "components/tools/osvc-calculator.tsx", "components/tools/tips-calculator.tsx", "components/tools/money-ui.tsx", "components/money-params.tsx"]) {
      expect(readFileSync(join(SRC, f), "utf8"), f).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    }
  });

  it("gate: net wage and OSVČ pages show the 2026 parameter table with sources", async () => {
    for (const [dir, mod] of [pages[0], pages[1]]) {
      const text = pageText(mod.default as FC);
      expect(text, dir).toContain("Parametry výpočtu pro rok 2026");
      expect(text, dir).toContain("48 967 Kč");
    }
  });
});
