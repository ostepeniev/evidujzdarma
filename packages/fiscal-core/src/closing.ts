/**
 * Denní uzávěrka pokladny (Z-report) a pohyby hotovosti (vklad / výběr).
 *
 * Uzávěrka se počítá v zařízení i bez internetu z tržeb a pohybů od poslední uzávěrky.
 * Vklady a výběry hotovosti nejsou tržby – Finanční správě se neposílají.
 *
 * Hotovost v pokladně: počáteční stav + tržby hotově (vč. vratek a spropitného) + vklady − výběry
 * = očekávaný stav; rozdíl proti spočítané hotovosti je manko (−) nebo přebytek (+).
 */
import { formatCzk, type Halere } from "./money.ts";
import { formatReceiptDate } from "./receipt.ts";
import { EVIDENCED_METHODS, PAYMENT_LABEL, PAYMENT_METHODS, type Payment, type PaymentMethod } from "./sale.ts";

export type CashMovementType = "deposit" | "withdrawal";

export const CASH_MOVEMENT_LABEL: Record<CashMovementType, string> = {
  deposit: "Vklad",
  withdrawal: "Výběr",
};

export interface CashMovement {
  id: string;
  at: string;
  type: CashMovementType;
  /** vždy kladná částka v haléřích */
  amount: Halere;
  note?: string | null;
  staffName?: string | null;
}

export type ClosingFiscalState = "confirmed" | "not_required" | "rejected" | "pending";

export interface ClosingSale {
  id: string;
  sequence: string;
  soldAt: string;
  payments: readonly Payment[];
  tip: Halere;
  discount: Halere;
  total: Halere;
  refundOf: string | null;
  fiscal: ClosingFiscalState;
}

export interface ClosingInput {
  /** začátek období (výlučně); null = bez omezení */
  periodFrom: string | null;
  /** konec období (včetně) */
  closedAt: string;
  openingCash: Halere;
  sales: readonly ClosingSale[];
  movements: readonly CashMovement[];
  countedCash: Halere;
  /** hotovost odvedená z pokladny při uzávěrce (do trezoru / banky) */
  cashOut: Halere;
}

export interface ClosingTotals {
  salesCount: number;
  refundsCount: number;
  /** součet tržeb včetně vratek (záporné) */
  gross: Halere;
  refundsTotal: Halere;
  byMethod: Record<PaymentMethod, Halere>;
  tips: Halere;
  discounts: Halere;
  /** platby, které se evidují v EET (hotovost, karta, QR, poukaz) */
  evidencedTotal: Halere;
  /** platby převodem – neevidují se */
  notEvidencedTotal: Halere;
  openingCash: Halere;
  cashSales: Halere;
  deposits: Halere;
  withdrawals: Halere;
  expectedCash: Halere;
  countedCash: Halere;
  /** spočítáno − očekáváno: záporné = manko, kladné = přebytek */
  difference: Halere;
  cashOut: Halere;
  /** zůstatek v pokladně po uzávěrce = počáteční stav další uzávěrky */
  closingCash: Halere;
  pending: number;
  rejected: number;
  firstSequence: string | null;
  lastSequence: string | null;
}

export class ClosingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClosingValidationError";
  }
}

/** Patří okamžik do období uzávěrky (from, to]? */
export function inClosingPeriod(at: string, from: string | null, to: string): boolean {
  const t = Date.parse(at);
  return (from === null || t > Date.parse(from)) && t <= Date.parse(to);
}

