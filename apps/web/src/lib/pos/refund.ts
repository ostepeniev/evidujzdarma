/**
 * S3-POKLADNA: částečné vratky a vratky dokladu z jiného zařízení. Čistá logika bez prohlížeče a bez serveru –
 * používá ji pokladna (výběr položek, platby vratky) i ingest na serveru (kontrola součtu vratek pod zámkem).
 *
 * Vratka je vždy záporná tržba s odkazem na původní (§ 8 zákona č. 180/2026 Sb. – záporná tržba). K jedné tržbě může
 * být víc vratek; dohromady nesmí vrátit víc kusů žádné položky, víc peněz, víc evidované částky ani víc čerpání
 * kreditu než původní tržba. Spropitné se nevrací (A Дрібне 17).
 */
import { lineTotal, type Payment, type SaleLine } from "@ez/fiscal-core";
import { REFUND_SWAPPABLE, mirrorPayments } from "./split-payment";

/** Tolerance při porovnání množství (množství může být desetinné, např. 0,5 kg). */
const EPS = 1e-6;

/** Položka vratky se páruje s položkou originálu podle názvu, jednotkové ceny, sazby DPH a druhu (nabití kreditu). */
export function lineKey(l: Pick<SaleLine, "name" | "unitPrice" | "vatRate" | "kind">): string {
  return JSON.stringify([l.name, l.unitPrice, l.vatRate, l.kind === "prepayment" ? "prepayment" : "goods"]);
}

export interface RefundableLine {
  /** index položky v původní tržbě */
  index: number;
  line: SaleLine;
  soldQty: number;
  refundedQty: number;
  remainingQty: number;
}

/**
 * Kolik z každé položky původní tržby ještě jde vrátit. `original` jsou položky PO slevě (jak je uložil server / buildSale),
 * `refunds` položky dřívějších vratek (záporné množství). Vratka položky, která v originálu není, se nezapočte – ingest ji odmítne.
 */
