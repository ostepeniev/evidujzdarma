/**
 * S2-E (17. 10. 2026): import zboží do katalogu (rychlá tlačítka) ze souboru jiné pokladny.
 * Čistá logika bez DOM a bez serveru – používá ji nastavení pokladny (náhled v prohlížeči) i API (stejné limity a klíč duplicit).
 *
 *  - kódování: UTF-8 (i s BOM), UTF-16 (Excel „Text v kódování Unicode“), jinak Windows-1250 (starší český Excel);
 *  - oddělovač: středník, tabulátor nebo čárka – podle prvních řádků (mimo uvozovky), nebo podle řádku „sep=;“ z Excelu;
 *  - čísla: desetinná čárka i tečka, mezery jako oddělovač tisíců, „Kč“, „,-“;
 *  - hlavičky: české i anglické názvy sloupců, přesné sloupce exportu Dotykačky a SumUp (podle jejich nápovědy).
 *
 * Katalog (packages/db catalog_items) ukládá název, cenu s DPH v haléřích, sazbu DPH, barvu, pořadí a od S3-POKLADNA (17. 10. 2026)
 * i kategorii a kód zboží (EAN / PLU / SKU). Kategorie navíc určí pořadí tlačítek.
 */

export const IMPORT_LIMITS = {
  /** nejvýš řádků se zbožím v jednom souboru (a v jednom požadavku API) */
  maxRows: 2000,
  /** největší soubor; JSON požadavku s 2 000 položkami je pod limitem API (1 MB) */
  maxBytes: 1024 * 1024,
  /** nejvýš položek v katalogu účtu celkem – pokladna stahuje katalog do zařízení */
  maxCatalog: 5000,
  /** stejné jako CatalogInput v lib/server/schemas.ts */
  nameMax: 80,
  /** kategorie a kód zboží – stejné jako CatalogInput */
  categoryMax: 80,
  codeMax: 64,
  /** 10 milionů Kč v haléřích – stejné jako CatalogInput */
  maxPrice: 10_000_000_00,
} as const;

export const VAT_RATES = [0, 12, 21] as const;

export type ImportField = "name" | "price" | "priceNet" | "vat" | "category" | "code" | "variant" | "deleted";
/** Index sloupce pro každé pole (chybí = sloupec v souboru není). */
export type ImportMapping = Partial<Record<ImportField, number>>;

export const FIELD_LABEL: Record<Exclude<ImportField, "deleted" | "variant">, string> = {
  name: "Název",
  price: "Cena s DPH",
  priceNet: "Cena bez DPH",
  vat: "Sazba DPH",
  category: "Kategorie",
  code: "Kód / EAN",
};

export interface ImportPreset {
  id: "dotykacka" | "sumup";
  label: string;
  /** názvy sloupců přesně podle nápovědy výrobce */
  columns: Partial<Record<ImportField, readonly string[]>>;
  /** podle kterých sloupců export poznáme */
  detect: readonly string[];
  /** kde v pokladně export najdete (podle nápovědy výrobce) */
  exportHint: string;
  source: { label: string; url: string };
}

/**
 * Exporty, jejichž sloupce výrobce veřejně popisuje (ověřeno 17. 10. 2026). Storyous exportuje přehled prodejů bez ceny
 * položky – pro něj ani pro jiné pokladny preset nemáme, sloupce se přiřadí ručně.
 */
export const IMPORT_PRESETS: readonly ImportPreset[] = [
  {
    id: "dotykacka",
    label: "Dotykačka",
    columns: {
      name: ["name"],
      price: ["priceWithVAT"],
      priceNet: ["priceWithoutVAT"],
      vat: ["vat"],
      category: ["categoryName"],
      code: ["ean", "plu", "externalId"],
      deleted: ["deleted"],
    },
    detect: ["priceWithVAT", "priceWithoutVAT", "categoryName"],
    exportHint: "Vzdálená správa → Seznamy → Produkty → Export → Export produktů, uložit jako CSV.",
    source: { label: "Dotykačka: Import produktů (popis sloupců)", url: "https://manual.dotykacka.cz/importproduktu.html" },
  },
  {
    id: "sumup",
    label: "SumUp",
    columns: {
      name: ["Item name"],
      variant: ["Variations"],
      price: ["Price"],
      vat: ["Tax rate (%)"],
      category: ["Category"],
      code: ["Barcode", "SKU"],
    },
    detect: ["Item name", "Tax rate (%)"],
    exportHint: "Profil SumUp → Katalog → Položky → Export → Stáhnout .csv.",
    source: { label: "SumUp: Export katalogu položek (CSV)", url: "https://help.sumup.com/en-GB/articles/31VtFU3yCJK19lNe18rsZe-export-items" },
  },
];

