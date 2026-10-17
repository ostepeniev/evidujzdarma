import { isValidIco } from "@ez/cz/ico";

/** IČO z adresy (?ico=): jen přesně 8 číslic s platnou kontrolní číslicí, jinak null (R14.2, R18.1). */
export function icoParam(v: unknown): string | null {
  return typeof v === "string" && /^\d{8}$/.test(v) && isValidIco(v) ? v : null;
}

/**
 * S2 B1: IČO z fragmentu adresy (`#ico=12345679`, i mezi dalšími parametry `#a=1&ico=…`). Fragment roboti neprocházejí,
 * proto ho používají odkazy z nástrojů (COMMON 9). Jen platné IČO, kratší doplníme nulami zleva; jinak null.
 */
export function icoFromHash(hash: string): string | null {
  const m = /(?:^#?|&)ico=(\d{1,8})(?:&|$)/.exec(hash);
  if (!m) return null;
  const ico = m[1]!.padStart(8, "0");
  return isValidIco(ico) ? ico : null;
}
