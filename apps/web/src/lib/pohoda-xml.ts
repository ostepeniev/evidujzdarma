/**
 * S11: export denních souhrnů tržeb do účetního programu POHODA (Stormware) – XML import, verze schémat 2.0
 * (https://www.stormware.cz/pohoda/xml/dokladyimport/). Beta.
 *
 * Na každý den (Europe/Praha) a evidenční jednotku vzniknou nejvýš dva doklady:
 *  - hotovost → pokladní doklad (vch:voucher, voucherType = receipt) do pokladny se zkratkou `cashAccount` (výchozí „HP“);
 *  - bezhotovostní platby (karta, QR, převod, stravenky, kredit, poukazy) → interní doklad (int:intDoc).
 * Částky jsou souhrnné bez položek: homeCurrency s rozpadem DPH – 21 % = priceHigh/priceHighVAT, 12 % = priceLow/
 * priceLowVAT, jiná nenulová sazba = price3/price3VAT, 0 % a spropitné (mimo DPH) = priceNone. U neplátce DPH je vše
 * v priceNone a členění „nonSubsume“. Vratky (záporné tržby) se do součtu dne započítají záporně.
 * Tržba zaplacená zčásti hotově a zčásti jinak se rozdělí poměrem plateb (zaokrouhlení na haléře, součty sedí přesně).
 * Struktura podle voucher.xsd, intDoc.xsd, type.xsd a data.xsd (pořadí prvků) a vzorů voucher_01_v2.0.xml, intDoc_01_v2.0.xml.
 */

export interface PohodaSale {
  soldAt: Date;
  /** klíč evidenční jednotky (id) a její název do textu dokladu */
  unitKey: string;
  unitLabel: string;
  /** haléře */
  total: number;
  payments: readonly { method: string; amount: number }[];
  vatBreakdown: Record<string, { base: number; vat: number }> | null;
}

export interface PohodaOptions {
  /** IČO účetní jednotky (POHODA ho při importu porovná s firmou) */
  ico: string;
  /** zkratka pokladny v POHODĚ pro hotovostní doklady */
  cashAccount?: string;
  /** id datového balíku; výchozí „ez-<IČO>-<první den>“ */
  packId?: string;
  /** název aplikace v hlavičce balíku */
  application?: string;
}

type Group = "cash" | "cashless";
type Bucket = "high" | "low" | "third" | "none";

interface Amounts {
  high: { base: number; vat: number };
  low: { base: number; vat: number };
  third: { base: number; vat: number };
  none: number;
}

export interface PohodaDayDoc {
  date: string;
  unitKey: string;
  unitLabel: string;
  group: Group;
  amounts: Amounts;
  /** součet dokladu v haléřích */
  total: number;
  count: number;
}

const empty = (): Amounts => ({ high: { base: 0, vat: 0 }, low: { base: 0, vat: 0 }, third: { base: 0, vat: 0 }, none: 0 });

const pragueDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" });

const bucketOf = (rate: string): Bucket => (rate === "21" ? "high" : rate === "12" ? "low" : Number(rate) === 0 ? "none" : "third");

/** Složky jedné tržby: [bucket, část (base|vat), haléře]. Spropitné a zbytek mimo rozpad DPH jdou do „none“. */
function components(s: PohodaSale): { key: string; amount: number }[] {
  const out: { key: string; amount: number }[] = [];
  let covered = 0;
  if (s.vatBreakdown) {
    for (const [rate, v] of Object.entries(s.vatBreakdown)) {
      const b = bucketOf(rate);
      if (b === "none") out.push({ key: "none", amount: v.base + v.vat });
      else out.push({ key: `${b}.base`, amount: v.base }, { key: `${b}.vat`, amount: v.vat });
      covered += v.base + v.vat;
    }
  }
  if (s.total - covered !== 0) out.push({ key: "none", amount: s.total - covered });
  return out;
}

function add(a: Amounts, key: string, h: number): void {
  if (key === "none") a.none += h;
  else {
    const [b, part] = key.split(".") as [Exclude<Bucket, "none">, "base" | "vat"];
    a[b][part] += h;
  }
}

