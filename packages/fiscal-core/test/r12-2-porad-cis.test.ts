/**
 * R12.2 (рецензія №9) – eet.gov.cz „Pro vývojáře“ (8. 10. 2026) opravila v anglickém popisu rozhraní délku porad_cis
 * na 1–25 znaků. Máme 25 na obou místech v jádře – SEQUENCE_RE (sale.ts, buildSale) a string25 (eet2/message.ts,
 * validateEetMessage); test hlídá hranici 25/26 a prázdnou hodnotu. Příjem tržby z pokladny (zod, web) hlídá
 * apps/web/test/r12-2-sequence-ingest.test.ts.
 */
import { describe, expect, it } from "vitest";
import { buildEetMessage, validateEetMessage } from "../src/eet2/message.ts";
import { SEQUENCE_RE, buildSale, type SaleInput } from "../src/sale.ts";

const base: SaleInput = {
  id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
  deviceId: "dev1",
  registerId: "P1",
  unitId: "303",
  sequence: "P1-000001",
  soldAt: "2027-01-15T10:30:00.123Z",
  lines: [{ name: "Střih", qty: 1, unitPrice: 50000, vatRate: 21 }],
  payments: [{ method: "cash", amount: 50000 }],
  discount: 0,
  tip: 0,
  refundOf: null,
} as SaleInput;

const S25 = "P1-" + "0".repeat(22);
const S26 = `${S25}1`;
const message = (sequence: string) =>
  buildEetMessage(buildSale({ ...base, sequence }), {
    eic: "CZ00000019",
    messageUuid: "6a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    sentAt: new Date("2027-01-15T10:30:05Z"),
    firstAttempt: true,
    verifyOnly: false,
  });
/** porad_cis přímo v datové zprávě – kontrola zprávy nesmí spoléhat na to, že ji hlídá už buildSale */
const issuesFor = (porad_cis: string) => {
  const m = message("P1-000001");
  return validateEetMessage({ ...m, data: { ...m.data, porad_cis } }).filter((i) => i.startsWith("porad_cis"));
};

describe("R12.2 – porad_cis length 1–25", () => {
  it("gate: the sale (SEQUENCE_RE, buildSale) takes 25 characters, refuses 26 and an empty one", () => {
    expect(S25).toHaveLength(25);
    expect(SEQUENCE_RE.test(S25)).toBe(true);
    expect(SEQUENCE_RE.test(S26)).toBe(false);
    expect(SEQUENCE_RE.test("")).toBe(false);
    expect(message(S25).data.porad_cis).toBe(S25);
    expect(() => message(S26)).toThrow(/pořadové číslo/);
  });

  it("gate: the data message (validateEetMessage) takes 25 and 1 characters, refuses 26 and an empty one", () => {
    expect(issuesFor(S25)).toEqual([]);
    expect(issuesFor("1")).toEqual([]);
    expect(issuesFor(S26)).toEqual(["porad_cis (max. 25 znaků)"]);
    expect(issuesFor("")).toEqual(["porad_cis (max. 25 znaků)"]);
  });
});
