/**
 * R6.9 (рецензія №3, A В-3) – pokladna umí víc způsobů platby na jednu tržbu a vratka zrcadlí platby originálu.
 * Typicky kadeřnictví: část dárkovým poukazem (neeviduje se), zbytek hotově (eviduje se).
 */
import { readFileSync } from "node:fs";
import { buildEetMessage, buildSale, evidencedAmounts, type Payment } from "@ez/fiscal-core";
import { describe, expect, it } from "vitest";
import { refundInput } from "@/lib/pos/sale-factory";
import { MAX_PAYMENTS, mirrorPayments, splitPayments } from "@/lib/pos/split-payment";
import type { LocalSale } from "@/lib/pos/types";

const base = () => ({ id: crypto.randomUUID(), deviceId: "d", registerId: "P1", unitId: "1", sequence: "S1", soldAt: "2027-01-15T10:30:00.000Z", vatPayer: false, mode: "test" as const });
const masaz = (price: number) => [{ name: "Masáž", qty: 1, unitPrice: price, vatRate: 21 }];
const celk = (payments: Payment[], lines = masaz(payments.reduce((s, p) => s + p.amount, 0))) =>
  buildEetMessage(buildSale({ ...base(), lines, payments }), { eic: "CZ00000019", messageUuid: crypto.randomUUID(), sentAt: new Date("2027-01-15T10:30:05Z"), firstAttempt: true, verifyOnly: false }).data.celk_trzba;
const local = (payments: Payment[], over: Partial<LocalSale> = {}): LocalSale =>
  ({
    ...base(),
    lines: masaz(payments.reduce((s, p) => s + p.amount, 0) - (over.tip ?? 0)),
    payments,
    discount: 0,
    tip: 0,
    refundOf: null,
    unitLabel: "x",
    staffId: null,
    staffName: null,
    approval: null,
    cashReceived: null,
    status: "confirmed",
    confirmationCode: null,
    error: null,
    syncedAt: null,
    createdAt: "",
    vat: null,
    subtotal: 0,
    total: 0,
    ...over,
  }) as unknown as LocalSale;

describe("R6.9 – split payment on the POS", () => {
  it("gate: 500 gift voucher + 300 cash → two payment rows, evidenced 300", () => {
    const payments = splitPayments([{ method: "gift_voucher", amount: 50000 }], "cash", 80000, 0);
    expect(payments).toEqual([
      { method: "gift_voucher", amount: 50000 },
      { method: "cash", amount: 30000 },
    ]);
    expect(evidencedAmounts(buildSale({ ...base(), lines: masaz(80000), payments })).total).toBe(30000);
  });

  it("gate: 300 voucher + 700 cash → celk_trzba 700.00", () => {
    expect(celk(splitPayments([{ method: "gift_voucher", amount: 30000 }], "cash", 100000, 0))).toBe("700.00");
  });

  it("the tip goes to the last (card) row; parts must be positive and below the total; at most 5 payments", () => {
    expect(splitPayments([{ method: "meal_voucher", amount: 20000 }], "card", 100000, 5000)).toEqual([
      { method: "meal_voucher", amount: 20000 },
      { method: "card", amount: 85000 },
    ]);
    expect(() => splitPayments([{ method: "gift_voucher", amount: 100000 }], "cash", 100000, 0)).toThrow();
    expect(() => splitPayments([{ method: "gift_voucher", amount: 0 }], "cash", 100000, 0)).toThrow();
    expect(() => splitPayments(Array.from({ length: MAX_PAYMENTS }, () => ({ method: "cash" as const, amount: 100 })), "card", 100000, 0)).toThrow();
  });
});

describe("R6.9 – refund mirrors the original payments", () => {
  it("gate S3: refund of 300 voucher + 700 cash → [voucher −300, cash −700], evidenced −700 (not −1 000)", () => {
    const inp = refundInput(local([{ method: "gift_voucher", amount: 30000 }, { method: "cash", amount: 70000 }]));
    expect(inp.payments).toEqual([
      { method: "gift_voucher", amount: -30000 },
      { method: "cash", amount: -70000 },
    ]);
    const refund = buildSale({ ...base(), id: crypto.randomUUID(), refundOf: crypto.randomUUID(), lines: inp.lines, payments: inp.payments });
    expect(evidencedAmounts(refund).total).toBe(-70000);
    expect(inp.total).toBe(-100000);
  });

  it("the tip is not refunded – it comes off the card row it belongs to", () => {
    const inp = refundInput(local([{ method: "cash", amount: 20000 }, { method: "card", amount: 90000 }], { tip: 10000 }));
    expect(inp.payments).toEqual([
      { method: "cash", amount: -20000 },
      { method: "card", amount: -80000 },
    ]);
  });

  it("mirrorPayments keeps proportions for a partial amount and sums exactly", () => {
    const out = mirrorPayments([{ method: "gift_voucher", amount: 30000 }, { method: "cash", amount: 70000 }], 0, -33333);
    expect(out.reduce((s, p) => s + p.amount, 0)).toBe(-33333);
    expect(out.map((p) => p.method)).toEqual(["gift_voucher", "cash"]);
  });
});

describe("R6.9 – the POS uses the split, not a single method", () => {
  it("PaymentSheet returns payments and pos-app stores them as they are", () => {
    const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
    expect(src("components/pos/payment-sheet.tsx")).toMatch(/splitPayments\(/);
    const app = src("components/pos/pos-app.tsx");
    expect(app).not.toMatch(/payments: \[\{ method: r\.method/);
    expect(app).not.toMatch(/payments\[0\]!\.amount/);
  });
});