/** Obecné názvy sloupců (normalizované: malá písmena, bez diakritiky a interpunkce). */
const ALIASES: Record<Exclude<ImportField, "deleted">, readonly string[]> = {
  name: ["nazev", "name", "item name", "nazev polozky", "nazev zbozi", "nazev produktu", "nazev sluzby", "polozka", "produkt", "zbozi", "polozky menu", "item", "product", "product name", "artikl"],
  price: ["cena", "cena s dph", "cena vc dph", "cena vcetne dph", "prodejni cena", "prodejni cena s dph", "pricewithvat", "price with vat", "price", "cena kc", "cena s dph kc", "jednotkova cena", "mpc"],
  priceNet: ["cena bez dph", "pricewithoutvat", "price without vat", "prodejni cena bez dph", "cena bez dph kc"],
  vat: ["dph", "sazba", "sazba dph", "vat", "tax rate", "tax", "vat rate", "dph sazba"],
  category: ["kategorie", "category", "categoryname", "category name", "skupina", "kategorie zbozi"],
  code: ["kod", "ean", "plu", "barcode", "sku", "carovy kod", "externalid", "kod zbozi"],
  variant: ["variations", "varianta", "varianty", "variant"],
};

export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/%/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Klíč duplicit: stejný název bez ohledu na velikost písmen a mezery (stejný na klientu i na serveru). */
export function nameKey(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("cs");
}

/* ───────────── soubor → text ───────────── */

export type ImportEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1250";

export const ENCODING_LABEL: Record<ImportEncoding, string> = {
  "utf-8": "UTF-8",
  "utf-16le": "UTF-16 (Unicode)",
  "utf-16be": "UTF-16 (Unicode)",
  "windows-1250": "Windows-1250",
};

export function decodeImportFile(bytes: Uint8Array): { text: string; encoding: ImportEncoding } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "utf-8" };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    // neplatné UTF-8 = starší český Excel / Windows
    return { text: new TextDecoder("windows-1250").decode(bytes), encoding: "windows-1250" };
  }
}

/* ───────────── text → tabulka ───────────── */

export type Delimiter = ";" | "," | "\t";
export const DELIMITER_LABEL: Record<Delimiter, string> = { ";": "středník", ",": "čárka", "\t": "tabulátor" };

/** Počet oddělovačů na řádku mimo uvozovky. */
function countOutsideQuotes(line: string, d: string): number {
  let n = 0;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === d && !quoted) n++;
  }
  return n;
}

export function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 20);
  let best: { d: Delimiter; score: number } | null = null;
  // pořadí = přednost při shodě (český Excel ukládá středník); vyhrává oddělovač se stejným počtem na nejvíce řádcích
  for (const d of [";", "\t", ","] as const) {
    const counts = lines.map((l) => countOutsideQuotes(l, d));
    const head = counts[0] ?? 0;
    if (head === 0) continue;
    const score = counts.filter((c) => c === head).length;
    if (!best || score > best.score) best = { d, score };
  }
  return best?.d ?? ";";
}

/**
 * CSV podle RFC 4180: uvozovky, "" uvnitř uvozovek, zalomení řádku v uvozovkách, CRLF i LF.
 * Prázdné řádky vynechá; `line` je číslo řádku v textu, kde záznam začíná (od 1).
 */
export function parseDelimitedLines(text: string, d: Delimiter): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const endRow = () => {
    row.push(cell);
    const cells = row.map((c) => c.trim());
    if (cells.some((c) => c !== "")) rows.push({ line: start, cells });
    row = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === "") {
      cell = "";
      quoted = true;
    } else if (ch === d) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      start = line;
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

export function parseDelimited(text: string, d: Delimiter): string[][] {
  return parseDelimitedLines(text, d).map((r) => r.cells);
}

export interface ImportTable {
  encoding: ImportEncoding;
  delimiter: Delimiter;
  headers: string[];
  /** datové řádky (bez hlavičky); `line` = číslo řádku v souboru (hlavička = 1) */
  rows: { line: number; cells: string[] }[];
  preset: ImportPreset | null;
  mapping: ImportMapping;
}

export class ImportFileError extends Error {}

