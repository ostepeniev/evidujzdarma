/**
 * S2 (17. 10. 2026): výpočty a texty pro generátor „Faktura zdarma“ (/faktura-zdarma). Čisté funkce bez DOM – faktura
 * se skládá v prohlížeči, na server jde jen IČO při načtení z ARES. Nic se neukládá (COMMON 8).
 *
 * Právní základ (ověřeno na zakonyprolidi.cz 17. 10. 2026):
 *  - § 435 odst. 1 občanského zákoníku (89/2012 Sb.): jméno, sídlo, údaj o zápisu v obchodním rejstříku (oddíl, vložka)
 *    nebo v jiném veřejném rejstříku / v jiné evidenci, identifikující údaj (IČO);
 *  - § 29 zákona o DPH (235/2004 Sb.): náležitosti daňového dokladu; § 30 a § 30a zjednodušený daňový doklad do 10 000 Kč;
 *  - § 37 písm. a) ZDPH: daň = součin základu daně a sazby; § 47 odst. 1: sazby 21 % a 12 %.
 */
import { buildSpayd, SpaydError } from "@ez/cz/spayd";
import { toIban } from "@ez/cz/bank";
import { isValidIco, normalizeIco } from "@ez/cz/ico";
import { icoParam } from "./ico-param";
import { parseCzNumber, round2 } from "./doc-tools";

/** Odkaz na generátor s předvyplněným odběratelem – IČO jde do fragmentu, nikdy do query (COMMON 9). Pro stránky firem. */
export function fakturaLink(ico: string): string {
  return "/faktura-zdarma#odberatel=" + ico;
}

/** „#odberatel=12345678“ → IČO odběratele; jen přesně 8 číslic s platnou kontrolní číslicí, jinak null. */
export function parseFakturaFragment(hash: string): { odberatel: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return { odberatel: icoParam(params.get("odberatel")?.trim()) };
}

/** Sazby DPH podle § 47 odst. 1 zákona o DPH (stav k 17. 10. 2026). Osvobozená plnění generátor neřeší. */
export const VAT_RATES = [21, 12] as const;
export type VatRate = (typeof VAT_RATES)[number];

/** Zjednodušený daňový doklad: celková částka za plnění nejvýš 10 000 Kč (§ 30 odst. 1 zákona o DPH). */
export const SIMPLIFIED_LIMIT = 10_000;

export const INVOICE_KINDS = {
  faktura: "Faktura",
  zalohova: "Zálohová faktura (proforma)",
} as const;
export type InvoiceKind = keyof typeof INVOICE_KINDS;

export const INVOICE_PAYMENTS = {
  prevodem: "převodem na účet",
  hotove: "hotově",
  kartou: "platební kartou",
} as const;
export type InvoicePayment = keyof typeof INVOICE_PAYMENTS;

export const UNITS = ["ks", "hod", "den", "měs.", "m", "m²", "m³", "kg", "l", "km", "bal."] as const;

export interface InvoiceItem {
  name: string;
  qty: string;
  unit: string;
  /** cena za jednotku – u plátce bez DPH (§ 29 odst. 1 písm. i)), u neplátce konečná */
  price: string;
  rate: VatRate;
}

export interface InvoiceParty {
  name: string;
  ico: string;
  dic: string;
  address: string;
}

export interface Invoice {
  kind: InvoiceKind;
  vatPayer: boolean;
  number: string;
  /** ISO datum vystavení */
  issueDate: string;
  /** ISO datum uskutečnění zdanitelného plnění (jen plátce, jen faktura) */
  taxDate: string;
  /** splatnost ve dnech od vystavení */
  dueDays: string;
  payment: InvoicePayment;
  account: string;
  /** variabilní symbol – prázdný = číslice z čísla faktury */
  vs: string;
  supplier: InvoiceParty & { registry: string };
  customer: InvoiceParty;
  items: InvoiceItem[];
  note: string;
}

/** Vyplněné řádky (s názvem nebo cenou). */
export const filledInvoiceItems = (items: readonly InvoiceItem[]) => items.filter((i) => i.name.trim() || i.price.trim());

/** Řádek: množství × cena za jednotku, na haléře; prázdné množství = 1. Neplatný řádek → null. Záporná cena = sleva. */
export function itemBase(item: InvoiceItem): number | null {
  const qty = item.qty.trim() ? parseCzNumber(item.qty) : 1;
  const price = parseCzNumber(item.price);
  if (qty === null || price === null || qty <= 0) return null;
  return round2(qty * price);
}

