/**
 * ČSÚ „Registr ekonomických subjektů – otevřená data“ (RES) — streamovací CSV parser
 * bez závislostí a mapování řádků RES na řádky tabulky `firms`.
 *
 * Datová sada (CC BY 4.0, aktualizace 2× měsíčně – stav k 15. a k poslednímu dni měsíce):
 *   https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv       (~540 MB, ~3,5 mil. řádků)
 *   https://opendata.csu.gov.cz/soubory/od/od_org03/res_pf_nace.csv    (~1 GB, všechny obory CZ-NACE)
 *   metadata CSVW: stejná URL s příponou `-metadata.json` (např. res_data-metadata.json)
 *   dokumentace:   https://csu.gov.cz/statistika/registr-ekonomickych-subjektu-otevrena-data-dokumentace
 *
 * Formát (dle dokumentace ČSÚ a nezávislého importéru github.com/dantopol99-bit/da.firemnidatabaze):
 * oddělovač čárka, uvozovky ", UTF-8, hlavička v 1. řádku, data ve formátu YYYY-MM-DD.
 * Parser je přesto tolerantní: BOM, CRLF/LF/CR, pole s/bez uvozovek, zdvojené uvozovky.
 *
 * Mapování sloupců je záměrně na jednom místě (`RES_COLUMNS`) — pokud ČSÚ sloupec
 * přejmenuje, stačí opravit zde.
 */
import { normalizeIco, isValidIco } from "./ico.ts";
import { isNaturalPerson } from "./legal-form.ts";
import { classifyNaceList, type EetRelevance } from "./nace.ts";
import { slugify } from "./slug.ts";

/* ─────────────────────────────── CSV parser ─────────────────────────────── */

export interface CsvOptions {
  /** oddělovač polí, výchozí "," */
  delimiter?: string;
}

const QUOTE = 34; // "
const LF = 10;
const CR = 13;

/**
 * Inkrementální (push) CSV parser podle RFC 4180 s tolerancí k běžným odchylkám.
 * `push()` lze volat s libovolně rozsekanými kusy textu — stav se přenáší mezi voláními.
 */
export class CsvParser {
  private readonly delim: number;
  private field = "";
  private row: string[] = [];
  private inQuotes = false;
  /** v uvozovkách jsme narazili na `"` — rozhodne až další znak (`""` = escapovaná uvozovka) */
  private quotePending = false;
  /** aktuální pole začínalo uvozovkou (odliší `""` od prázdného řádku) */
  private fieldQuoted = false;
  private atFieldStart = true;
  private pendingCR = false;
  private started = false;

  constructor(opts: CsvOptions = {}) {
    const d = opts.delimiter ?? ",";
    if (d.length !== 1 || d === '"' || d === "\n" || d === "\r") throw new Error("Neplatný oddělovač CSV");
    this.delim = d.charCodeAt(0);
  }

  /** Zpracuje kus textu a vrátí kompletní řádky (do `out`, pokud je předán). */
  push(chunk: string, out: string[][] = []): string[][] {
    let s = chunk;
    if (!this.started) {
      if (s.length === 0) return out;
      this.started = true;
      if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    }
    const n = s.length;
    const d = this.delim;
    let i = 0;
    while (i < n) {
      if (this.inQuotes) {
        if (this.quotePending) {
          this.quotePending = false;
          if (s.charCodeAt(i) === QUOTE) {
            this.field += '"';
            i++;
            continue;
          }
          this.inQuotes = false; // uzavírací uvozovka; znak zpracujeme níže v režimu bez uvozovek
          continue;
        }
        const q = s.indexOf('"', i);
        if (q === -1) {
          this.field += s.slice(i);
          i = n;
          break;
        }
        this.field += s.slice(i, q);
        this.quotePending = true;
        i = q + 1;
        continue;
      }

      const c = s.charCodeAt(i);
      if (this.pendingCR) {
        this.pendingCR = false;
        if (c === LF) {
          i++;
          continue;
        }
      }
      if (c === d) {
        this.row.push(this.field);
        this.field = "";
        this.fieldQuoted = false;
        this.atFieldStart = true;
        i++;
      } else if (c === LF || c === CR) {
        this.endRow(out);
        if (c === CR) this.pendingCR = true;
        i++;
      } else if (c === QUOTE && this.atFieldStart) {
        this.inQuotes = true;
        this.fieldQuoted = true;
        this.atFieldStart = false;
        i++;
      } else {
        // rychlá cesta: najdi další speciální znak a přidej celý úsek najednou
        let j = i + 1;
        while (j < n) {
          const cj = s.charCodeAt(j);
          if (cj === d || cj === LF || cj === CR || cj === QUOTE) break;
          j++;
        }
        // uvozovka uprostřed neuvozeného pole se bere doslova
        if (j < n && s.charCodeAt(j) === QUOTE) j++;
        this.field += s.slice(i, j);
        this.atFieldStart = false;
        i = j;
      }
    }
    return out;
  }