/** Soubor → tabulka s rozpoznaným exportem a navrženým přiřazením sloupců. */
export function readImportFile(bytes: Uint8Array): ImportTable {
  if (bytes.byteLength === 0) throw new ImportFileError("Soubor je prázdný.");
  if (bytes.byteLength > IMPORT_LIMITS.maxBytes) throw new ImportFileError("Soubor je větší než 1 MB. Rozdělte ho na menší části.");
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) throw new ImportFileError("Soubor Excelu (.xlsx) neumíme načíst. V Excelu ho uložte jako „CSV (oddělený středníkem)“ a nahrajte znovu.");
  const { text: raw, encoding } = decodeImportFile(bytes);
  let text = raw;
  let delimiter: Delimiter | null = null;
  let offset = 0;
  // Excel umí na první řádek napsat „sep=;“
  const sep = /^sep=([;,\t])[^\S\r\n]*(\r?\n|$)/i.exec(text);
  if (sep) {
    delimiter = sep[1] as Delimiter;
    text = text.slice(sep[0].length);
    offset = 1;
  }
  delimiter ??= detectDelimiter(text);
  const all = parseDelimitedLines(text, delimiter).map((r) => ({ line: r.line + offset, cells: r.cells }));
  if (all.length < 2) throw new ImportFileError("V souboru chybí hlavička nebo řádky se zbožím. První řádek má obsahovat názvy sloupců.");
  const [head, ...rows] = all;
  const headers = head!.cells;
  if (rows.length > IMPORT_LIMITS.maxRows) throw new ImportFileError(`Soubor má ${rows.length} řádků se zbožím. Najednou jich jde naimportovat nejvýš ${IMPORT_LIMITS.maxRows.toLocaleString("cs-CZ")}.`);
  const preset = detectPreset(headers);
  return { encoding, delimiter, headers, rows, preset, mapping: preset ? presetMapping(headers, preset) : guessMapping(headers) };
}

export function detectPreset(headers: readonly string[]): ImportPreset | null {
  const set = new Set(headers.map(normalizeHeader));
  return IMPORT_PRESETS.find((p) => p.detect.every((h) => set.has(normalizeHeader(h)))) ?? null;
}

export function presetMapping(headers: readonly string[], preset: ImportPreset): ImportMapping {
  const norm = headers.map(normalizeHeader);
  const m: ImportMapping = {};
  for (const [field, names] of Object.entries(preset.columns) as [ImportField, readonly string[]][]) {
    for (const n of names) {
      const i = norm.indexOf(normalizeHeader(n));
      if (i >= 0) {
        m[field] = i;
        break;
      }
    }
  }
  return m;
}

/** Obecné přiřazení podle názvů sloupců; každý sloupec nejvýš jednomu poli. */
export function guessMapping(headers: readonly string[]): ImportMapping {
  const norm = headers.map(normalizeHeader);
  const m: ImportMapping = {};
  const used = new Set<number>();
  const take = (field: ImportField, i: number) => {
    if (i < 0 || used.has(i) || m[field] !== undefined) return;
    m[field] = i;
    used.add(i);
  };
  // 1) přesné názvy; „bez DPH“ dřív než obecná „cena“
  for (const field of ["priceNet", "name", "price", "vat", "category", "code", "variant"] as const) {
    for (const alias of ALIASES[field]) take(field, norm.indexOf(alias));
  }
  // 2) volnější shoda: „Cena za kus s DPH (Kč)“, „Sazba DPH v %“
  norm.forEach((h, i) => {
    if (used.has(i)) return;
    if (/\bbez dph\b/.test(h) && /\bcen/.test(h)) take("priceNet", i);
    else if (/^(prodejni )?cena\b/.test(h) || /\bprice\b/.test(h)) take("price", i);
    else if (/\b(dph|vat|sazba)\b/.test(h)) take("vat", i);
    else if (/^nazev\b/.test(h)) take("name", i);
    else if (/\b(ean|plu|kod|sku|barcode)\b/.test(h)) take("code", i);
    else if (/^kategor/.test(h)) take("category", i);
  });
  return m;
}