export interface VatRecap {
  rate: VatRate;
  base: number;
  vat: number;
  total: number;
}

export interface InvoiceTotals {
  /** rekapitulace DPH podle sazeb (jen plátce; sazby bez položek se vynechávají) */
  recap: VatRecap[];
  base: number;
  vat: number;
  /** celkem k úhradě */
  total: number;
}

/**
 * Součty faktury. Plátce: základ daně za každou sazbu = součet řádků bez DPH; daň = základ × sazba (§ 37 písm. a) ZDPH),
 * zaokrouhlená matematicky na haléře – způsob zaokrouhlení zákon o DPH výslovně neupravuje. Neplátce: jen součet řádků.
 */
export function invoiceTotals(items: readonly InvoiceItem[], vatPayer: boolean): InvoiceTotals {
  const rows = filledInvoiceItems(items).map((i) => ({ rate: i.rate, base: itemBase(i) ?? 0 }));
  const base = round2(rows.reduce((s, r) => s + r.base, 0));
  if (!vatPayer) return { recap: [], base, vat: 0, total: base };
  const recap: VatRecap[] = [];
  for (const rate of VAT_RATES) {
    const lines = rows.filter((r) => r.rate === rate);
    if (lines.length === 0) continue;
    const b = round2(lines.reduce((s, r) => s + r.base, 0));
    const vat = round2((b * rate) / 100);
    recap.push({ rate, base: b, vat, total: round2(b + vat) });
  }
  const vat = round2(recap.reduce((s, r) => s + r.vat, 0));
  return { recap, base, vat, total: round2(base + vat) };
}

/** Variabilní symbol z čísla faktury: jen číslice, nejvýš 10 (při delším čísle posledních 10). „FV-2026/015“ → „2026015“. */
export function variableSymbolFrom(invoiceNumber: string): string {
  return invoiceNumber.replace(/\D/g, "").slice(-10);
}

/** ISO datum + počet dní (kalendářně, bez posunu o letní čas). Neplatný vstup → "". */
export function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m || !Number.isInteger(days)) return "";
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)).toISOString().slice(0, 10);
}

/** Splatnost ve dnech: celé číslo 0–365, jinak null. */
export function parseDueDays(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n <= 365 ? n : null;
}

/** Datum splatnosti faktury (ISO) nebo "". */
export function dueDateOf(inv: Pick<Invoice, "issueDate" | "dueDays">): string {
  const days = parseDueDays(inv.dueDays);
  return days === null ? "" : addDaysIso(inv.issueDate, days);
}

/** Zjednodušený daňový doklad (§ 30, § 30a ZDPH): plátce, faktura bez odběratele a celkem nejvýš 10 000 Kč. */
export function isSimplified(inv: Pick<Invoice, "kind" | "vatPayer" | "customer">, totals: Pick<InvoiceTotals, "total">): boolean {
  return inv.vatPayer && inv.kind === "faktura" && !inv.customer.name.trim() && totals.total > 0 && totals.total <= SIMPLIFIED_LIMIT;
}

/** Nadpis dokladu. */
export function invoiceTitle(inv: Pick<Invoice, "kind" | "vatPayer" | "customer">, totals: Pick<InvoiceTotals, "total">): string {
  if (inv.kind === "zalohova") return "Zálohová faktura";
  if (!inv.vatPayer) return "Faktura";
  return isSimplified(inv, totals) ? "Zjednodušený daňový doklad" : "Faktura – daňový doklad";
}

/** Věty v patičce dokladu. */
export function invoiceNotices(inv: Pick<Invoice, "kind" | "vatPayer">): string[] {
  const out: string[] = [];
  if (!inv.vatPayer) out.push("Dodavatel není plátcem DPH.");
  if (inv.kind === "zalohova") {
    out.push(
      inv.vatPayer
        ? "Zálohová faktura je výzvou k platbě, není daňovým dokladem. Daňový doklad k přijaté platbě vystavíme po jejím přijetí."
        : "Zálohová faktura je výzvou k platbě, není daňovým dokladem.",
    );
  }
  return out;
}

/** Návrh údaje o zápisu pro OSVČ (§ 435 odst. 1 OZ: podnikatel nezapsaný ve veřejném rejstříku uvede zápis do jiné evidence). */
export const TRADE_REGISTER_LINE = "Fyzická osoba zapsaná v živnostenském rejstříku.";

export type SpaydResult = { spayd: string; iban: string; error: null } | { spayd: null; iban: null; error: string };

