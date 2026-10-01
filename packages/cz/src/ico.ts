/**
 * IČO (identifikační číslo osoby) — 8 digits, the last one is a mod-11 check digit.
 * Older IČO may be stored without leading zeros, so we left-pad to 8.
 */

export function normalizeIco(input: string): string | null {
  const digits = input.replace(/\s+/g, "");
  if (!/^\d{1,8}$/.test(digits)) return null;
  return digits.padStart(8, "0");
}

export function icoCheckDigit(first7: string): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += Number(first7[i]) * (8 - i);
  }
  const remainder = sum % 11;
  if (remainder === 0) return 1;
  if (remainder === 1) return 0;
  return 11 - remainder;
}

export function isValidIco(input: string): boolean {
  const ico = normalizeIco(input);
  if (!ico || ico === "00000000") return false;
  return icoCheckDigit(ico.slice(0, 7)) === Number(ico[7]);
}

/** Parses a free-form list (newline, comma, semicolon or whitespace separated) into unique IČO. */
export function parseIcoList(text: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const token of text.split(/[\s,;]+/)) {
    const t = token.trim();
    if (!t) continue;
    const ico = normalizeIco(t);
    if (ico && isValidIco(ico)) valid.add(ico);
    else invalid.add(t);
  }
  return { valid: [...valid], invalid: [...invalid] };
}
