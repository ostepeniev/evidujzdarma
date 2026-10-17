/**
 * S3-POKLADNA: QR platba v pokladně (formát SPAYD / QR Platba ČBA, packages/cz/src/spayd.ts). Variabilní symbol musí být
 * pro každý doklad jiný, jinak platby v bance nejde spárovat s účtenkami. Čistá logika – testuje ji test/s3-pos.test.ts.
 */
import { buildSpayd } from "@ez/cz/spayd";

/**
 * Variabilní symbol z čísla dokladu (např. „P1-K7Q2-000123“ → „172000123“): pořadí dokladu na zařízení (číslice na konci)
 * a před ním nejvýš 4 číslice z prefixu zařízení. Prefix je pro zařízení stálý, pořadí se nikdy neopakuje → VS je na zařízení
 * jednoznačný. Celé číslo dokladu jde navíc do zprávy pro příjemce. Nejvýš 10 číslic (X-VS ve SPAYD).
 */
export function qrVariableSymbol(sequence: string): string {
  const m = /^(.*?)(\d+)$/.exec(sequence.trim());
  const counter = m ? m[2]!.replace(/^0+(?=\d{6})/, "") : sequence.replace(/\D/g, "");
  const tag = m ? m[1]!.replace(/\D/g, "").slice(-4) : "";
  return (tag + counter).slice(-10) || "0";
}

/** Zpráva pro příjemce: nejdřív číslo dokladu (nesmí se oříznout), pak název firmy; SPAYD MSG má nejvýš 60 znaků. */
export function qrPaymentMessage(sequence: string, merchantName: string): string {
  return `${sequence} ${merchantName}`.trim().slice(0, 60);
}

/** Obsah QR kódu pro platbu dokladu (částka v haléřích). */
export function posQrPayload(o: { iban: string; amount: number; sequence: string; merchantName: string }): string {
  return buildSpayd({ account: o.iban, amount: o.amount / 100, message: qrPaymentMessage(o.sequence, o.merchantName), variableSymbol: qrVariableSymbol(o.sequence) });
}
