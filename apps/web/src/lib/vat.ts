/**
 * S2 B1 (17. 10. 2026): výpočet DPH.
 *
 * Sazby: § 47 odst. 1 zákona č. 235/2004 Sb., o DPH (znění k 1. 1. 2026) – základní 21 %, snížená 12 %
 * (od 1. 1. 2024, zákon č. 349/2023 Sb.; tisková zpráva GFŘ z 12. 1. 2024).
 * Výpočet (§ 37): daň = a) základ × sazba, nebo b) „shora“ – cena s daní − cena s daní / 1,21 (1,12). Cena s daní se
 * bere bez částky vzniklé zaokrouhlením celkové úplaty na celé koruny (§ 36 odst. 5). Výpočet shora změnil zákon
 * č. 80/2019 Sb. – od 1. 10. 2019 dávají oba postupy stejný výsledek, bez rozdílů (Finanční správa, 14. 10. 2019).
 * Částky počítáme v haléřích celými čísly a zaokrouhlujeme na haléře (polovina nahoru); zákon způsob zaokrouhlení daně
 * na jednotlivém dokladu výslovně neuvádí.
 */

export const VAT_RATES = [21, 12] as const;
export type VatRate = (typeof VAT_RATES)[number];

export interface VatBreakdown {
  /** základ daně (Kč) */
  base: number;
  /** DPH (Kč) */
  vat: number;
  /** cena včetně DPH (Kč) */
  total: number;
  rate: VatRate;
}

const toHalere = (kc: number) => Math.round(kc * 100);
const fromHalere = (h: number) => h / 100;
/** Zaokrouhlení num/den na celé číslo, polovina od nuly; num i den celá čísla, den > 0. */
function divRound(num: number, den: number): number {
  const sign = num < 0 ? -1 : 1;
  return sign * Math.floor((2 * Math.abs(num) + den) / (2 * den));
}

/** Ze základu daně (§ 37 písm. a). */
export function vatFromBase(base: number, rate: VatRate): VatBreakdown {
  const b = toHalere(base);
  const v = divRound(b * rate, 100);
  return { base: fromHalere(b), vat: fromHalere(v), total: fromHalere(b + v), rate };
}

/** Z ceny včetně daně („shora“, § 37 písm. b): daň = cena − cena / (1 + sazba). */
export function vatFromTotal(total: number, rate: VatRate): VatBreakdown {
  const t = toHalere(total);
  const v = divRound(t * rate, 100 + rate);
  return { base: fromHalere(t - v), vat: fromHalere(v), total: fromHalere(t), rate };
}

/** Ze známé částky DPH – dopočet základu (orientační, výsledek může kvůli zaokrouhlení daně o haléř kolísat). */
export function vatFromVat(vat: number, rate: VatRate): VatBreakdown {
  const v = toHalere(vat);
  const b = divRound(v * 100, rate);
  return { base: fromHalere(b), vat: fromHalere(v), total: fromHalere(b + v), rate };
}

/**
 * Hotovost zaokrouhlená na celé koruny: kolik zákazník zaplatí a o kolik se částka změnila. Podle § 37 písm. b) bod 1
 * se daň počítá z ceny bez tohoto zaokrouhlení; v EET 2.0 se eviduje skutečně přijatá (zaokrouhlená) částka.
 */
export function cashRounding(total: number): { rounded: number; difference: number } {
  const t = toHalere(total);
  const rounded = divRound(t, 100) * 100;
  return { rounded: fromHalere(rounded), difference: fromHalere(rounded - t) };
}

/** Tržba rozdělená podle sazeb (např. denní tržba v gastronomii): rozpad každé části a součty. */
export function vatFromTakings(parts: readonly { total: number; rate: VatRate }[]): { rows: VatBreakdown[]; base: number; vat: number; total: number } {
  const rows = parts.filter((p) => p.total !== 0).map((p) => vatFromTotal(p.total, p.rate));
  const sum = (k: "base" | "vat" | "total") => fromHalere(rows.reduce((s, r) => s + toHalere(r[k]), 0));
  return { rows, base: sum("base"), vat: sum("vat"), total: sum("total") };
}