/** Rozdělí tržbu mezi hotovost a bezhotovostní platby poměrem plateb; součty skupin = platby přesně. */
export function splitSale(s: PohodaSale): Partial<Record<Group, Amounts>> {
  const cash = s.payments.filter((p) => p.method === "cash").reduce((x, p) => x + p.amount, 0);
  const cashless = s.payments.filter((p) => p.method !== "cash").reduce((x, p) => x + p.amount, 0);
  const comps = components(s);
  const out: Partial<Record<Group, Amounts>> = {};
  if (s.total === 0) return out;
  if (cash === 0 || cashless === 0) {
    const a = empty();
    for (const c of comps) add(a, c.key, c.amount);
    out[cash !== 0 ? "cash" : "cashless"] = a;
    return out;
  }
  const a = empty();
  const b = empty();
  let allocated = 0;
  let largest: { key: string; abs: number } | null = null;
  for (const c of comps) {
    const part = Math.round((c.amount * cash) / s.total);
    add(a, c.key, part);
    add(b, c.key, c.amount - part);
    allocated += part;
    if (!c.key.endsWith(".vat") && (!largest || Math.abs(c.amount) > largest.abs)) largest = { key: c.key, abs: Math.abs(c.amount) };
  }
  // zaokrouhlovací rozdíl do největšího základu, ať hotovostní doklad sedí na haléř s hotovostí
  const diff = cash - allocated;
  if (diff && largest) {
    add(a, largest.key, diff);
    add(b, largest.key, -diff);
  }
  out.cash = a;
  out.cashless = b;
  return out;
}

const sumAmounts = (a: Amounts) => a.high.base + a.high.vat + a.low.base + a.low.vat + a.third.base + a.third.vat + a.none;

/** Denní souhrny: den × jednotka × hotovost/bezhotovost, seřazeno. */
export function pohodaDayDocs(sales: readonly PohodaSale[]): PohodaDayDoc[] {
  const docs = new Map<string, PohodaDayDoc>();
  for (const s of sales) {
    const date = pragueDay.format(s.soldAt);
    for (const [group, amounts] of Object.entries(splitSale(s)) as [Group, Amounts][]) {
      const key = `${date}|${s.unitKey}|${group}`;
      let d = docs.get(key);
      if (!d) docs.set(key, (d = { date, unitKey: s.unitKey, unitLabel: s.unitLabel, group, amounts: empty(), total: 0, count: 0 }));
      for (const b of ["high", "low", "third"] as const) {
        d.amounts[b].base += amounts[b].base;
        d.amounts[b].vat += amounts[b].vat;
      }
      d.amounts.none += amounts.none;
      d.count += 1;
    }
  }
  return [...docs.values()]
    .map((d) => ({ ...d, total: sumAmounts(d.amounts) }))
    .sort((x, y) => x.date.localeCompare(y.date) || x.unitLabel.localeCompare(y.unitLabel, "cs") || x.unitKey.localeCompare(y.unitKey) || (x.group === "cash" ? -1 : 1));
}

