/**
 * Model tržby — sdílený pokladnou (prohlížeč), API, Alisio i B2B API.
 * Isomorfní: žádné závislosti na Node.js.
 */
import { type Halere, lineTotal, vatBreakdown } from "./money.ts";

/**
 * Způsoby platby. Poukazy podle semináře FS pro vývojáře, „Specifické případy“ (R5.10):
 *  - meal_voucher – stravenka / poukázka třetí strany: běžná platba v celk_trzba, bez cerp_zuct;
 *  - credit – kredit, čip, předplacená karta: celk_trzba + cerp_zuct (nabití = položka „prepayment“);
 *  - gift_voucher – dárkový poukaz na konkrétní zboží či službu: uplatnění se neeviduje;
 *  - voucher – jen pro tržby uložené před R5.10 (význam jako credit), pokladna ho už nenabízí.
 */
export const PAYMENT_METHODS = ["cash", "card", "qr", "transfer", "meal_voucher", "credit", "gift_voucher", "voucher"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Hotovost",
  card: "Karta",
  qr: "QR platba",
  transfer: "Převod na účet",
  meal_voucher: "Stravenka / poukázka",
  credit: "Kredit / předplacená karta",
  gift_voucher: "Dárkový poukaz",
  voucher: "Poukaz / záloha",
};

/**
 * Evidují se platby přijaté při osobním kontaktu nebo v provozovně (hotovost, karta,
 * QR kód, poukázka…). Vzdálený převod na účet (faktura, platební brána) se neeviduje.
 * Zdroj: eet.gov.cz – Kdo musí evidovat tržby. Uplatnění dárkového poukazu na konkrétní
 * zboží či službu se neeviduje (eviduje se jeho prodej) – seminář FS pro vývojáře (R5.10).
 */
export const EVIDENCED_METHODS: readonly PaymentMethod[] = ["cash", "card", "qr", "meal_voucher", "credit", "voucher"];
/** Úhrada dříve zaplaceným kreditem / zálohou → cerp_zuct. */
export const REDEEMED_METHODS: readonly PaymentMethod[] = ["credit", "voucher"];

export interface SaleLine {
  name: string;
  qty: number;
  unitPrice: Halere;
  vatRate: number;
  /** "prepayment" = prodej poukazu / přijetí zálohy určené k pozdějšímu čerpání */
  kind?: "goods" | "prepayment";
}

export interface Payment {
  method: PaymentMethod;
  amount: Halere;
}

export type FiscalMode = "test" | "production";

export interface SaleInput {
  id: string;
  deviceId: string;
  registerId: string;
  unitId: string;
  sequence: string;
  soldAt: string;
  lines: SaleLine[];
  payments: Payment[];
  discount?: Halere;
  tip?: Halere;
  refundOf?: string | null;
  vatPayer: boolean;
  mode: FiscalMode;
  cashierId?: string | null;
}

export interface Sale extends Required<Omit<SaleInput, "refundOf" | "cashierId">> {
  refundOf: string | null;
  cashierId: string | null;
  /** součet položek po slevě (bez spropitného) */
  subtotal: Halere;
  /** evidovaná částka = subtotal + spropitné */
  total: Halere;
  vat: Record<string, { base: Halere; vat: Halere }> | null;
}

export class SaleValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join("; "));
  }
}

