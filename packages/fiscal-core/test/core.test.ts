import { describe, expect, it } from "vitest";
import { buildSale, formatSequence, refundLinesFrom, SaleValidationError, type SaleInput } from "../src/sale.ts";
import { decimalString, formatCzk, roundCash, splitGross, toHalere, vatBreakdown } from "../src/money.ts";
import { deadlineFor, isRetryable, retryDelaySeconds, urgency } from "../src/queue.ts";
import { renderReceiptText } from "../src/receipt.ts";
import { MockTransport } from "../src/transport.ts";
import { decryptSecret, encryptSecret, LocalKeyEncryptor } from "../src/envelope.ts";
import { createTestP12, parseP12, CertificateError } from "../src/p12.ts";
import { PemSigner, sha1Blocks, verifySignature } from "../src/signer.ts";

const base: SaleInput = {
  id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
  deviceId: "dev1",
  registerId: "P1",
  unitId: "EJ-1",
  sequence: formatSequence("P1-", 1),
  soldAt: "2027-01-15T10:30:00.000Z",
  lines: [
    { name: "Střih pánský", qty: 1, unitPrice: 35000, vatRate: 21 },
    { name: "Šampon", qty: 2, unitPrice: 12050, vatRate: 21 },
  ],
  payments: [{ method: "cash", amount: 59100 }],
  vatPayer: true,
  mode: "test",
};

describe("money", () => {
  it("converts and formats", () => {
    expect(toHalere("1 234,50")).toBe(123450);
    expect(decimalString(-5)).toBe("-0.05");
    expect(decimalString(123450)).toBe("1234.50");
    expect(formatCzk(123450).replace(/\s/g, " ")).toBe("1 234,50 Kč");
    expect(roundCash(12349)).toBe(12300);
    expect(roundCash(12350)).toBe(12400);
  });
  it("splits VAT from gross", () => {
    expect(splitGross(12100, 21)).toEqual({ base: 10000, vat: 2100 });
    expect(splitGross(11200, 12)).toEqual({ base: 10000, vat: 1200 });
    expect(vatBreakdown([{ qty: 1, unitPrice: 12100, vatRate: 21 }, { qty: 1, unitPrice: 500, vatRate: 0 }])).toEqual({
      "21": { base: 10000, vat: 2100 },
      "0": { base: 500, vat: 0 },
    });
  });
});

describe("sale", () => {
  it("builds totals", () => {
    const s = buildSale(base);
    expect(s.subtotal).toBe(59100);
    expect(s.total).toBe(59100);
    expect(s.vat?.["21"]).toEqual(splitGross(59100, 21));
  });
  it("applies discount and tip", () => {
    const s = buildSale({ ...base, discount: 9100, tip: 5000, payments: [{ method: "card", amount: 55000 }] });
    expect(s.subtotal).toBe(50000);
    expect(s.total).toBe(55000);
    expect(s.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0)).toBe(50000);
  });
  it("rejects mismatched payments", () => {
    expect(() => buildSale({ ...base, payments: [{ method: "cash", amount: 100 }] })).toThrow(SaleValidationError);
  });
  it("requires refund reference", () => {
    const lines = refundLinesFrom(buildSale(base));
    expect(() => buildSale({ ...base, lines, payments: [{ method: "cash", amount: -59100 }] })).toThrow(/vratka/);
    const r = buildSale({ ...base, lines, refundOf: base.id, payments: [{ method: "cash", amount: -59100 }] });
    expect(r.total).toBe(-59100);
  });
  it("formats sequence", () => {
    expect(formatSequence("P1-", 42)).toBe("P1-000042");
    expect(() => formatSequence("ž", 1)).toThrow();
  });
});

describe("queue", () => {
  it("computes 48h deadline and urgency", () => {
    const d = deadlineFor("2027-01-15T10:00:00Z");
    expect(d.toISOString()).toBe("2027-01-17T10:00:00.000Z");
    expect(urgency(d, new Date("2027-01-16T10:00:00Z"))).toBe("ok");
    expect(urgency(d, new Date("2027-01-17T00:00:00Z"))).toBe("soon");
    expect(urgency(d, new Date("2027-01-17T09:00:00Z"))).toBe("critical");
    expect(urgency(d, new Date("2027-01-17T11:00:00Z"))).toBe("overdue");
  });
  it("backs off and classifies errors", () => {
    expect(retryDelaySeconds(0)).toBe(0);
    expect(retryDelaySeconds(100)).toBe(900);
    expect(isRetryable({ status: 503 })).toBe(true);
    expect(isRetryable({ status: 400 })).toBe(false);
    expect(isRetryable({ code: "ECONNRESET" })).toBe(true);
  });
});