/** QR Platba k faktuře: IBAN, částka, VS, splatnost, zpráva „Faktura …“ a jméno příjemce (zkrátí se na 35 znaků). */
export function invoiceSpayd(p: { account: string; amount: number; vs: string; dueDate: string; number: string; kind: InvoiceKind; recipient: string }): SpaydResult {
  const iban = toIban(p.account);
  if (!iban) return { spayd: null, iban: null, error: "Neplatné číslo účtu nebo IBAN." };
  if (!(p.amount > 0)) return { spayd: null, iban: null, error: "Částka k úhradě musí být větší než nula." };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.dueDate);
  try {
    const spayd = buildSpayd({
      account: iban,
      amount: p.amount,
      variableSymbol: p.vs || undefined,
      message: p.number.trim() ? `${p.kind === "zalohova" ? "Zalohova faktura" : "Faktura"} ${p.number.trim()}` : undefined,
      recipientName: p.recipient.trim() || undefined,
      dueDate: m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined,
    });
    return { spayd, iban, error: null };
  } catch (e) {
    return { spayd: null, iban: null, error: e instanceof SpaydError ? `${e.message}.` : "Neplatné údaje pro QR platbu." };
  }
}

/** Je IČO vyplněné správně? Prázdné = ano (povinnost hlídá missingInvoiceFields). */
export function icoOk(raw: string): boolean {
  if (!raw.trim()) return true;
  const n = normalizeIco(raw);
  return !!n && isValidIco(n);
}

/** Co ještě chybí – věty pro upozornění pod náhledem. Dokud seznam není prázdný, faktura se netiskne. */
export function missingInvoiceFields(inv: Invoice): string[] {
  const out: string[] = [];
  const s = inv.supplier;
  const taxDoc = inv.vatPayer && inv.kind === "faktura";
  const totals = invoiceTotals(inv.items, inv.vatPayer);
  if (!s.name.trim()) out.push("Doplňte jméno a příjmení nebo název dodavatele.");
  if (!s.address.trim()) out.push("Doplňte sídlo dodavatele.");
  if (!s.ico.trim()) out.push("Doplňte IČO dodavatele.");
  else if (!icoOk(s.ico)) out.push("IČO dodavatele nemá platný kontrolní součet.");
  if (!s.registry.trim()) out.push("Doplňte údaj o zápisu dodavatele v obchodním rejstříku nebo v jiné evidenci (§ 435 občanského zákoníku).");
  if (inv.vatPayer && !s.dic.trim()) out.push("Doplňte DIČ dodavatele – plátce DPH ho na faktuře uvádí.");
  if (!inv.number.trim()) out.push("Doplňte číslo faktury.");
  if (!inv.issueDate) out.push("Doplňte datum vystavení.");
  if (taxDoc && !inv.taxDate) out.push("Doplňte datum uskutečnění zdanitelného plnění (DUZP).");
  if (parseDueDays(inv.dueDays) === null) out.push("Splatnost zadejte jako počet dní (0 až 365).");
  if (!inv.customer.name.trim()) {
    if (!isSimplified(inv, totals)) {
      out.push(
        taxDoc
          ? "Doplňte odběratele. Bez něj lze vystavit jen zjednodušený daňový doklad do 10 000 Kč (§ 30 zákona o DPH)."
          : "Doplňte odběratele.",
      );
    }
  } else if (taxDoc && !inv.customer.address.trim()) out.push("Doplňte sídlo odběratele.");
  if (!icoOk(inv.customer.ico)) out.push("IČO odběratele nemá platný kontrolní součet.");
  const filled = filledInvoiceItems(inv.items);
  if (filled.length === 0) out.push("Přidejte aspoň jednu položku s cenou.");
  else if (filled.some((i) => !i.name.trim())) out.push("U každé položky uveďte, co dodáváte.");
  else if (filled.some((i) => itemBase(i) === null)) out.push("U každé položky uveďte platnou cenu a množství větší než 0.");
  else if (totals.total <= 0) out.push("Celková částka musí být větší než nula.");
  if (inv.payment === "prevodem") {
    if (!inv.account.trim()) out.push("Doplňte číslo účtu, na který má odběratel zaplatit.");
    else if (!toIban(inv.account)) out.push("Číslo účtu není platné – zkontrolujte předčíslí, číslo a kód banky.");
  }
  if (inv.vs.trim() && !/^\d{1,10}$/.test(inv.vs.trim())) out.push("Variabilní symbol může mít nejvýš 10 číslic.");
  return out;
}