  /** Dokončí poslední řádek (soubor nemusí končit novým řádkem). */
  end(out: string[][] = []): string[][] {
    if (this.quotePending) {
      this.quotePending = false;
      this.inQuotes = false;
    }
    this.inQuotes = false;
    this.pendingCR = false;
    this.endRow(out);
    return out;
  }

  private endRow(out: string[][]): void {
    const empty = this.row.length === 0 && this.field === "" && !this.fieldQuoted;
    if (!empty) {
      this.row.push(this.field);
      out.push(this.row);
    }
    this.row = [];
    this.field = "";
    this.fieldQuoted = false;
    this.atFieldStart = true;
  }
}

/** Celý text najednou (testy, malé soubory). */
export function parseCsv(text: string, opts?: CsvOptions): string[][] {
  const p = new CsvParser(opts);
  const out = p.push(text);
  return p.end(out);
}

/** Řádky CSV ze streamu textu nebo bajtů (UTF-8, dekódováno inkrementálně). */
export async function* csvRows(source: AsyncIterable<string | Uint8Array>, opts?: CsvOptions): AsyncGenerator<string[]> {
  const parser = new CsvParser(opts);
  const decoder = new TextDecoder("utf-8");
  let buf: string[][] = [];
  for await (const chunk of source) {
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    parser.push(text, buf);
    if (buf.length) {
      const rows = buf;
      buf = [];
      yield* rows;
    }
  }
  const tail = decoder.decode();
  if (tail) parser.push(tail, buf);
  parser.end(buf);
  yield* buf;
}

/** Záznamy podle hlavičky (1. řádek). Klíče = názvy sloupců oříznuté o mezery. */
export async function* csvRecords(
  source: AsyncIterable<string | Uint8Array>,
  opts?: CsvOptions & { onHeader?: (header: string[]) => void },
): AsyncGenerator<Record<string, string>> {
  let header: string[] | null = null;
  for await (const row of csvRows(source, opts)) {
    if (!header) {
      header = row.map((h) => h.trim());
      opts?.onHeader?.(header);
      continue;
    }
    const rec: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) rec[header[i]!] = row[i] ?? "";
    yield rec;
  }
}

/* ─────────────────────────────── RES → firms ─────────────────────────────── */

export const RES_DATA_URL = "https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv";
export const RES_PF_NACE_URL = "https://opendata.csu.gov.cz/soubory/od/od_org03/res_pf_nace.csv";

/**
 * Sloupce `res_data.csv` (pořadí v souboru: ICO, OKRESLAU, DDATVZN, DDATZAN, ZPZAN, DDATPAKT,
 * FORMA, ROSFORMA, KATPO, NACE, NACE2025, ICZUJ, FIRMA, CISS2010, KODADM, TEXTADR, PSC,
 * OBEC_TEXT, COBCE_TEXT, ULICE_TEXT, TYPCDOM, CDOM, COR, DATPLAT, PRIZNAK).
 * Klíč = naše pole, hodnota = název sloupce v CSV.
 */
