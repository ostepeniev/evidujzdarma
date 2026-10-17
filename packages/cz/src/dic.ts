/**
 * České DIČ – jen kontrola tvaru, nic se nikam neposílá (DIČ fyzické osoby obvykle obsahuje rodné číslo).
 *
 * § 130 daňového řádu (zákon č. 280/2009 Sb., znění k 1. 1. 2026): DIČ = kód „CZ“ + kmenová část, kterou tvoří obecný
 * identifikátor (u právnické osoby IČO, u fyzické osoby rodné číslo), nebo vlastní identifikátor správce daně.
 *  - IČO: 8 číslic, poslední je kontrolní (modulo 11, viz ico.ts).
 *  - Rodné číslo (§ 13 zákona č. 133/2000 Sb., o evidenci obyvatel): 10 číslic dělitelných 11; měsíc u žen + 50,
 *    v dodatečné sestavě + 20 (muži) / + 70 (ženy); narození před 1. 1. 1954 mají 9 číslic bez podmínky dělitelnosti.
 *  - Vlastní identifikátor (VČP): podle Finanční správy (informace č. 76/26, 2026) automaticky generované devítimístné
 *    číslo začínající číslicí 6 s kontrolní číslicí na konci; konstrukce kontrolní číslice zveřejněna není.
 */
import { isValidIco } from "./ico.ts";

export type DicKind = "legal" | "natural" | "vcp";

export type DicError =
  | "empty"
  | "foreign"
  | "format"
  | "ico-checksum"
  | "rc-date"
  | "rc-checksum"
  | "rc-9-digits";

export type DicResult =
  | {
      ok: true;
      /** normalizované DIČ, např. „CZ12345679“ */
      dic: string;
      kind: DicKind;
      /** rodné číslo nesplňuje dělitelnost 11, ale odpovídá starší výjimce (zbytek 10, kontrolní číslice 0) */
      rcException?: boolean;
    }
  | { ok: false; dic: string | null; error: DicError; country?: string };

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Měsíc z rodného čísla bez příznaků (+50 / +20 / +70), nebo null. */
function rcMonth(mm: number): number | null {
  for (const add of [0, 50, 20, 70]) {
    const m = mm - add;
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}

export type RodneCisloCheck = { ok: true; exception?: boolean } | { ok: false; error: "rc-date" | "rc-checksum" | "rc-9-digits" | "format" };

/** Kontrola tvaru rodného čísla (9 nebo 10 číslic, bez lomítka) podle § 13 zákona č. 133/2000 Sb. */
export function checkRodneCislo(digits: string, today: Date = new Date()): RodneCisloCheck {
  if (!/^\d{9,10}$/.test(digits)) return { ok: false, error: "format" };
  const yy = Number(digits.slice(0, 2));
  const month = rcMonth(Number(digits.slice(2, 4)));
  const day = Number(digits.slice(4, 6));
  let year: number;
  if (digits.length === 9) {
    // devítimístná čísla jen pro narozené před 1. 1. 1954
    if (yy >= 54) return { ok: false, error: "rc-9-digits" };
    year = 1900 + yy;
  } else {
    year = yy >= 54 ? 1900 + yy : 2000 + yy;
  }
  if (!month || day < 1 || day > daysInMonth(year, month)) return { ok: false, error: "rc-date" };
  // datum narození v budoucnu (např. „30“ jako rok 2030) rodným číslem být nemůže
  if (Date.UTC(year, month - 1, day) > today.getTime()) return { ok: false, error: "rc-date" };
  if (digits.length === 9) {
    // třímístná koncovka 000 se nepřidělovala (MV ČR: koncovky 001 až 999)
    if (digits.endsWith("000")) return { ok: false, error: "rc-date" };
    return { ok: true };
  }
  if (Number(BigInt(digits) % 11n) === 0) return { ok: true };
  // starší výjimka: zbytek prvních devíti číslic po dělení 11 je 10 a kontrolní číslice je 0 (narození 1954–1985)
  const rest = Number(BigInt(digits.slice(0, 9)) % 11n);
  if (rest === 10 && digits[9] === "0" && year <= 1985) return { ok: true, exception: true };
  return { ok: false, error: "rc-checksum" };
}

/** Rozbor českého DIČ: „CZ12345679“, „cz 12345679“, i bez „CZ“. */
export function analyzeDic(input: string, today: Date = new Date()): DicResult {
  const raw = input.replace(/[\s/.-]+/g, "").toUpperCase();
  if (!raw) return { ok: false, dic: null, error: "empty" };
  const prefix = /^([A-Z]{2})/.exec(raw)?.[1];
  if (prefix && prefix !== "CZ") return { ok: false, dic: null, error: "foreign", country: prefix };
  const core = prefix ? raw.slice(2) : raw;
  if (!/^\d{8,10}$/.test(core)) return { ok: false, dic: null, error: "format" };
  const dic = `CZ${core}`;
  if (core.length === 8) return isValidIco(core) ? { ok: true, dic, kind: "legal" } : { ok: false, dic, error: "ico-checksum" };
  if (core.length === 9 && core.startsWith("6")) return { ok: true, dic, kind: "vcp" };
  const rc = checkRodneCislo(core, today);
  if (!rc.ok) return { ok: false, dic, error: rc.error === "format" ? "format" : rc.error };
  return rc.exception ? { ok: true, dic, kind: "natural", rcException: true } : { ok: true, dic, kind: "natural" };
}
