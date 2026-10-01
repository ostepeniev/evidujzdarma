/**
 * SPAYD — Short Payment Descriptor ("QR Platba"), standard České bankovní asociace v1.0.
 * https://qr-platba.cz/pro-vyvojare/specifikace-formatu/
 */
import { formatIban, toIban } from "./bank.ts";

export interface SpaydInput {
  /** IBAN or Czech domestic account (předčíslí-číslo/kód banky) */
  account: string;
  /** optional SWIFT/BIC appended to ACC as "+BIC" */
  bic?: string;
  /** amount in currency units; rounded to 2 decimals */
  amount?: number;
  currency?: string;
  variableSymbol?: string;
  specificSymbol?: string;
  constantSymbol?: string;
  message?: string;
  recipientName?: string;
  /** due date */
  dueDate?: Date;
  /** "IP" = okamžitá platba (instant payment) */
  paymentType?: string;
  /** keep diacritics (some older bank apps mis-render them) */
  keepDiacritics?: boolean;
}

export class SpaydError extends Error {}

const LIMITS = { MSG: 60, RN: 35, SYMBOL: 10, AM: 10 } as const;

function clean(value: string, keepDiacritics: boolean): string {
  let v = value.trim();
  if (!keepDiacritics) v = v.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return v.replace(/%/g, "%25").replace(/\*/g, "%2A").replace(/[\r\n]+/g, " ");
}

function symbol(name: string, value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  const v = value.replace(/\s+/g, "");
  if (!/^\d{1,10}$/.test(v)) throw new SpaydError(`${name} musí mít 1–10 číslic`);
  return v;
}

function yyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildSpayd(input: SpaydInput): string {
  const iban = toIban(input.account);
  if (!iban) throw new SpaydError("Neplatné číslo účtu nebo IBAN");
  const keep = input.keepDiacritics ?? false;
  const parts: string[] = ["SPD", "1.0"];

  let acc = iban;
  if (input.bic) {
    const bic = input.bic.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) throw new SpaydError("Neplatný BIC");
    acc += `+${bic}`;
  }
  parts.push(`ACC:${acc}`);

  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new SpaydError("Částka musí být kladná");
    const am = input.amount.toFixed(2);
    if (am.length > LIMITS.AM) throw new SpaydError("Částka je příliš vysoká");
    parts.push(`AM:${am}`);
  }

  const cc = (input.currency ?? "CZK").toUpperCase();
  if (!/^[A-Z]{3}$/.test(cc)) throw new SpaydError("Neplatná měna");
  parts.push(`CC:${cc}`);

  if (input.dueDate) parts.push(`DT:${yyyymmdd(input.dueDate)}`);
  if (input.paymentType) parts.push(`PT:${clean(input.paymentType, false).slice(0, 3)}`);

  if (input.message) parts.push(`MSG:${clean(input.message, keep).slice(0, LIMITS.MSG)}`);
  if (input.recipientName) parts.push(`RN:${clean(input.recipientName, keep).slice(0, LIMITS.RN)}`);

  const vs = symbol("Variabilní symbol", input.variableSymbol);
  if (vs) parts.push(`X-VS:${vs}`);
  const ss = symbol("Specifický symbol", input.specificSymbol);
  if (ss) parts.push(`X-SS:${ss}`);
  const ks = symbol("Konstantní symbol", input.constantSymbol);
  if (ks) parts.push(`X-KS:${ks}`);

  return parts.join("*");
}

export function describeAccount(iban: string): string {
  return formatIban(iban);
}