/** Pořadové číslo: max 25 znaků, písmena, číslice a oddělovače. */
export const SEQUENCE_RE = /^[0-9A-Za-z.,:;/#\-_ ]{1,25}$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildSale(input: SaleInput): Sale {
  const issues: string[] = [];
  if (!UUID_RE.test(input.id)) issues.push("id musí být UUID");
  if (!SEQUENCE_RE.test(input.sequence)) issues.push("neplatné pořadové číslo");
  if (Number.isNaN(Date.parse(input.soldAt))) issues.push("neplatné datum tržby");
  if (input.lines.length === 0) issues.push("tržba nemá žádnou položku");
  for (const l of input.lines) {
    if (!l.name.trim()) issues.push("položka bez názvu");
    if (!Number.isFinite(l.qty) || l.qty === 0) issues.push(`neplatné množství u "${l.name}"`);
    if (!Number.isInteger(l.unitPrice)) issues.push(`cena u "${l.name}" musí být v haléřích`);
  }
  const discount = input.discount ?? 0;
  const tip = input.tip ?? 0;
  if (discount < 0) issues.push("sleva nesmí být záporná");
  if (tip < 0) issues.push("spropitné nesmí být záporné");

  const gross = input.lines.reduce((s, l) => s + lineTotal(l), 0);
  const isRefund = gross < 0;
  if (isRefund && !input.refundOf) issues.push("vratka musí odkazovat na původní tržbu");
  if (isRefund && discount) issues.push("u vratky nelze uplatnit slevu");
  if (!isRefund && discount > gross) issues.push("sleva je vyšší než cena");

  // Slevu rozpočítáme do položek poměrně, aby rozpad DPH odpovídal skutečně zaplacené částce.
  const lines = applyDiscount(input.lines, discount);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const total = subtotal + tip;
  const paid = input.payments.reduce((s, p) => s + p.amount, 0);
  if (paid !== total) issues.push(`platby (${paid}) nesouhlasí s částkou (${total})`);
  for (const p of input.payments) {
    if (!(PAYMENT_METHODS as readonly string[]).includes(p.method)) issues.push(`neznámý způsob platby ${p.method}`);
  }
  if (issues.length) throw new SaleValidationError(issues);

  return {
    ...input,
    // EET přenáší čas s přesností na sekundy — identita tržby musí být při opakování stejná.
    soldAt: new Date(Math.floor(Date.parse(input.soldAt) / 1000) * 1000).toISOString(),
    lines,
    discount,
    tip,
    refundOf: input.refundOf ?? null,
    cashierId: input.cashierId ?? null,
    subtotal,
    total,
    vat: input.vatPayer ? vatBreakdown(lines) : null,
  };
}

function applyDiscount(lines: SaleLine[], discount: Halere): SaleLine[] {
  if (!discount) return lines;
  const gross = lines.reduce((s, l) => s + lineTotal(l), 0);
  let remaining = discount;
  return lines.map((l, i) => {
    const t = lineTotal(l);
    const share = i === lines.length - 1 ? remaining : Math.round((discount * t) / gross);
    remaining -= share;
    const newTotal = t - share;
    // jednotkovou cenu přepočteme tak, aby qty × cena = nový součet (u qty ≠ 1 vznikne jedna položka)
    if (l.qty === 1) return { ...l, unitPrice: newTotal };
    // druh položky (např. záloha / poukaz) se nesmí ztratit – jinak by se změnilo urceno_cerp_zuct
    return { name: `${l.name} (${l.qty}×, po slevě)`, qty: 1, unitPrice: newTotal, vatRate: l.vatRate, ...(l.kind ? { kind: l.kind } : {}) };
  });
}

export interface EvidencedAmounts {
  /** celk_trzba — součet evidovaných plateb */
  total: Halere;
  /** urceno_cerp_zuct — část určená k pozdějšímu čerpání (prodej poukazu, záloha) */
  prepayment: Halere;
  /** cerp_zuct — úhrada dříve zaplaceným poukazem / zálohou */
  redeemed: Halere;
}

/**
 * Částky pro datovou zprávu. Pokud je `total` 0 (např. vše uhrazeno převodem),
 * tržba se neeviduje.
 * POZN.: význam polí urceno_cerp_zuct / cerp_zuct převzat z EET 1.0 a srovnání EET 2.0
 * (podnikatel.cz) — před produkcí ověřit v EET_popis_rozhrani_v1.2.pdf.
 */
export function evidencedAmounts(sale: Pick<Sale, "payments" | "lines">): EvidencedAmounts {
  const total = sale.payments.filter((p) => EVIDENCED_METHODS.includes(p.method)).reduce((s, p) => s + p.amount, 0);
  const redeemed = sale.payments.filter((p) => REDEEMED_METHODS.includes(p.method)).reduce((s, p) => s + p.amount, 0);
  const prepaymentLines = sale.lines.filter((l) => l.kind === "prepayment").reduce((s, l) => s + lineTotal(l), 0);
  const prepayment = Math.sign(prepaymentLines) === Math.sign(total) ? Math.min(Math.abs(prepaymentLines), Math.abs(total)) * Math.sign(total) : 0;
  return { total, prepayment, redeemed };
}

/** Opačná (záporná) tržba k vrácení zboží / peněz. */
export function refundLinesFrom(sale: Pick<Sale, "lines">): SaleLine[] {
  return sale.lines.map((l) => ({ ...l, qty: -l.qty }));
}

/** Generátor pořadových čísel pro jedno zařízení: "{prefix}{counter}" — např. "P1-000123". */
export function formatSequence(prefix: string, counter: number): string {
  const s = `${prefix}${String(counter).padStart(6, "0")}`;
  if (!SEQUENCE_RE.test(s)) throw new RangeError("Pořadové číslo je mimo povolený formát");
  return s;
}