export function refundableLines(original: readonly SaleLine[], refunds: readonly { lines: readonly SaleLine[] }[]): RefundableLine[] {
  const rows = original.map((line, index) => ({ index, line, soldQty: line.qty, refundedQty: 0, remainingQty: line.qty }));
  for (const r of refunds) {
    for (const l of r.lines) {
      let qty = -l.qty;
      const key = lineKey(l);
      for (const row of rows) {
        if (qty <= EPS) break;
        if (lineKey(row.line) !== key || row.remainingQty <= EPS) continue;
        const take = Math.min(qty, row.remainingQty);
        row.refundedQty += take;
        row.remainingQty = round6(row.remainingQty - take);
        qty -= take;
      }
    }
  }
  return rows;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Položky vratky z výběru množství (index položky originálu → kolik kusů vrátit). Nulové výběry vynechá. */
export function refundLinesFor(rows: readonly RefundableLine[], selection: Readonly<Record<number, number>>): SaleLine[] {
  const out: SaleLine[] = [];
  for (const row of rows) {
    const qty = Math.min(selection[row.index] ?? 0, row.remainingQty);
    if (qty <= EPS) continue;
    out.push({ ...row.line, qty: -round6(qty) });
  }
  return out;
}

/** Celá zbývající část (tlačítko „Vrátit vše“). */
export function fullSelection(rows: readonly RefundableLine[]): Record<number, number> {
  return Object.fromEntries(rows.filter((r) => r.remainingQty > EPS).map((r) => [r.index, r.remainingQty]));
}

export function linesTotal(lines: readonly SaleLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

/**
 * Platby vratky (záporné): zrcadlí, čím zákazník platil, ale jen z toho, co ještě nebylo vráceno dřívějšími vratkami.
 * Poslední vratka tak vrátí přesně zbytek a součet vratek nikdy nepřesáhne evidovanou částku ani čerpání originálu (R6.9).
 * Hotovost, kartu, QR a stravenku mohla obsluha u dřívější vratky zaměnit – ty se počítají dohromady.
 */
export function refundPayments(
  original: { payments: readonly Payment[]; tip: number; subtotal: number },
  previous: readonly { payments: readonly Payment[] }[],
  refundTotal: number,
): Payment[] {
  const base = mirrorPayments([...original.payments], original.tip, original.subtotal);
  if (!previous.length) return mirrorPayments([...original.payments], original.tip, refundTotal);
  const refunded = new Map<string, number>();
  for (const r of previous) for (const p of r.payments) refunded.set(p.method, (refunded.get(p.method) ?? 0) - p.amount);
  let remaining: Payment[] = base.map((p) => ({ method: p.method, amount: p.amount - (refunded.get(p.method) ?? 0) }));
  // vrácené jiným zaměnitelným způsobem (karta → hotově) se odečte od společného „koše“ zaměnitelných způsobů
  const swapped = [...refunded.entries()].filter(([m]) => REFUND_SWAPPABLE.includes(m as never) && !base.some((b) => b.method === m)).reduce((s, [, a]) => s + a, 0);
  if (swapped || remaining.some((p) => p.amount < 0 && REFUND_SWAPPABLE.includes(p.method))) {
    const pool = remaining.filter((p) => REFUND_SWAPPABLE.includes(p.method)).reduce((s, p) => s + p.amount, 0) - swapped;
    const first = remaining.find((p) => REFUND_SWAPPABLE.includes(p.method));
    remaining = [...(first && pool > 0 ? [{ method: first.method, amount: pool }] : []), ...remaining.filter((p) => !REFUND_SWAPPABLE.includes(p.method))];
  }
  remaining = remaining.filter((p) => p.amount > 0);
  const left = remaining.reduce((s, p) => s + p.amount, 0);
  if (left <= 0) return mirrorPayments([...original.payments], original.tip, refundTotal);
  if (-refundTotal >= left) {
    // poslední vratka vrátí přesně zbytek každého způsobu platby
    const out = remaining.map((p) => ({ method: p.method, amount: -p.amount }));
    out[out.length - 1]!.amount += refundTotal + left;
    return out;
  }
  return mirrorPayments(remaining, 0, refundTotal);
}

/** Uložená tržba (server) nebo její vratka – jen pole, která potřebuje kontrola součtu. */
export interface RefundLedgerEntry {
  items: readonly SaleLine[] | null;
  total: number;
  tip?: number;
  evidencedTotal: number;
  redeemedAmount: number;
}

export type RefundIssue = { code: "REFUND_DUPLICATE" | "REFUND_EXCEEDS" | "INVALID_SALE"; message: string; httpStatus: number };

/**
 * Kontrola vratky proti originálu a dřívějším vratkám (ingest ji volá pod zámkem řádku originálu, takže souběžné vratky
 * se seřadí). Vrací problém, nebo null.
 */
export function refundCapacityIssue(original: RefundLedgerEntry, previous: readonly RefundLedgerEntry[], next: RefundLedgerEntry): RefundIssue | null {
  const refundable = original.total - (original.tip ?? 0);
  const refundedBefore = previous.reduce((s, r) => s - r.total, 0);
  if (refundable > 0 && refundedBefore >= refundable) return { code: "REFUND_DUPLICATE", message: "Tato tržba už byla celá vrácena", httpStatus: 409 };
  if (refundedBefore - next.total > refundable) return { code: "REFUND_EXCEEDS", message: "Vratky by dohromady přesáhly původní tržbu", httpStatus: 422 };
  const evidencedBefore = previous.reduce((s, r) => s - r.evidencedTotal, 0);
  if (evidencedBefore - next.evidencedTotal > original.evidencedTotal)
    return { code: "REFUND_EXCEEDS", message: "Evidovaná částka vratek by přesáhla evidovanou částku původní tržby", httpStatus: 422 };
  const redeemedBefore = previous.reduce((s, r) => s - r.redeemedAmount, 0);
  if (redeemedBefore - next.redeemedAmount > original.redeemedAmount) return { code: "REFUND_EXCEEDS", message: "Čerpání ve vratkách by přesáhlo čerpání u původní tržby", httpStatus: 422 };
  // položky: jen ty z originálu a nejvýš tolik kusů, kolik se prodalo (u starších tržeb bez položek se kontroluje jen částka)
  if (original.items?.length && next.items) {
    const rows = refundableLines(original.items, previous.map((p) => ({ lines: p.items ?? [] })));
    for (const l of next.items) {
      if (l.qty >= 0) return { code: "INVALID_SALE", message: "Položka vratky musí mít záporné množství", httpStatus: 422 };
      let qty = -l.qty;
      for (const row of rows) {
        if (lineKey(row.line) !== lineKey(l) || row.remainingQty <= EPS) continue;
        const take = Math.min(qty, row.remainingQty);
        row.remainingQty -= take;
        qty -= take;
        if (qty <= EPS) break;
      }
      if (qty > EPS) return { code: "REFUND_EXCEEDS", message: `Položku „${l.name}“ nelze vrátit – v původní tržbě není, nebo už byla vrácena`, httpStatus: 422 };
    }
  }
  return null;
}

/** Doklad k vratce tak, jak ho dostane pokladna (částky v haléřích, položky po slevě). */
export interface RefundLookupDto {
  sale: {
    id: string;
    sequence: string;
    soldAt: string;
    registerId: string;
    unitId: string | null;
    unitLabel: string | null;
    lines: SaleLine[];
    payments: Payment[];
    tip: number;
    discount: number;
    total: number;
    mode: "mock" | "playground" | "production";
    status: string;
    refundOf: string | null;
  };
  /** vratky, které už k dokladu server má (ze všech pokladen účtu) */
  refunds: { id: string; sequence: string; soldAt: string; lines: SaleLine[]; payments: Payment[]; total: number }[];
}