describe("receipt", () => {
  it("renders text receipt", () => {
    const sale = buildSale(base);
    const text = renderReceiptText({
      merchant: { name: "Kadeřnictví Šárka", dic: "CZ7501011234", ico: "12345678", address: "Masarykova 1, Karlovy Vary", unitLabel: "Salon" },
      sale,
      fiscal: { confirmationCode: "ABC-123", securityCode: null, mode: "test" },
      cashReceived: 60000,
    });
    expect(text).toContain("CELKEM");
    expect(text).toContain("Vráceno");
    expect(text).toContain("POK:");
    expect(text).toContain("TESTOVACÍ REŽIM");
    for (const line of text.split("\n")) expect(line.length).toBeLessThanOrEqual(42);
  });
});

describe("mock transport", () => {
  it("returns deterministic confirmation", async () => {
    const t = new MockTransport();
    const sale = buildSale(base);
    const a = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "CZ12345678" });
    const b = await t.send(sale, { firstAttempt: false, verifyOnly: false, eic: "CZ12345678" });
    expect(a.ok && b.ok && a.confirmationCode === b.confirmationCode).toBe(true);
    const bad = await t.send(sale, { firstAttempt: true, verifyOnly: false, eic: "123" });
    expect(bad.ok).toBe(false);
  });
});

describe("envelope encryption", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  it("round-trips and binds context", async () => {
    const enc = new LocalKeyEncryptor({ v1: key }, "v1");
    const sealed = await encryptSecret(enc, Buffer.from("tajný klíč"), "account-1");
    expect((await decryptSecret(enc, sealed, "account-1")).toString()).toBe("tajný klíč");
    await expect(decryptSecret(enc, sealed, "account-2")).rejects.toThrow();
  });
  it("supports key rotation", async () => {
    const key2 = Buffer.alloc(32, 9).toString("base64");
    const old = new LocalKeyEncryptor({ v1: key }, "v1");
    const sealed = await encryptSecret(old, Buffer.from("x"), "a");
    const rotated = new LocalKeyEncryptor({ v1: key, v2: key2 }, "v2");
    expect((await decryptSecret(rotated, sealed, "a")).toString()).toBe("x");
  });
});

describe("certificates and signing", () => {
  it("parses p12 and signs", () => {
    const p12 = createTestP12({ commonName: "CZ12345678", password: "heslo" });
    const cert = parseP12(p12, "heslo");
    expect(cert.info.dic).toBe("CZ12345678");
    expect(cert.info.validTo.getTime()).toBeGreaterThan(Date.now());
    const signer = new PemSigner(cert.privateKeyPem, cert.certificatePem);
    const sig = signer.sign("CZ12345678|EJ-1|P1|P1-000001|2027-01-15T11:30:00+01:00|591.00");
    expect(verifySignature("CZ12345678|EJ-1|P1|P1-000001|2027-01-15T11:30:00+01:00|591.00", sig, cert.certificatePem)).toBe(true);
    expect(sha1Blocks(sig)).toMatch(/^[0-9A-F]{8}(-[0-9A-F]{8}){4}$/);
    expect(() => parseP12(p12, "spatne")).toThrow(CertificateError);
  });
});

describe("discount keeps line kind (R1.6, A В3)", () => {
  it("a prepayment line with qty ≠ 1 stays a prepayment after the discount", () => {
    const s = buildSale({
      ...base,
      lines: [{ name: "Dárkový poukaz", qty: 2, unitPrice: 50000, vatRate: 0, kind: "prepayment" }],
      discount: 10000,
      payments: [{ method: "cash", amount: 90000 }],
      vatPayer: false,
    });
    expect(s.lines[0]!.kind).toBe("prepayment");
  });
});
