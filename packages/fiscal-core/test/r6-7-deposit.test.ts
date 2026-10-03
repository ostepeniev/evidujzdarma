/**
 * R6.7 (рецензія №3; seminář FS, slajd „Záloha a doplatek“) – záloha a doplatek jsou dvě běžné platby, nijak
 * provázané: žádné urceno_cerp_zuct ani cerp_zuct. Ty patří jen kreditu (nabití / čerpání).
 */
import { describe, expect, it } from "vitest";
import { buildEetMessage } from "../src/eet2/message.ts";
import { PAYMENT_LABEL, REDEEMED_METHODS, buildSale, type SaleInput } from "../src/sale.ts";

const base = (o: Partial<SaleInput>): SaleInput => ({
  id: crypto.randomUUID(),
  deviceId: "dev1",
  registerId: "P1",
  unitId: "303",
  sequence: `P1-${Math.floor(Math.random() * 1e6)}`,
  soldAt: "2027-01-15T10:30:00.000Z",
  lines: [],
  payments: [],
  vatPayer: false,
  mode: "test",
  ...o,
});
const data = (s: SaleInput) =>
  buildEetMessage(buildSale(s), { eic: "CZ00000019", messageUuid: crypto.randomUUID(), sentAt: new Date("2027-01-15T10:30:05Z"), firstAttempt: true, verifyOnly: false }).data;

describe("R6.7 – záloha and doplatek are ordinary payments", () => {
  it("gate: order 2 000 – záloha 500 cash and doplatek 1 500 card → two sales 500.00 and 1500.00, no urceno/cerp", () => {
    const zaloha = data(base({ lines: [{ name: "Záloha na zakázku", qty: 1, unitPrice: 50000, vatRate: 21 }], payments: [{ method: "cash", amount: 50000 }] }));
    const doplatek = data(base({ lines: [{ name: "Doplatek zakázky", qty: 1, unitPrice: 150000, vatRate: 21 }], payments: [{ method: "card", amount: 150000 }] }));
    expect(zaloha).toMatchObject({ celk_trzba: "500.00" });
    expect(doplatek).toMatchObject({ celk_trzba: "1500.00" });
    for (const d of [zaloha, doplatek]) {
      expect(d.urceno_cerp_zuct).toBeUndefined();
      expect(d.cerp_zuct).toBeUndefined();
    }
  });

  it("credit top-up 1 000 stays urceno_cerp_zuct 1000.00 (only credit uses these fields)", () => {
    const d = data(base({ lines: [{ name: "Nabití čipu", qty: 1, unitPrice: 100000, vatRate: 0, kind: "prepayment" }], payments: [{ method: "cash", amount: 100000 }] }));
    expect(d).toMatchObject({ celk_trzba: "1000.00", urceno_cerp_zuct: "1000.00" });
  });

  it("gate: no payment method that becomes cerp_zuct is labelled as a záloha", () => {
    for (const m of REDEEMED_METHODS) expect(PAYMENT_LABEL[m], m).not.toMatch(/z[aá]loh/i);
  });
});