export const RES_COLUMNS = {
  /** IČO, 8 číslic (doplněno nulami; pro jistotu normalizujeme) */
  ico: "ICO",
  /** obchodní firma / jméno a příjmení u fyzických osob */
  name: "FIRMA",
  /** právní forma, číselník ČSÚ 56 */
  legalForm: "FORMA",
  /** právní forma dle ROS, číselník 149 — záloha, když FORMA chybí */
  legalFormAlt: "ROSFORMA",
  /** datum vzniku */
  foundedAt: "DDATVZN",
  /** datum zániku (prázdné = aktivní subjekt) */
  dissolvedAt: "DDATZAN",
  /** datum poslední aktualizace záznamu v RES */
  updatedAt: "DDATPAKT",
  /** převažující činnost CZ-NACE Rev. 2 (číselník 80004); může být oddíl, skupina, třída i podtřída; "00" = neuvedeno */
  nace: "NACE",
  /** okres sídla, CZ-NUTS LAU 1 (číselník 109), např. CZ0412 */
  district: "OKRESLAU",
  /** základní územní jednotka sídla (číselník 51) — u obcí bez městských částí = kód obce */
  municipalityCode: "ICZUJ",
  /** kód adresního místa RÚIAN */
  addressPointCode: "KODADM",
  /** textová adresa, pokud chybí KODADM */
  addressText: "TEXTADR",
  postalCode: "PSC",
  city: "OBEC_TEXT",
  cityPart: "COBCE_TEXT",
  street: "ULICE_TEXT",
  /** typ čísla domovního (1 = č. p., 2 = č. ev. — předpoklad, ověřit v číselníku) */
  houseNumberType: "TYPCDOM",
  houseNumber: "CDOM",
  orientationNumber: "COR",
  /** datum stavu (snímku) — v celém souboru stejné */
  snapshotDate: "DATPLAT",
  /** P = nový subjekt, Z = změna oproti minulému snímku, prázdné = beze změny */
  changeFlag: "PRIZNAK",
} as const;

/** Sloupce `res_pf_nace.csv`: všechny činnosti subjektu (průměrně ~3 na subjekt). */
export const RES_PF_COLUMNS = {
  ico: "ICO",
  /** zdroj údaje (číselník 564) */
  source: "ZDRUD",
  /** číselník hodnoty: 80004 = CZ-NACE Rev. 2, 80143 = CZ-NACE 2025, 56 = právní forma */
  codeList: "KODCIS",
  value: "HODN",
} as const;

export const RES_CODELIST_NACE = "80004";

/**
 * Kraj z okresu: prvních 5 znaků kódu LAU 1 je kód NUTS 3 (kraje). Hodnoty = kódy VÚSC
 * dle RÚIAN (shodné s `sidlo.kodKraje` v ARES a s `KRAJE` v regions.ts).
 */
export const NUTS3_TO_KRAJ: Readonly<Record<string, number>> = {
  CZ010: 19, // Hlavní město Praha
  CZ020: 27, // Středočeský
  CZ031: 35, // Jihočeský
  CZ032: 43, // Plzeňský
  CZ041: 51, // Karlovarský
  CZ042: 60, // Ústecký
  CZ051: 78, // Liberecký
  CZ052: 86, // Královéhradecký
  CZ053: 94, // Pardubický
  CZ063: 108, // Vysočina
  CZ064: 116, // Jihomoravský
  CZ071: 124, // Olomoucký
  CZ072: 141, // Zlínský
  CZ080: 132, // Moravskoslezský
};

export function regionCodeFromOkresLau(code: string | null | undefined): number | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!/^CZ0\d{2}/.test(c)) return null;
  return NUTS3_TO_KRAJ[c.slice(0, 5)] ?? null;
}

