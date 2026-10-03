/**
 * R6.7 (Ф11) – záloha a doplatek jsou běžné platby. Pokladna u kreditu upozorní, že doplatek po záloze sem nepatří,
 * a export nenazývá starší „voucher“ (čerpání → cerp_zuct) zálohou.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

describe("R6.7 – texts do not mix záloha with credit", () => {
  it("credit hint on the POS says a doplatek after a záloha is an ordinary payment", () => {
    const sheet = src("components/pos/payment-sheet.tsx");
    const hint = sheet.slice(sheet.indexOf('method === "credit"'), sheet.indexOf('method === "gift_voucher"'));
    expect(hint).toMatch(/[Dd]oplatek po záloze/);
  });

  it("CSV export does not label the legacy voucher column as záloha", () => {
    expect(src("app/api/ucet/export/route.ts")).not.toMatch(/Poukaz\/záloha/);
  });
});