export function computeClosing(i: ClosingInput): ClosingTotals {
  for (const [label, v] of [
    ["Počáteční stav", i.openingCash],
    ["Spočítaná hotovost", i.countedCash],
    ["Odvod", i.cashOut],
  ] as const) {
    if (!Number.isInteger(v) || v < 0) throw new ClosingValidationError(`${label} musí být nezáporná částka.`);
  }
  if (i.cashOut > i.countedCash) throw new ClosingValidationError("Odvod nemůže být vyšší než spočítaná hotovost.");
  if (i.periodFrom && Date.parse(i.periodFrom) >= Date.parse(i.closedAt)) throw new ClosingValidationError("Konec období musí být po jeho začátku.");

  const sales = i.sales.filter((s) => inClosingPeriod(s.soldAt, i.periodFrom, i.closedAt)).sort((a, b) => a.soldAt.localeCompare(b.soldAt));
  const movements = i.movements.filter((m) => inClosingPeriod(m.at, i.periodFrom, i.closedAt));

  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<PaymentMethod, Halere>;
  let gross = 0;
  let refundsTotal = 0;
  let refundsCount = 0;
  let tips = 0;
  let discounts = 0;
  let pending = 0;
  let rejected = 0;
  for (const s of sales) {
    gross += s.total;
    tips += s.tip;
    discounts += s.discount;
    if (s.refundOf) {
      refundsCount++;
      refundsTotal += s.total;
    }
    for (const p of s.payments) byMethod[p.method] += p.amount;
    if (s.fiscal === "pending") pending++;
    if (s.fiscal === "rejected") rejected++;
  }
  const evidencedTotal = EVIDENCED_METHODS.reduce((a, m) => a + byMethod[m], 0);
  const notEvidencedTotal = PAYMENT_METHODS.filter((m) => !EVIDENCED_METHODS.includes(m)).reduce((a, m) => a + byMethod[m], 0);
  const deposits = movements.filter((m) => m.type === "deposit").reduce((a, m) => a + m.amount, 0);
  const withdrawals = movements.filter((m) => m.type === "withdrawal").reduce((a, m) => a + m.amount, 0);
  const cashSales = byMethod.cash;
  const expectedCash = i.openingCash + cashSales + deposits - withdrawals;

  return {
    salesCount: sales.length - refundsCount,
    refundsCount,
    gross,
    refundsTotal,
    byMethod,
    tips,
    discounts,
    evidencedTotal,
    notEvidencedTotal,
    openingCash: i.openingCash,
    cashSales,
    deposits,
    withdrawals,
    expectedCash,
    countedCash: i.countedCash,
    difference: i.countedCash - expectedCash,
    cashOut: i.cashOut,
    closingCash: i.countedCash - i.cashOut,
    pending,
    rejected,
    firstSequence: sales[0]?.sequence ?? null,
    lastSequence: sales.at(-1)?.sequence ?? null,
  };
}

/** Bankovky a mince v Kč pro počítání hotovosti. */
export const CZK_DENOMINATIONS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

/** Součet podle počtu kusů {"500": 3, "20": 4} → haléře. */
export function sumDenominations(counts: Readonly<Record<string, number>>): Halere {
  let total = 0;
  for (const d of CZK_DENOMINATIONS) {
    const n = counts[String(d)] ?? 0;
    if (!Number.isInteger(n) || n < 0) throw new ClosingValidationError("Počet kusů musí být nezáporné celé číslo.");
    total += n * d * 100;
  }
  return total;
}

export interface ClosingReport {
  number: number;
  merchantName: string;
  registerId: string;
  unitLabel?: string | null;
  staffName?: string | null;
  periodFrom: string | null;
  closedAt: string;
  totals: ClosingTotals;
  movements?: readonly CashMovement[];
  note?: string | null;
  mode: "test" | "production";
}

function pad(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  if (space >= 1) return left + " ".repeat(space) + right;
  return `${left}\n${" ".repeat(Math.max(0, width - right.length))}${right}`;
}

function center(text: string, width: number): string {
  const s = text.slice(0, width);
  return " ".repeat(Math.floor((width - s.length) / 2)) + s;
}

const signed = (h: Halere) => (h > 0 ? `+${formatCzk(h)}` : formatCzk(h));