export interface ResFirm {
  ico: string;
  /** může být prázdné u zaniklých fyzických osob (RES u nich uvádí jen IČO a datum zániku) */
  name: string;
  slug: string;
  legalForm: string | null;
  isNaturalPerson: boolean;
  foundedAt: string | null;
  dissolvedAt: string | null;
  updatedAt: string | null;
  /** ulice + číslo; u fyzických osob vždy null (minimalizace údajů — adresa sídla OSVČ bývá bydliště) */
  street: string | null;
  city: string | null;
  cityCode: number | null;
  postalCode: string | null;
  regionCode: number | null;
  addressPointCode: number | null;
  nace: string[];
  eetRelevance: EetRelevance;
  snapshotDate: string | null;
  changeFlag: string | null;
}

function clean(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Datum z RES → ISO `YYYY-MM-DD`. Toleruje i `D.M.YYYY` a `YYYYMMDD`. */
export function parseResDate(v: string | undefined | null): string | null {
  const t = clean(v);
  if (!t) return null;
  let y: number, m: number, d: number;
  let match = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = t.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = t.match(/^(\d{4})(\d{2})(\d{2})$/))) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  if (y < 1800 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Kód CZ-NACE → jen číslice; pseudokód "00"/"0" a samotné sekce (písmena) vynecháme. */
export function normalizeNaceCode(v: string | undefined | null): string | null {
  const t = clean(v);
  if (!t) return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 2 || /^0+$/.test(digits)) return null;
  return digits;
}