/** Haléře → „1234.50“ (typ:currencyType je xsd:double; tečka, bez oddělovačů tisíců). */
export function pohodaAmount(h: number): string {
  const sign = h < 0 ? "-" : "";
  const abs = Math.abs(h);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function currencyXml(a: Amounts, vatPayer: boolean): string {
  const lines: string[] = [];
  const el = (name: string, h: number) => lines.push(`<typ:${name}>${pohodaAmount(h)}</typ:${name}>`);
  // pořadí podle typ:typeCurrencyHome: priceNone, priceLow, priceLowVAT, priceHigh, priceHighVAT, price3, price3VAT
  if (a.none || !vatPayer) el("priceNone", vatPayer ? a.none : sumAmounts(a));
  if (vatPayer) {
    if (a.low.base || a.low.vat) (el("priceLow", a.low.base), el("priceLowVAT", a.low.vat));
    if (a.high.base || a.high.vat) (el("priceHigh", a.high.base), el("priceHighVAT", a.high.vat));
    if (a.third.base || a.third.vat) (el("price3", a.third.base), el("price3VAT", a.third.vat));
  }
  return lines.join("");
}

const czDate = (iso: string) => `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(0, 4)}`;

/** Doklad jedné skupiny jednoho dne – dataPackItem. */
function itemXml(d: PohodaDayDoc, i: number, opts: Required<Pick<PohodaOptions, "cashAccount">>, vatPayer: boolean): string {
  const id = `EZ${d.date.replace(/-/g, "")}-${String(i + 1).padStart(3, "0")}`;
  const vatClass = `<typ:classificationVATType>${vatPayer ? "inland" : "nonSubsume"}</typ:classificationVATType>`;
  const note = `EvidujZdarma: ${d.count} ${d.count === 1 ? "tržba" : d.count < 5 ? "tržby" : "tržeb"} (souhrn dne, vratky záporně).`;
  if (d.group === "cash") {
    const text = `Tržby hotově ${czDate(d.date)} – ${d.unitLabel}`.slice(0, 240);
    return (
      `<dat:dataPackItem version="2.0" id="${id}">` +
      `<vch:voucher version="2.0"><vch:voucherHeader>` +
      `<vch:voucherType>receipt</vch:voucherType>` +
      `<vch:cashAccount><typ:ids>${esc(opts.cashAccount)}</typ:ids></vch:cashAccount>` +
      `<vch:date>${d.date}</vch:date>` +
      `<vch:datePayment>${d.date}</vch:datePayment>` +
      (vatPayer ? `<vch:dateTax>${d.date}</vch:dateTax>` : "") +
      `<vch:classificationVAT>${vatClass}</vch:classificationVAT>` +
      `<vch:text>${esc(text)}</vch:text>` +
      `<vch:note>${esc(note)}</vch:note>` +
      `</vch:voucherHeader>` +
      `<vch:voucherSummary><vch:homeCurrency>${currencyXml(d.amounts, vatPayer)}</vch:homeCurrency></vch:voucherSummary>` +
      `</vch:voucher></dat:dataPackItem>`
    );
  }
  const text = `Tržby bezhotovostně (karta, QR, převod, poukazy) ${czDate(d.date)} – ${d.unitLabel}`.slice(0, 240);
  return (
    `<dat:dataPackItem version="2.0" id="${id}">` +
    `<int:intDoc version="2.0"><int:intDocHeader>` +
    `<int:date>${d.date}</int:date>` +
    (vatPayer ? `<int:dateTax>${d.date}</int:dateTax>` : "") +
    `<int:dateAccounting>${d.date}</int:dateAccounting>` +
    `<int:classificationVAT>${vatClass}</int:classificationVAT>` +
    `<int:text>${esc(text)}</int:text>` +
    `<int:note>${esc(note)}</int:note>` +
    `</int:intDocHeader>` +
    `<int:intDocSummary><int:homeCurrency>${currencyXml(d.amounts, vatPayer)}</int:homeCurrency></int:intDocSummary>` +
    `</int:intDoc></dat:dataPackItem>`
  );
}

/**
 * Celý datový balík (dat:dataPack) pro jednu účetní jednotku. `vatPayer` = tržby s rozpadem DPH; u neplátce vše
 * v priceNone. Balík bez dokladů XSD nepřipouští (dataPack musí mít aspoň jeden dataPackItem) – volající to hlídá
 * přes pohodaDayDocs(); tady by to byla chyba programu.
 */
export function pohodaXml(sales: readonly PohodaSale[], opts: PohodaOptions): string {
  const docs = pohodaDayDocs(sales);
  if (!docs.length) throw new RangeError("pohodaXml: žádné doklady");
  const vatPayer = sales.some((s) => !!s.vatBreakdown);
  const cashAccount = (opts.cashAccount ?? "HP").slice(0, 19) || "HP";
  const packId = (opts.packId ?? `ez-${opts.ico}-${docs[0]?.date ?? "prazdny"}`).slice(0, 64);
  const items = docs.map((d, i) => itemXml(d, i, { cashAccount }, vatPayer));
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<dat:dataPack version="2.0" id="${esc(packId)}" ico="${esc(opts.ico)}" application="${esc(opts.application ?? "EvidujZdarma")}" note="Tržby z EvidujZdarma (souhrn po dnech)"` +
      ` xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"` +
      ` xmlns:vch="http://www.stormware.cz/schema/version_2/voucher.xsd"` +
      ` xmlns:int="http://www.stormware.cz/schema/version_2/intDoc.xsd"` +
      ` xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">`,
    ...items,
    `</dat:dataPack>`,
    "",
  ].join("\n");
}
