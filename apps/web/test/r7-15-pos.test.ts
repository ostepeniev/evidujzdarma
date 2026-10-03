/**
 * R7.15 (рецензія №4, A Дрібне) – pokladna:
 *  - N6: vrátit po rozdělené platbě = přijatá hotovost − poslední (hotovostní) část, ne − celá tržba; na displeji i na dokladu;
 *  - N9: po 30. dni zrušeného účtu pokladna ukáže text serveru („Účet je zrušený a pokladna je odpojená“), ne „zaregistrujte znovu“.
 */
import { readFileSync } from "node:fs";
import { buildSale, cashChange, renderReceiptText } from "@ez/fiscal-core";
import { describe, expect, it } from "vitest";
import { revokedNotice } from "@/lib/pos/revoked";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

function splitSale() {
  return buildSale({
    id: "00000000-0000-4000-8000-000000000001",
    deviceId: "d",
    registerId: "P1",
    unitId: "303",
    sequence: "P1-000001",
    soldAt: "2026-10-20T10:00:00+02:00",
    lines: [{ name: "Střih", qty: 1, unitPrice: 100000, vatRate: 21 }],
    payments: [
      { method: "gift_voucher", amount: 50000 },
      { method: "cash", amount: 50000 },
    ],
    vatPayer: false,
    mode: "test",
  });
}

describe("R7.15 – rest of A (register)", () => {
  it("gate N6: change after a split payment comes from the last cash part – screen and receipt text", () => {
    const sale = splitSale();
    expect(cashChange(sale.payments, 200000)).toBe(150000);
    const text = renderReceiptText({
      merchant: { name: "Salon", dic: null, ico: "12345679", address: null, unitLabel: "Salon" },
      sale,
      fiscal: { confirmationCode: null, securityCode: null, mode: "test" },
      cashReceived: 200000,
    });
    const vraceno = text.split("\n").find((l) => l.includes("Vráceno"));
    expect(vraceno?.replace(/\s+/g, " ")).toMatch(/Vráceno 1 500,00 Kč/);
    // displej pokladny počítá stejně
    expect(src("components/pos/receipt-view.tsx")).toMatch(/cashChange\(sale\.payments, sale\.cashReceived\)/);
  });

  it("gate N6: the customer gives exactly the cash part → no change, no 'Vráceno' line", () => {
    const sale = splitSale();
    expect(cashChange(sale.payments, 50000)).toBe(0);
    const text = renderReceiptText({
      merchant: { name: "Salon", dic: null, ico: "12345679", address: null, unitLabel: "Salon" },
      sale,
      fiscal: { confirmationCode: null, securityCode: null, mode: "test" },
      cashReceived: 50000,
    });
    expect(text).not.toMatch(/Vráceno/);
  });

  it("control N6: a single cash payment keeps the old result", () => {
    expect(cashChange([{ method: "cash", amount: 35000 }], 50000)).toBe(15000);
    expect(cashChange([{ method: "card", amount: 35000 }], 50000)).toBe(0);
    expect(cashChange([{ method: "cash", amount: 35000 }], null)).toBe(0);
  });

  it("gate N9: a closed account after day 30 → the server text, no 'register again'", () => {
    const closed = revokedNotice("Účet je zrušený a pokladna je odpojená.");
    expect(closed.text).toMatch(/Účet je zrušený a pokladna je odpojená/);
    expect(closed.text).not.toMatch(/zaregistrujte/);
    expect(closed.canRegister).toBe(false);
    const revoked = revokedNotice("Zařízení není registrované nebo bylo odpojeno");
    expect(revoked.text).toBe("Vlastník účtu zařízení odpojil v nastavení. Přihlaste se a zaregistrujte ho znovu.");
    expect(revoked.canRegister).toBe(true);
    const app = src("components/pos/pos-app.tsx");
    expect(app).toMatch(/revokedNotice\(/);
    expect(app).not.toMatch(/"Vlastník účtu zařízení odpojil v nastavení\. Přihlaste se a zaregistrujte ho znovu\."/);
  });
});
