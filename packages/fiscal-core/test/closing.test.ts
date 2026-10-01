import { describe, expect, it } from "vitest";
import { computeClosing, ClosingValidationError, renderClosingText, sumDenominations, type ClosingSale } from "../src/closing.ts";
import { renderReceiptText } from "../src/receipt.ts";
import { buildSale, formatSequence } from "../src/sale.ts";

const sale = (n: number, at: string, payments: ClosingSale["payments"], extra: Partial<ClosingSale> = {}): ClosingSale => ({
  id: `s${n}`,
  sequence: `P1-${String(n).padStart(6, "0")}`,
  soldAt: at,
  payments,
  tip: 0,
  discount: 0,
  total: payments.reduce((a, p) => a + p.amount, 0),
  refundOf: null,
  fiscal: "confirmed",
  ...extra,
});

const day = [
  sale(1, "2027-01-15T07:59:00Z", [{ method: "cash", amount: 99900 }]), // před obdobím
  sale(2, "2027-01-15T08:10:00Z", [{ method: "cash", amount: 35000 }], { tip: 5000 }),
  sale(3, "2027-01-15T09:00:00Z", [{ method: "card", amount: 120000 }], { fiscal: "pending" }),
  sale(4, "2027-01-15T10:00:00Z", [{ method: "transfer", amount: 50000 }], { fiscal: "not_required" }),
  sale(5, "2027-01-15T11:00:00Z", [{ method: "cash", amount: -10000 }], { refundOf: "s2" }),
  sale(6, "2027-01-15T12:00:00Z", [{ method: "qr", amount: 20000 }], { fiscal: "rejected", discount: 2000 }),
];
const movements = [
  { id: "m1", at: "2027-01-15T08:00:30Z", type: "deposit" as const, amount: 50000, note: "Drobné" },
  { id: "m2", at: "2027-01-15T13:00:00Z", type: "withdrawal" as const, amount: 20000 },
  { id: "m3", at: "2027-01-15T19:00:00Z", type: "withdrawal" as const, amount: 99999 }, // po uzávěrce
];

describe("closing", () => {
  const input = {
    periodFrom: "2027-01-15T08:00:00Z",
    closedAt: "2027-01-15T18:00:00Z",
    openingCash: 200000,
    sales: day,
    movements,
    countedCash: 250000,
    cashOut: 150000,
  };

  it("computes totals and expected cash for the period only", () => {
    const t = computeClosing(input);
    expect(t.salesCount).toBe(4);
    expect(t.refundsCount).toBe(1);
    expect(t.refundsTotal).toBe(-10000);
    expect(t.byMethod).toEqual({ cash: 25000, card: 120000, qr: 20000, transfer: 50000, voucher: 0 });
    expect(t.gross).toBe(215000);
    expect(t.evidencedTotal).toBe(165000);
    expect(t.notEvidencedTotal).toBe(50000);
    expect(t.tips).toBe(5000);
    expect(t.discounts).toBe(2000);
    // 2000 + 250 (hotově) + 500 (vklad) − 200 (výběr) = 2550 Kč
    expect(t.expectedCash).toBe(255000);
    expect(t.difference).toBe(-5000);
    expect(t.closingCash).toBe(100000);
    expect(t.pending).toBe(1);
    expect(t.rejected).toBe(1);
    expect(t.firstSequence).toBe("P1-000002");
    expect(t.lastSequence).toBe("P1-000006");
  });

  it("validates inputs", () => {
    expect(() => computeClosing({ ...input, cashOut: 300000 })).toThrow(ClosingValidationError);
    expect(() => computeClosing({ ...input, countedCash: -1 })).toThrow(ClosingValidationError);
    expect(() => computeClosing({ ...input, closedAt: "2027-01-15T07:00:00Z" })).toThrow(ClosingValidationError);
  });

  it("sums banknotes and coins", () => {
    expect(sumDenominations({ "1000": 2, "500": 1, "20": 3, "1": 4 })).toBe(256400);
    expect(() => sumDenominations({ "100": -1 })).toThrow(ClosingValidationError);
  });

  it("renders a Z-report that fits the paper width", () => {
    const totals = computeClosing(input);
    for (const width of [32, 42]) {
      const text = renderClosingText(
        {
          number: 3,
          merchantName: "Kadeřnictví Šárka s dlouhým názvem provozovny",
          registerId: "P1",
          unitLabel: "Salon",
          staffName: "Jana",
          periodFrom: input.periodFrom,
          closedAt: input.closedAt,
          totals,
          movements: movements.slice(0, 2),
          note: "Chyběla mince v kase, dohledáme zítra ráno při otevírání.",
          mode: "test",
        },
        width,
      );
      expect(text).toContain("DENNÍ UZÁVĚRKA č. 3");
      expect(text).toContain("MANKO");
      expect(text).toContain("Čeká na POK");
      for (const line of text.split("\n")) expect(line.length).toBeLessThanOrEqual(width);
    }
  });
});

describe("receipt POK toggle", () => {
  const s = buildSale({
    id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
    deviceId: "d",
    registerId: "P1",
    unitId: "1",
    sequence: formatSequence("P1-", 1),
    soldAt: "2027-01-15T10:30:00.000Z",
    lines: [{ name: "Káva", qty: 1, unitPrice: 6000, vatRate: 12 }],
    payments: [{ method: "cash", amount: 6000 }],
    vatPayer: false,
    mode: "production",
  });
  const merchant = { name: "Kavárna", dic: null, ico: "12345679", address: null, unitLabel: "Bar" };

  it("prints POK by default and hides it when disabled", () => {
    expect(renderReceiptText({ merchant, sale: s, fiscal: { confirmationCode: "abc-ff", securityCode: null, mode: "production" } })).toContain("POK:");
    const hidden = renderReceiptText({ merchant, sale: s, fiscal: { confirmationCode: "abc-ff", securityCode: null, mode: "production", showCode: false } });
    expect(hidden).not.toContain("POK");
    expect(hidden).not.toContain("abc-ff");
    const pending = renderReceiptText({ merchant, sale: s, fiscal: { confirmationCode: null, securityCode: "X1", mode: "production", showCode: false } });
    expect(pending).not.toContain("dodatečně");
  });
});
