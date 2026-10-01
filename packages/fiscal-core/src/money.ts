/**
 * Peníze držíme vždy v haléřích (celá čísla), aby nevznikaly chyby plovoucí čárky.
 */

export type Halere = number;

/** Sazby DPH platné od 1. 1. 2024 (zákon č. 235/2004 Sb., ve znění konsolidačního balíčku). */
export const VAT_RATES = [21, 12, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

export function toHalere(czk: number | string): Halere {
  const n = typeof czk === "string" ? Number(czk.replace(/\s+/g, "").replace(",", ".")) : czk;
  if (!Number.isFinite(n)) throw new RangeError(`Neplatná částka: ${czk}`);
  return Math.round(n * 100);
}

export function fromHalere(h: Halere): number {
  return h / 100;
}

const czFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCzk(h: Halere): string {
  return czFormatter.format(h / 100);
}

/** "1234.50" — formát pro zprávy a exporty */
export function decimalString(h: Halere): string {
  const sign = h < 0 ? "-" : "";
  const abs = Math.abs(h);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Rozpad ceny vč. DPH na základ a daň (koeficientová metoda není od 2019 povinná;
 * počítáme daň shora: daň = cena × sazba / (100 + sazba), zaokrouhleno na haléře).
 */
export function splitGross(gross: Halere, rate: number): { base: Halere; vat: Halere } {
  if (rate === 0) return { base: gross, vat: 0 };
  const vat = Math.round((gross * rate) / (100 + rate));
  return { base: gross - vat, vat };
}

export interface LineLike {
  qty: number;
  unitPrice: Halere;
  vatRate: number;
}

export function lineTotal(line: LineLike): Halere {
  return Math.round(line.qty * line.unitPrice);
}

export function vatBreakdown(lines: readonly LineLike[]): Record<string, { base: Halere; vat: Halere }> {
  const grossByRate = new Map<number, Halere>();
  for (const l of lines) grossByRate.set(l.vatRate, (grossByRate.get(l.vatRate) ?? 0) + lineTotal(l));
  const out: Record<string, { base: Halere; vat: Halere }> = {};
  for (const [rate, gross] of [...grossByRate.entries()].sort((a, b) => b[0] - a[0])) {
    out[String(rate)] = splitGross(gross, rate);
  }
  return out;
}

/** Zaokrouhlení hotovosti na celé koruny (haléřové mince neexistují). */
export function roundCash(h: Halere): Halere {
  return Math.round(h / 100) * 100;
}
