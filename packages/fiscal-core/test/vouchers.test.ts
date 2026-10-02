/**
 * R5.10 – poukazy, stravenky a kredit podle semináře FS pro vývojáře („Specifické případy“):
 *  - stravenka / poukázka třetí strany + karta = jedna tržba na celou částku, bez cerp_zuct;
 *  - čerpání kreditu (čip, předplacená karta) = celk_trzba + cerp_zuct, nabití = urceno_cerp_zuct;
 *  - dárkový poukaz na konkrétní zboží či službu: eviduje se jen prodej, uplatnění ne.
 */
import { describe, expect, it } from "vitest";
import { eetSnapshot } from "../src/eet2/message.ts";
import { renderReceiptText } from "../src/receipt.ts";
import { buildSale, evidencedAmounts, type Payment, type SaleLine } from "../src/sale.ts";

const sale = (lines: SaleLine[], payments: Payment[]) =>
  buildSale({
    id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
    deviceId: "d",
    registerId: "P1",
    unitId: "303",
    sequence: "P1-000001",
    soldAt: "2027-01-15T10:30:00.000Z",
    lines,
    payments,
    vatPayer: false,
    mode: "test",
  });
const lunch = (amount: number): SaleLine[] => [{ name: "Polední menu", qty: 1, unitPrice: amount, vatRate: 12 }];

describe("R5.10 – vouchers, meal vouchers and credit", () => {
  it("seminar 1: 200 meal voucher + 800 card → celk_trzba 1000, no cerp_zuct", () => {
    const s = sale(lunch(100000), [
      { method: "meal_voucher", amount: 20000 },
      { method: "card", amount: 80000 },
    ]);
    expect(evidencedAmounts(s)).toEqual({ total: 100000, prepayment: 0, redeemed: 0 });
    const d = eetSnapshot(s, { eic: "CZ00000019" });
    expect(d.celk_trzba).toBe("1000.00");
    expect(d.cerp_zuct).toBeUndefined();
  });

  it("seminar 2: paying with chip credit → celk_trzba + cerp_zuct; topping the credit up → urceno_cerp_zuct", () => {
    const spend = sale(lunch(50000), [{ method: "credit", amount: 50000 }]);
    expect(evidencedAmounts(spend)).toEqual({ total: 50000, prepayment: 0, redeemed: 50000 });
    expect(eetSnapshot(spend, { eic: "CZ00000019" })).toMatchObject({ celk_trzba: "500.00", cerp_zuct: "500.00" });
    const topUp = sale([{ name: "Nabití kreditu", qty: 1, unitPrice: 30000, vatRate: 0, kind: "prepayment" }], [{ method: "cash", amount: 30000 }]);
    expect(eetSnapshot(topUp, { eic: "CZ00000019" })).toMatchObject({ celk_trzba: "300.00", urceno_cerp_zuct: "300.00" });
  });

  it("seminar 3: redeeming a gift voucher for specific goods is not evidenced", () => {
    expect(evidencedAmounts(sale(lunch(100000), [{ method: "gift_voucher", amount: 100000 }])).total).toBe(0);
    const mixed = sale(lunch(100000), [
      { method: "gift_voucher", amount: 30000 },
      { method: "cash", amount: 70000 },
    ]);
    expect(evidencedAmounts(mixed)).toEqual({ total: 70000, prepayment: 0, redeemed: 0 });
  });

  it("the receipt says a gift-voucher payment is not evidenced", () => {
    const s = sale(lunch(100000), [
      { method: "gift_voucher", amount: 30000 },
      { method: "cash", amount: 70000 },
    ]);
    const text = renderReceiptText({ merchant: { name: "Bistro", dic: null, ico: "12345679", address: null, unitLabel: "Bistro" }, sale: s, fiscal: { confirmationCode: null, securityCode: null, mode: "test" } });
    expect(text).toMatch(/Dárkový poukaz/);
    expect(text).toMatch(/uhrazeno poukazem, neeviduje se/);
  });

  it("legacy 'voucher' in stored sales keeps its former meaning (redemption of a prepayment)", () => {
    expect(evidencedAmounts(sale(lunch(30000), [{ method: "voucher", amount: 30000 }]))).toEqual({ total: 30000, prepayment: 0, redeemed: 30000 });
  });
});