/* ───────────── hodnoty ───────────── */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Cena v Kč → haléře. Prázdná buňka = null. */
export function parsePrice(raw: string): Parsed<number> | null {
  let s = raw.replace(/[\s  ']/g, "").replace(/(kč|kc|czk)/gi, "").replace(/[,.]-$/, "");
  if (s === "") return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  // obojí („1.234,50“ / „1,234.50“): desetinný je ten poslední, druhý odděluje tisíce
  if (lastComma >= 0 && lastDot >= 0) s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return { ok: false, error: `Cenu „${raw}“ nelze přečíst.` };
  let dec = m[2] ?? "";
  if (dec.length > 2) {
    // „45.0000“ je v pořádku; „1.500“ může být 1 500 Kč i 1,50 Kč – raději se zeptáme
    if (dec.length === 3 || /[^0]/.test(dec.slice(2))) return { ok: false, error: `Cena „${raw}“ je nejasná – použijte desetinnou čárku a nejvýš 2 desetinná místa.` };
    dec = dec.slice(0, 2);
  }
  const halere = Number(m[1]) * 100 + Number(dec.padEnd(2, "0"));
  if (negative || halere <= 0) return { ok: false, error: "Cena musí být větší než 0 Kč." };
  if (!Number.isSafeInteger(halere) || halere > IMPORT_LIMITS.maxPrice) return { ok: false, error: "Cena je vyšší než 10 milionů Kč." };
  return { ok: true, value: halere };
}

const VAT_WORDS: Record<string, number> = { zakladni: 21, snizena: 12, "prvni snizena": 12, nulova: 0, osvobozeno: 0, "bez dph": 0 };

/** Sazba DPH v % (0, 12, 21). Prázdná buňka = null. Přijme „21“, „21 %“, „21,0“, „0,21“ i „základní“. */
export function parseVat(raw: string): Parsed<number> | null {
  const s = raw.trim();
  if (s === "") return null;
  const word = VAT_WORDS[normalizeHeader(s)];
  if (word !== undefined) return { ok: true, value: word };
  const num = Number(s.replace(/[%\s ]/g, "").replace(",", "."));
  if (!Number.isFinite(num)) return { ok: false, error: `Sazbu DPH „${raw}“ nelze přečíst.` };
  const pct = num > 0 && num < 1 ? Math.round(num * 100) : num;
  if (!(VAT_RATES as readonly number[]).includes(pct)) return { ok: false, error: "Sazba DPH musí být 0, 12 nebo 21 %." };
  return { ok: true, value: pct };
}

/* ───────────── náhled ───────────── */

export type ImportStatus = "ok" | "error" | "duplicate" | "skipped";

export interface ImportRow {
  line: number;
  name: string;
  /** cena s DPH v haléřích */
  price: number | null;
  vatRate: number;
  category: string | null;
  code: string | null;
  status: ImportStatus;
  message?: string;
}

export interface PreviewOptions {
  vatPayer: boolean;
  /** sazba pro řádky bez sazby (jen plátce DPH) */
  defaultVat?: number;
  /** názvy, které už v katalogu jsou */
  existingNames?: readonly string[];
  /** kolik položek už katalog má (kvůli limitu IMPORT_LIMITS.maxCatalog) */
  existingCount?: number;
}

export interface ImportPreview {
  rows: ImportRow[];
  /** co se pošle na server – v pořadí podle kategorie (první výskyt) a pak podle souboru; kategorie a kód jen když jsou */
  items: { name: string; price: number; vatRate: number; category?: string; ean?: string }[];
  counts: Record<ImportStatus, number>;
  notices: string[];
}

const cell = (cells: readonly string[], i: number | undefined) => (i === undefined ? "" : (cells[i] ?? "").trim());

export function buildPreview(table: Pick<ImportTable, "rows">, mapping: ImportMapping, opts: PreviewOptions): ImportPreview {
  const notices: string[] = [];
  const defaultVat = opts.vatPayer ? (opts.defaultVat ?? 21) : 0;
  if (mapping.name === undefined) notices.push("Vyberte sloupec s názvem zboží.");
  if (mapping.price === undefined && mapping.priceNet === undefined) notices.push("Vyberte sloupec s cenou.");

  const existing = new Set((opts.existingNames ?? []).map(nameKey));
  const seen = new Map<string, number>();
  const rows: ImportRow[] = [];
  let parentIndex = -1;
  let parentName = "";
  let vatDefaulted = 0;
  let vatIgnored = false;

  for (const { line, cells } of table.rows) {
    const variant = cell(cells, mapping.variant).replace(/\s+/g, " ");
    // zalomení řádku nebo tabulátor v názvu (buňka v uvozovkách) → mezera; tlačítko pokladny má jeden řádek
    let name = cell(cells, mapping.name).replace(/\s+/g, " ");
    let category = cell(cells, mapping.category) || null;
    // SumUp: varianta je na řádku pod položkou (název prázdný, nebo stejný jako u položky); kategorii převezme z položky
    if (variant && parentIndex >= 0 && (name === "" || nameKey(name) === nameKey(parentName))) {
      name = `${parentName} – ${variant}`;
      const parent = rows[parentIndex]!;
      category ??= parent.category;
      if (parent.status === "error" && parent.price === null) {
        parent.status = "skipped";
        parent.message = "Položka s variantami – importujeme varianty.";
      }
    } else if (name !== "") {
      parentName = name;
      parentIndex = rows.length;
    }
    const row: ImportRow = { line, name, price: null, vatRate: defaultVat, category, code: cell(cells, mapping.code) || null, status: "ok" };
    rows.push(row);
    const fail = (message: string) => {
      row.status = "error";
      row.message = message;
    };

    if (mapping.deleted !== undefined && cell(cells, mapping.deleted) === "1") {
      row.status = "skipped";
      row.message = "Smazaný produkt – neimportujeme.";
      continue;
    }
    if (name === "") {
      fail("Chybí název.");
      continue;
    }
    if (name.length > IMPORT_LIMITS.nameMax) {
      fail(`Název má víc než ${IMPORT_LIMITS.nameMax} znaků.`);
      continue;
    }

    // sazba DPH: neplátce má vždy 0 %
    const vat = parseVat(cell(cells, mapping.vat));
    if (opts.vatPayer) {
      if (vat && !vat.ok) {
        fail(vat.error);
        continue;
      }
      if (vat?.ok) row.vatRate = vat.value;
      else vatDefaulted++;
    } else if (vat?.ok && vat.value !== 0) vatIgnored = true;

    const gross = parsePrice(cell(cells, mapping.price));
    if (gross && !gross.ok) {
      fail(gross.error);
      continue;
    }
    if (gross?.ok) row.price = gross.value;
    else {
      const net = parsePrice(cell(cells, mapping.priceNet));
      if (net && !net.ok) {
        fail(net.error);
        continue;
      }
      if (!net) {
        fail("Chybí cena.");
        continue;
      }
      row.price = Math.round((net.value * (100 + row.vatRate)) / 100);
      if (row.price > IMPORT_LIMITS.maxPrice) {
        fail("Cena je vyšší než 10 milionů Kč.");
        continue;
      }
    }

    const key = nameKey(name);
    if (existing.has(key)) {
      row.status = "duplicate";
      row.message = "Položka s tímto názvem už v katalogu je.";
    } else if (seen.has(key)) {
      row.status = "duplicate";
      row.message = `Stejný název je už na řádku ${seen.get(key)}.`;
    } else seen.set(key, line);
  }

  if (vatDefaulted > 0) notices.push(`U ${vatDefaulted} ${vatDefaulted === 1 ? "položky" : "položek"} chybí sazba DPH – nastavíme ${defaultVat} %. Zkontrolujte ji.`);
  if (vatIgnored) notices.push("Nejste plátce DPH – sazby ze souboru nepoužijeme, všechny položky budou s 0 %.");

  const ok = rows.filter((r) => r.status === "ok");
  // tlačítka jedné kategorie vedle sebe: kategorie v pořadí prvního výskytu, uvnitř pořadí souboru
  const order = new Map<string, number>();
  for (const r of ok) if (!order.has(r.category ?? "")) order.set(r.category ?? "", order.size);
  const sorted = ok.map((r, i) => ({ r, i })).sort((a, b) => order.get(a.r.category ?? "")! - order.get(b.r.category ?? "")! || a.i - b.i);
  let items = sorted.map(({ r }) => ({
    name: r.name,
    price: r.price!,
    vatRate: r.vatRate,
    // delší kategorie / kód se zkrátí (do katalogu se jinak nevejdou); prázdné se neposílají
    ...(r.category ? { category: r.category.replace(/\s+/g, " ").slice(0, IMPORT_LIMITS.categoryMax) } : {}),
    ...(r.code ? { ean: r.code.replace(/\s+/g, "").slice(0, IMPORT_LIMITS.codeMax) } : {}),
  }));

  const room = IMPORT_LIMITS.maxCatalog - (opts.existingCount ?? 0);
  if (items.length > room) {
    notices.push(`Katalog pojme nejvýš ${IMPORT_LIMITS.maxCatalog.toLocaleString("cs-CZ")} položek. Naimportujeme prvních ${Math.max(0, room)}.`);
    items = items.slice(0, Math.max(0, room));
  }

  const counts: Record<ImportStatus, number> = { ok: 0, error: 0, duplicate: 0, skipped: 0 };
  for (const r of rows) counts[r.status]++;
  return { rows, items, counts, notices };
}
