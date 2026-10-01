/**
 * Účtenka (doklad o evidované tržbě) — data + textové vykreslení pro termotiskárny
 * (ESC/POS, 32/42/48 znaků) a pro e-mail/SMS. HTML/PDF vykresluje aplikace z `ReceiptData`.
 */
import { formatCzk, type Halere } from "./money.ts";
import { PAYMENT_LABEL, type Sale } from "./sale.ts";

export interface ReceiptMerchant {
  name: string;
  dic: string | null;
  ico: string | null;
  address: string | null;
  unitLabel: string;
  header?: string | null;
  footer?: string | null;
}

export interface ReceiptFiscal {
  /** potvrzovací kód FS; null = tržba zatím čeká na odeslání */
  confirmationCode: string | null;
  /** kód, který se tiskne místo POK, když tržba ještě nebyla potvrzena */
  securityCode: string | null;
  mode: "test" | "production";
  /**
   * Uvádět POK na dokladu? Podle FS je to dobrovolné (výchozí: ano).
   * false = doklad neobsahuje POK ani upozornění na dodatečné odeslání.
   */
  showCode?: boolean;
}

export interface ReceiptData {
  merchant: ReceiptMerchant;
  sale: Pick<Sale, "id" | "registerId" | "unitId" | "sequence" | "soldAt" | "lines" | "payments" | "discount" | "tip" | "subtotal" | "total" | "vat" | "refundOf">;
  fiscal: ReceiptFiscal;
  /** odkaz na online účtenku (QR na displeji / SMS) */
  url?: string;
  cashReceived?: Halere;
}

const dateFmt = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Prague",
});

export function formatReceiptDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

function pad(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  if (space >= 1) return left + " ".repeat(space) + right;
  return `${left}\n${" ".repeat(Math.max(0, width - right.length))}${right}`;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      if (line) out.push(line);
      line = w.length > width ? w.slice(0, width) : w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

function center(text: string, width: number): string {
  const s = text.slice(0, width);
  return " ".repeat(Math.floor((width - s.length) / 2)) + s;
}

/** Plain-text účtenka (UTF-8). Tiskový ovladač ji případně převede do CP852. */
export function renderReceiptText(r: ReceiptData, width = 42): string {
  const L: string[] = [];
  const hr = "-".repeat(width);
  const m = r.merchant;
  for (const l of wrap(m.name, width)) L.push(center(l, width));
  if (m.address) for (const l of wrap(m.address, width)) L.push(center(l, width));
  if (m.ico) L.push(center(`IČO: ${m.ico}`, width));
  if (m.dic) L.push(center(`DIČ: ${m.dic}`, width));
  if (m.header) for (const l of wrap(m.header, width)) L.push(center(l, width));
  L.push(hr);
  if (r.sale.refundOf) L.push(center("VRATKA / OPRAVNÝ DOKLAD", width));
  for (const line of r.sale.lines) {
    const total = formatCzk(Math.round(line.qty * line.unitPrice));
    if (line.qty === 1 && line.name.length + total.length + 1 <= width) {
      L.push(pad(line.name, total, width));
      continue;
    }
    L.push(...wrap(line.name, width));
    L.push(pad(line.qty === 1 ? "" : `  ${line.qty} × ${formatCzk(line.unitPrice)}`, total, width));
  }
  L.push(hr);
  if (r.sale.discount) L.push(pad("Sleva", `-${formatCzk(r.sale.discount)}`, width));
  if (r.sale.tip) {
    L.push(pad("Mezisoučet", formatCzk(r.sale.subtotal), width));
    L.push(pad("Spropitné", formatCzk(r.sale.tip), width));
  }
  L.push(pad("CELKEM", formatCzk(r.sale.total), width));
  for (const p of r.sale.payments) L.push(pad(`  ${PAYMENT_LABEL[p.method]}`, formatCzk(p.amount), width));
  if (r.cashReceived && r.cashReceived > r.sale.total) {
    L.push(pad("  Přijato", formatCzk(r.cashReceived), width));
    L.push(pad("  Vráceno", formatCzk(r.cashReceived - r.sale.total), width));
  }
  if (r.sale.vat) {
    L.push(hr);
    L.push(pad("Sazba DPH", "Základ / DPH", width));
    for (const [rate, v] of Object.entries(r.sale.vat)) {
      L.push(pad(`  ${rate} %`, `${formatCzk(v.base)} / ${formatCzk(v.vat)}`, width));
    }
  }
  L.push(hr);
  L.push(pad("Datum", formatReceiptDate(r.sale.soldAt), width));
  L.push(pad("Evid. jednotka", r.sale.unitId, width));
  L.push(pad("Pokladna", r.sale.registerId, width));
  L.push(pad("Číslo dokladu", r.sale.sequence, width));
  const showCode = r.fiscal.showCode !== false;
  if (showCode && r.fiscal.confirmationCode) {
    L.push("POK:");
    L.push(...wrap(r.fiscal.confirmationCode, width));
  } else if (showCode && r.fiscal.securityCode) {
    L.push("Tržba bude odeslána dodatečně. Kód:");
    L.push(...wrap(r.fiscal.securityCode, width));
  }
  if (r.fiscal.mode === "test") L.push(center("*** TESTOVACÍ REŽIM – NEPLATNÝ DOKLAD ***", width));
  if (m.footer) {
    L.push(hr);
    for (const l of wrap(m.footer, width)) L.push(center(l, width));
  }
  if (r.url) for (let i = 0; i < r.url.length; i += width) L.push(center(r.url.slice(i, i + width), width));
  return L.join("\n");
}
