/**
 * S2 B1 (17. 10. 2026): rozbory pro bezplatné nástroje ověření IČO, IBAN a převodu účtu na IBAN. Čisté funkce,
 * vše běží v prohlížeči – IČO, DIČ ani číslo účtu se nikam neodesílají.
 */
import { bankByCode, type BankInfo } from "@ez/cz/bank-codes";
import { czAccountToIban, czIbanToAccount, formatCzAccount, formatIban, ibanChecksumOk, isValidCzAccountPart, normalizeIban, type CzAccount } from "@ez/cz/bank";
import { icoCheckDigit } from "@ez/cz/ico";

// ---------- IČO ----------

export type IcoCheck =
  | { ok: false; error: "empty" | "format" | "zeros" }
  | {
      ok: boolean;
      ico: string;
      /** součiny prvních sedmi číslic a vah 8…2 */
      products: { digit: number; weight: number; product: number }[];
      sum: number;
      remainder: number;
      expected: number;
      actual: number;
      /** IČO bylo zadáno s méně než 8 číslicemi a doplnili jsme nuly zleva */
      padded: boolean;
    };

/** Kontrola IČO s rozpisem výpočtu kontrolní číslice (váhy 8 až 2, modulo 11). */
export function checkIco(input: string): IcoCheck {
  const digits = input.replace(/\s+/g, "");
  if (!digits) return { ok: false, error: "empty" };
  if (!/^\d{1,8}$/.test(digits)) return { ok: false, error: "format" };
  const ico = digits.padStart(8, "0");
  if (ico === "00000000") return { ok: false, error: "zeros" };
  const products = [...ico.slice(0, 7)].map((d, i) => ({ digit: Number(d), weight: 8 - i, product: Number(d) * (8 - i) }));
  const sum = products.reduce((s, p) => s + p.product, 0);
  const expected = icoCheckDigit(ico.slice(0, 7));
  const actual = Number(ico[7]);
  return { ok: expected === actual, ico, products, sum, remainder: sum % 11, expected, actual, padded: digits.length < 8 };
}

/** Odkaz na kontrolu EET podle IČO – IČO ve fragmentu, ne v query (roboti nesmí procházet nekonečno URL). */
export const icoCheckHref = (ico: string) => `/kontrola-ico#ico=${ico}`;

// ---------- IBAN ----------

export type IbanCheck =
  | { ok: false; error: "empty" | "format" | "checksum" | "cz-length"; normalized: string }
  | {
      ok: true;
      iban: string;
      formatted: string;
      country: string;
      /** jen u českého IBAN */
      cz: { account: string; bank: BankInfo | null; bankCode: string; partsOk: boolean } | null;
    };

/** IBAN libovolné země: tvar a kontrolní číslice (modulo 97, ISO 13616); u CZ i tuzemský účet a banka podle číselníku ČNB. */
export function checkIban(input: string): IbanCheck {
  const normalized = normalizeIban(input).replace(/-/g, "");
  if (!normalized) return { ok: false, error: "empty", normalized };
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalized)) return { ok: false, error: "format", normalized };
  if (normalized.startsWith("CZ") && normalized.length !== 24) return { ok: false, error: "cz-length", normalized };
  if (normalized.startsWith("CZ") && !/^CZ\d{22}$/.test(normalized)) return { ok: false, error: "format", normalized };
  if (!ibanChecksumOk(normalized)) return { ok: false, error: "checksum", normalized };
  let cz: Extract<IbanCheck, { ok: true }>["cz"] = null;
  if (normalized.startsWith("CZ")) {
    const acc = czIbanToAccount(normalized);
    if (acc) cz = { account: formatCzAccount(acc), bank: bankByCode(acc.bankCode), bankCode: acc.bankCode, partsOk: acc.partsOk };
  }
  return { ok: true, iban: normalized, formatted: formatIban(normalized), country: normalized.slice(0, 2), cz };
}

// ---------- tuzemský účet → IBAN ----------

export type AccountCheck =
  | { ok: false; error: "empty" | "format" | "prefix" | "number" | "zeros" }
  | { ok: true; account: CzAccount; formattedAccount: string; iban: string; formatted: string; bank: BankInfo | null };

/** „19-2000145399/0800“ → IBAN, s rozlišením chyby (tvar, předčíslí, číslo účtu). */
export function accountToIban(input: string): AccountCheck {
  const s = input.replace(/\s+/g, "");
  if (!s) return { ok: false, error: "empty" };
  const m = /^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/.exec(s);
  if (!m) return { ok: false, error: "format" };
  const prefix = (m[1] ?? "").replace(/^0+/, "");
  const number = m[2]!.replace(/^0+/, "");
  const bankCode = m[3]!;
  if (!number) return { ok: false, error: "zeros" };
  if (prefix && !isValidCzAccountPart(prefix)) return { ok: false, error: "prefix" };
  if (!isValidCzAccountPart(number)) return { ok: false, error: "number" };
  const account = { prefix, number, bankCode };
  const iban = czAccountToIban(account);
  return { ok: true, account, formattedAccount: formatCzAccount(account), iban, formatted: formatIban(iban), bank: bankByCode(bankCode) };
}

// ---------- fragment adresy ----------

/** Hodnota z fragmentu `#a=1&b=2` (odkazy mezi nástroji nesou data ve fragmentu, ne v query – COMMON 9). */
export function fragmentParam(hash: string, key: string): string | null {
  for (const part of hash.replace(/^#/, "").split("&")) {
    const [k, v] = part.split("=");
    if (k === key && v !== undefined) {
      try {
        return decodeURIComponent(v);
      } catch {
        return null;
      }
    }
  }
  return null;
}