/** Textová uzávěrka pro termotiskárnu / tisk z prohlížeče. */
export function renderClosingText(r: ClosingReport, width = 42): string {
  const t = r.totals;
  const hr = "-".repeat(width);
  const L: string[] = [];
  L.push(center(`DENNÍ UZÁVĚRKA č. ${r.number}`, width));
  L.push(center(r.merchantName, width));
  L.push(center(`Pokladna ${r.registerId}${r.unitLabel ? ` · ${r.unitLabel}` : ""}`, width));
  L.push(hr);
  L.push(pad("Od", r.periodFrom ? formatReceiptDate(r.periodFrom) : "začátek", width));
  L.push(pad("Do", formatReceiptDate(r.closedAt), width));
  if (r.staffName) L.push(pad("Uzavřel(a)", r.staffName, width));
  L.push(hr);
  L.push(pad("Počet tržeb", String(t.salesCount), width));
  if (t.refundsCount) L.push(pad("Počet vratek", `${t.refundsCount} (${formatCzk(t.refundsTotal)})`, width));
  L.push(pad("TRŽBY CELKEM", formatCzk(t.gross), width));
  for (const m of PAYMENT_METHODS) if (t.byMethod[m]) L.push(pad(`  ${PAYMENT_LABEL[m]}`, formatCzk(t.byMethod[m]), width));
  if (t.tips) L.push(pad("  z toho spropitné", formatCzk(t.tips), width));
  if (t.discounts) L.push(pad("Poskytnuté slevy", formatCzk(t.discounts), width));
  L.push(pad("Evidováno v EET", formatCzk(t.evidencedTotal), width));
  if (t.notEvidencedTotal) L.push(pad("Neevidováno (převod)", formatCzk(t.notEvidencedTotal), width));
  L.push(hr);
  L.push("HOTOVOST V POKLADNĚ");
  L.push(pad("Počáteční stav", formatCzk(t.openingCash), width));
  L.push(pad("+ tržby hotově", formatCzk(t.cashSales), width));
  if (t.deposits) L.push(pad("+ vklady", formatCzk(t.deposits), width));
  if (t.withdrawals) L.push(pad("− výběry", formatCzk(t.withdrawals), width));
  L.push(pad("= Očekáváno", formatCzk(t.expectedCash), width));
  L.push(pad("Spočítáno", formatCzk(t.countedCash), width));
  L.push(pad(t.difference < 0 ? "MANKO" : t.difference > 0 ? "PŘEBYTEK" : "Rozdíl", signed(t.difference), width));
  if (t.cashOut) L.push(pad("Odvod", formatCzk(t.cashOut), width));
  L.push(pad("Zůstatek v pokladně", formatCzk(t.closingCash), width));
  if (r.movements?.length) {
    L.push(hr);
    L.push("POHYBY HOTOVOSTI");
    for (const m of r.movements) {
      const time = formatReceiptDate(m.at).replace(/^.*\s(\d{1,2}:\d{2}):\d{2}$/, "$1");
      const amount = `${m.type === "withdrawal" ? "−" : "+"}${formatCzk(m.amount)}`;
      L.push(pad(`${time} ${CASH_MOVEMENT_LABEL[m.type]}${m.note ? ` – ${m.note}` : ""}`.slice(0, width - amount.length - 1), amount, width));
    }
  }
  L.push(hr);
  if (t.firstSequence) L.push(pad("Doklady", t.firstSequence === t.lastSequence ? t.firstSequence : `${t.firstSequence} – ${t.lastSequence}`, width));
  if (t.pending) L.push(pad("Čeká na POK", String(t.pending), width));
  if (t.rejected) L.push(pad("Odmítnuto", String(t.rejected), width));
  if (r.note) {
    L.push(hr);
    L.push(`Poznámka: ${r.note}`.slice(0, width * 4));
  }
  if (r.mode === "test") L.push(center("*** TESTOVACÍ REŽIM ***", width));
  return L.flatMap((l) => (l.length > width && !l.includes("\n") ? l.match(new RegExp(`.{1,${width}}`, "g"))! : [l])).join("\n");
}
