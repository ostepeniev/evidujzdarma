import { isValidIco } from "@ez/cz/ico";

/** IČO z adresy (?ico=): jen přesně 8 číslic s platnou kontrolní číslicí, jinak null (R14.2, R18.1). */
export function icoParam(v: unknown): string | null {
  return typeof v === "string" && /^\d{8}$/.test(v) && isValidIco(v) ? v : null;
}
