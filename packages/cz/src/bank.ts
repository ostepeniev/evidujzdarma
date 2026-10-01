/**
 * Czech bank account numbers ("předčíslí-číslo/kód banky") and IBAN conversion.
 * Checksums follow vyhláška ČNB č. 169/2011 Sb. (weights 6,3,7,9,10,5,8,4,2,1).
 */

const WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

function mod11Ok(digits: string): boolean {
  const padded = digits.padStart(10, "0");
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(padded[i]) * WEIGHTS[i]!;
  return sum % 11 === 0;
}

export interface CzAccount {
  prefix: string;
  number: string;
  bankCode: string;
}

export function parseCzAccount(input: string): CzAccount | null {
  const m = input.replace(/\s+/g, "").match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return null;
  const prefix = m[1] ?? "";
  const number = m[2]!;
  const bankCode = m[3]!;
  if (prefix && !mod11Ok(prefix)) return null;
  if (!mod11Ok(number)) return null;
  if (/^0+$/.test(number)) return null;
  return { prefix, number, bankCode };
}

function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  return remainder;
}

function ibanToNumeric(rearranged: string): string {
  return rearranged
    .toUpperCase()
    .split("")
    .map((c) => (c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c))
    .join("");
}

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith("CZ") && iban.length !== 24) return false;
  return mod97(ibanToNumeric(iban.slice(4) + iban.slice(0, 4))) === 1;
}

export function czAccountToIban(account: CzAccount): string {
  const bban = account.bankCode + account.prefix.padStart(6, "0") + account.number.padStart(10, "0");
  const check = 98 - mod97(ibanToNumeric(bban + "CZ00"));
  return `CZ${String(check).padStart(2, "0")}${bban}`;
}

/** Accepts either IBAN or Czech domestic account; returns IBAN or null. */
export function toIban(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z]{2}/.test(trimmed)) {
    const iban = normalizeIban(trimmed);
    return isValidIban(iban) ? iban : null;
  }
  const acc = parseCzAccount(trimmed);
  return acc ? czAccountToIban(acc) : null;
}

export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
