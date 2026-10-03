/**
 * R6.12 (рецензія №3, A Д-9) – EIČ pokladního certifikátu je jen celý CN ve tvaru ^CZ\d{8,10}$ (FS: CN = EIČ).
 * Ne serialNumber a ne kus delšího řetězce (CN „CZ12345678901“ nesmí dát „CZ1234567890“).
 */
import { describe, expect, it } from "vitest";
import { createTestP12, parseP12 } from "../src/p12.ts";

const dic = (commonName: string, subjectSerialNumber?: string) => parseP12(createTestP12({ commonName, password: "x", subjectSerialNumber }), "x").info.dic;

describe("R6.12 – EIČ only from the whole CN", () => {
  it("gate: CN with 11 digits → no EIČ (not a truncated one)", () => {
    expect(dic("CZ12345678901")).toBeNull();
  });

  it("gate: EIČ is not taken from serialNumber", () => {
    expect(dic("Pokladna 1", "CZ12345678")).toBeNull();
  });

  it("gate: CN with surrounding text → no EIČ", () => {
    expect(dic("x CZ12345678 y")).toBeNull();
  });

  it("control: CN = EIČ (8–10 digits)", () => {
    expect(dic("CZ00000019")).toBe("CZ00000019");
    expect(dic("CZ1234567890")).toBe("CZ1234567890");
  });
});