function intOrNull(v: string | null): number | null {
  if (!v || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

function resStreet(rec: Record<string, string>): string | null {
  const street = clean(rec[RES_COLUMNS.street]);
  const part = clean(rec[RES_COLUMNS.cityPart]);
  const city = clean(rec[RES_COLUMNS.city]);
  const typ = clean(rec[RES_COLUMNS.houseNumberType]);
  const cdom = clean(rec[RES_COLUMNS.houseNumber]);
  const cor = clean(rec[RES_COLUMNS.orientationNumber]);
  let num = cdom ? (typ === "2" ? `č. ev. ${cdom}` : cdom) : "";
  if (cor) num = num ? `${num}/${cor}` : cor;
  if (street) return num ? `${street} ${num}` : street;
  // bez ulice: ARES uvádí část obce + číslo (např. „Bražec 12“)
  if (!num) return null;
  return `${part ?? city ?? ""} ${num}`.trim();
}

export interface MapResOptions {
  /** uložit ulici i u fyzických osob (výchozí ne — nikdy ji nezobrazujeme) */
  keepNaturalPersonStreet?: boolean;
}

/**
 * Jeden záznam `res_data.csv` → řádek pro `firms`. `null` = neplatné IČO.
 * Zaniklé subjekty vrací s `dissolvedAt` (importér je jen označí, nové nezakládá).
 */
export function mapResRow(rec: Record<string, string>, opts: MapResOptions = {}): ResFirm | null {
  const ico = normalizeIco(clean(rec[RES_COLUMNS.ico]) ?? "");
  if (!ico || !isValidIco(ico)) return null;

  const name = (clean(rec[RES_COLUMNS.name]) ?? "").replace(/\s+/g, " ");
  const legalForm = clean(rec[RES_COLUMNS.legalForm]) ?? clean(rec[RES_COLUMNS.legalFormAlt]);
  const natural = isNaturalPerson(legalForm);
  const naceCode = normalizeNaceCode(rec[RES_COLUMNS.nace]);
  const nace = naceCode ? [naceCode] : [];
  const psc = clean(rec[RES_COLUMNS.postalCode])?.replace(/\s/g, "") ?? null;

  return {
    ico,
    name,
    slug: slugify(name, 80) || "subjekt",
    legalForm: legalForm ? legalForm.slice(0, 4) : null,
    isNaturalPerson: natural,
    foundedAt: parseResDate(rec[RES_COLUMNS.foundedAt]),
    dissolvedAt: parseResDate(rec[RES_COLUMNS.dissolvedAt]),
    updatedAt: parseResDate(rec[RES_COLUMNS.updatedAt]),
    street: natural && !opts.keepNaturalPersonStreet ? null : resStreet(rec),
    city: clean(rec[RES_COLUMNS.city]),
    cityCode: intOrNull(clean(rec[RES_COLUMNS.municipalityCode])),
    postalCode: psc && /^\d{5}$/.test(psc) ? psc : null,
    regionCode: regionCodeFromOkresLau(rec[RES_COLUMNS.district]),
    addressPointCode: intOrNull(clean(rec[RES_COLUMNS.addressPointCode])),
    nace,
    eetRelevance: classifyNaceList(nace).relevance,
    snapshotDate: parseResDate(rec[RES_COLUMNS.snapshotDate]),
    changeFlag: clean(rec[RES_COLUMNS.changeFlag]),
  };
}

/** Řádek `res_pf_nace.csv` → { ico, nace } jen pro CZ-NACE Rev. 2; jinak null. */
export function mapResPfNaceRow(rec: Record<string, string>): { ico: string; nace: string } | null {
  if (clean(rec[RES_PF_COLUMNS.codeList]) !== RES_CODELIST_NACE) return null;
  const ico = normalizeIco(clean(rec[RES_PF_COLUMNS.ico]) ?? "");
  const nace = normalizeNaceCode(rec[RES_PF_COLUMNS.value]);
  if (!ico || !nace) return null;
  return { ico, nace };
}

/** Chybějící povinné sloupce v hlavičce (pro včasné selhání importu). */
export function missingResColumns(header: readonly string[]): string[] {
  const required = [RES_COLUMNS.ico, RES_COLUMNS.name, RES_COLUMNS.legalForm, RES_COLUMNS.foundedAt, RES_COLUMNS.dissolvedAt, RES_COLUMNS.nace];
  return required.filter((c) => !header.includes(c));
}

/* ─────────────────────── RŽP: předmět podnikání → EET relevance ─────────────────────── */

/**
 * Heuristika pro provozovny podle názvů živností z RŽP (např. „Hostinská činnost“).
 * Sdílí ji worker (enrich) i web (živý náhled z ARES). Stejně jako u CZ-NACE nejde
 * o právní posouzení. `null` = z názvů nelze nic usoudit (použijte relevanci firmy).
 */
const TRADE_RULES: readonly { re: RegExp; relevance: EetRelevance }[] = [
  { re: /hostinsk|holicstvi|kadernictvi|kosmetick|pedikur|manikur|maser|regeneracn|solari|ubytovac|pekarstvi|cukrarstvi|reznictvi|uzenarstvi|taxi|ocni optik|osobniho charakteru|osobni hygien|telovychovn|sportovnich sluzeb|maloobchod|opravy silnicnich vozidel/, relevance: "likely" },
  { re: /cestovni kancelar|cestovni agentur|fotografick|mimoskolni vychov|vzdelavani|pujcovn|truhlarstvi|zamecnictvi|instalaterstvi|topenarstvi|elektroinstal|hodinarstvi|zlatnictvi|cisteni|pradlen|cistirn|zednictvi|malirstvi|pokryvacstvi|kominictvi|silnicni motorova doprava|opravy/, relevance: "possible" },
  { re: /velkoobchod|ucetni|ucetnictvi|danov|projektov|inzenyrsk|programov|realitni|zprostredkovani obchodu|poradenstvi|vyzkum|reklamn|pronajem nemovitost/, relevance: "unlikely" },
];

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function classifyTrades(trades: readonly string[]): EetRelevance | null {
  let best: EetRelevance | null = null;
  const order: Record<EetRelevance, number> = { likely: 3, possible: 2, unlikely: 1 };
  for (const t of trades) {
    const f = fold(t);
    for (const rule of TRADE_RULES) {
      if (rule.re.test(f)) {
        if (!best || order[rule.relevance] > order[best]) best = rule.relevance;
        break;
      }
    }
  }
  return best;
}
