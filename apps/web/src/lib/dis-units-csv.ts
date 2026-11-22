/**
 * S12 (22. 11. 2026): soubor CSV pro hromadný import evidenčních jednotek do DIS+ podle dokumentu GFŘ „Import evidenčních
 * jednotek EET – popis struktury CSV souboru“ (verze 1.0, 3. 11. 2026, SOURCES.fsImportJednotekCsv). Čistá logika bez DB.
 *
 * Formát: oddělovač „;“, bez hlavičky, jeden řádek = jedna jednotka, pevné pořadí 16 polí, nejvýš 500 řádků, řádek do
 * 5 000 znaků, soubor do 5 MB, kódování UTF-8 / ISO 8859-2 / Windows-1250 (posíláme UTF-8 bez BOM). Text nesmí obsahovat
 * „;“, „|“ ani znaky, které nejdou uložit v ISO 8859-2. Pole:
 *   1 název (255) · 2 druh S/M/A/I/D/P · 3 CZ-NACE (číslice 1–6, povinné) · 4 upřesnění činnosti (255)
 *   5 tržby se v jednotce evidují 1/0 (povinné) · 6 nepřímé zastoupení 1/0 (povinné)
 *   7 kód adresního místa RÚIAN (číslice 1–9; S, A, P) · 8 ulice (32) · 9 č. p./č. ev. (10) · 10 č. or. (10)
 *   11 obec (48) · 12 část obce (48) · 13 PSČ (5 číslic) – pole 8–13 prázdná, je-li vyplněno pole 7
 *   14 lokalizace volným textem (255; povinná u M, I, D, u A bez adresy) · 15 druh dopravního prostředku (D)
 *   16 upřesnění druhu (150; D a druh J)
 *
 * K ověření v DIS+ (dokument to neříká): konec řádku (posíláme CRLF), jak DIS+ vrací chyby a zda import umí jednotky
 * měnit – proto typicky exportujeme jen jednotky, které ještě nemají číslo z DIS+.
 */

export type DisUnitTypeCode = "S" | "M" | "A" | "I" | "D" | "P";

/** Naše typy jednotek (pgEnum unit_type) → druh evidenční jednotky v CSV. */
export const DIS_UNIT_CODE: Record<string, DisUnitTypeCode> = {
  stala_provozovna: "S",
  mobilni_provozovna: "M",
  automat: "A",
  internetova_stranka: "I",
  dopravni_prostredek: "D",
  osoba: "P",
};

/** Druh dopravního prostředku (pole 15). */
export const VEHICLE_TYPES = {
  A: "Automobil",
  N: "Nákladní automobil",
  B: "Autobus",
  M: "Motocykl",
  V: "Vlak",
  T: "Tramvaj",
  P: "Plavidlo",
  L: "Letadlo",
  J: "Jiný (upřesněte)",
} as const;
export type VehicleType = keyof typeof VEHICLE_TYPES;

export const DIS_CSV_MAX_ROWS = 500;
export const DIS_CSV_MAX_LINE = 5000;
export const DIS_CSV_MAX_BYTES = 5 * 1024 * 1024;

export const CZ_NACE_RE = /^\d{1,6}$/;
export const RUIAN_RE = /^\d{1,9}$/;

export interface DisUnitInput {
  label: string;
  type: string;
  czNace: string | null;
  ruianCode: string | null;
  address: string | null;
  locationText: string | null;
  vehicleType: string | null;
  vehicleNote: string | null;
  indirectRepresentation: boolean;
}

export interface ParsedAddress {
  street: string;
  houseNumber: string;
  orientationNumber: string;
  municipality: string;
  municipalityPart: string;
  postalCode: string;
}

/**
 * Adresa z volného textu (pole „Adresa“ v nastavení – tiskne se na účtenku) ve tvaru, jaký používá RÚIAN:
 *   „Chebská 38/5, Dvory, 360 06 Karlovy Vary“, „Masarykova 12, 360 01 Karlovy Vary“, „č. p. 12, 252 26 Kosoř“.
 * Jiný tvar → null (pak je potřeba kód adresního místa). Ulice se nekontroluje proti RÚIAN – ověří ji až DIS+.
 */
export function parseCzAddress(text: string | null | undefined): ParsedAddress | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  const m =
    /^(?:(?<street>[^,]*?[^\d\s,./])\s+)?(?:č\.\s?p\.\s?|č\.\s?ev\.\s?)?(?<cp>\d{1,6}[a-zA-Z]?)(?:\s?\/\s?(?<co>\d{1,5}[a-zA-Z]?))?\s?,\s?(?:(?<part>[^,\d][^,]*?)\s?,\s?)?(?<psc>\d{3}\s?\d{2})\s(?<obec>[^,\d][^,]*)$/u.exec(
      t,
    );
  if (!m?.groups) return null;
  const g = m.groups;
  const municipality = g.obec!.trim();
  const municipalityPart = (g.part ?? "").trim();
  let street = (g.street ?? "").trim();
  // obec bez ulic („Kosoř 12, 252 26 Kosoř“): název obce či části obce není ulice
  if ([municipality, municipalityPart].some((x) => x && x.localeCompare(street, "cs", { sensitivity: "base" }) === 0)) street = "";
  return {
    street,
    houseNumber: g.cp!,
    orientationNumber: g.co ?? "",
    municipality,
    municipalityPart,
    postalCode: g.psc!.replace(/\s/g, ""),
  };
}

/** Znaky, které jde uložit v ISO 8859-2 (bajty 0x20–0xFF bez řídicích). */
const LATIN2 = (() => {
  const dec = new TextDecoder("iso-8859-2");
  const set = new Set<string>();
  for (let b = 0x20; b <= 0xff; b++) if (b < 0x7f || b >= 0xa0) set.add(dec.decode(new Uint8Array([b])));
  return set;
})();

/** Typografické znaky → jejich ASCII obdoba; „;“ a „|“ jsou v CSV zakázané. */
function normalizeText(v: string): string {
  return v
    .replace(/[–—−]/g, "-")
    .replace(/[„“”«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/…/g, "...")
    .replace(/[  \t\r\n]/g, " ")
    .replace(/;/g, ",")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function badChars(v: string): string[] {
  return [...new Set([...v].filter((ch) => !LATIN2.has(ch)))];
}

export interface DisUnitProblem {
  label: string;
  problems: string[];
}

export type DisCsvResult = { ok: true; csv: string; rows: number } | { ok: false; units: DisUnitProblem[]; error: string };

/** Jeden řádek CSV (16 polí) nebo seznam toho, co doplnit. */
export function disUnitRow(u: DisUnitInput): { fields: string[] } | { problems: string[] } {
  const problems: string[] = [];
  const code = DIS_UNIT_CODE[u.type];
  if (!code) return { problems: [`Neznámý druh jednotky „${u.type}“.`] };

  const text = (v: string | null | undefined, max: number, name: string): string => {
    const n = normalizeText(v ?? "");
    const bad = badChars(n);
    if (bad.length) problems.push(`${name}: znaky ${bad.map((c) => `„${c}“`).join(", ")} nejdou uložit v kódování, které DIS+ přijímá – nahraďte je.`);
    if (n.length > max) problems.push(`${name}: nejvýš ${max} znaků (teď ${n.length}).`);
    return n;
  };

  const label = text(u.label, 255, "Název");
  const nace = (u.czNace ?? "").trim();
  if (!nace) problems.push("Doplňte převažující činnost – kód CZ-NACE (jen číslice).");
  else if (!CZ_NACE_RE.test(nace)) problems.push("Kód CZ-NACE: jen číslice bez teček, nejvýš 6.");

  const ruian = (u.ruianCode ?? "").trim();
  if (ruian && !RUIAN_RE.test(ruian)) problems.push("Kód adresního místa RÚIAN: jen číslice, nejvýš 9.");
  const location = text(u.locationText, 255, "Lokalizace");
  const addressText = normalizeText(u.address ?? "");

  let addr: ParsedAddress = { street: "", houseNumber: "", orientationNumber: "", municipality: "", municipalityPart: "", postalCode: "" };
  const usesAddress = code === "S" || code === "A" || code === "P";
  if (usesAddress && !ruian) {
    const parsed = parseCzAddress(addressText);
    if (parsed) addr = parsed;
    else if (code === "S" || code === "P" || addressText) {
      problems.push(
        addressText
          ? "Adresu nejde rozdělit na části pro DIS+. Doplňte kód adresního místa RÚIAN, nebo adresu ve tvaru „Ulice 12/3, 360 01 Obec“."
          : "Doplňte kód adresního místa RÚIAN, nebo adresu ve tvaru „Ulice 12/3, 360 01 Obec“.",
      );
    }
    for (const [v, max, name] of [
      [addr.street, 32, "Ulice"],
      [addr.houseNumber, 10, "Číslo popisné"],
      [addr.orientationNumber, 10, "Číslo orientační"],
      [addr.municipality, 48, "Obec"],
      [addr.municipalityPart, 48, "Část obce"],
    ] as const) {
      text(v, max, name);
    }
  }

  if (code === "M" && !location) problems.push("Mobilní provozovna: doplňte popis místa (lokalizaci), kde prodáváte.");
  if (code === "I" && !location) problems.push("Internetová stránka: doplňte adresu webu nebo jiný jednoznačný identifikátor.");
  if (code === "D" && !location) problems.push("Dopravní prostředek: doplňte registrační značku nebo jiný jednoznačný identifikátor.");
  if (code === "A" && !ruian && !addressText && !location) problems.push("Automat: doplňte kód adresního místa, adresu, nebo popis umístění.");

  let vehicle = "";
  let vehicleNote = "";
  if (code === "D") {
    vehicle = (u.vehicleType ?? "").trim().toUpperCase();
    if (!(vehicle in VEHICLE_TYPES)) problems.push("Dopravní prostředek: vyberte druh dopravního prostředku.");
    vehicleNote = text(u.vehicleNote, 150, "Upřesnění druhu dopravního prostředku");
    if (vehicle === "J" && !vehicleNote) problems.push("Druh dopravního prostředku „Jiný“: doplňte krátké upřesnění.");
  }

  if (problems.length) return { problems };
  const fields = [
    label,
    code,
    nace,
    "",
    // tržby se v jednotce evidují – pokladna je pro jednotky, kde evidované tržby přijímáte
    "1",
    u.indirectRepresentation ? "1" : "0",
    usesAddress ? ruian : "",
    usesAddress && !ruian ? addr.street : "",
    usesAddress && !ruian ? addr.houseNumber : "",
    usesAddress && !ruian ? addr.orientationNumber : "",
    usesAddress && !ruian ? addr.municipality : "",
    usesAddress && !ruian ? addr.municipalityPart : "",
    usesAddress && !ruian ? addr.postalCode : "",
    location,
    vehicle,
    vehicleNote,
  ];
  return { fields };
}

/** Celý soubor. Jakákoli chyba → žádný soubor, ale seznam jednotek a toho, co v nich doplnit. */
export function buildDisUnitsCsv(units: readonly DisUnitInput[]): DisCsvResult {
  if (!units.length) return { ok: false, units: [], error: "Žádná evidenční jednotka k importu." };
  if (units.length > DIS_CSV_MAX_ROWS) return { ok: false, units: [], error: `DIS+ přijme v jednom souboru nejvýš ${DIS_CSV_MAX_ROWS} jednotek.` };
  const lines: string[] = [];
  const bad: DisUnitProblem[] = [];
  for (const u of units) {
    const r = disUnitRow(u);
    if ("problems" in r) bad.push({ label: u.label, problems: r.problems });
    else lines.push(r.fields.join(";"));
  }
  if (bad.length) return { ok: false, units: bad, error: "Některým jednotkám chybí údaje pro DIS+. Doplňte je v nastavení pokladny (Evidenční jednotky → Upravit)." };
  const tooLong = lines.findIndex((l) => l.length > DIS_CSV_MAX_LINE);
  if (tooLong >= 0) return { ok: false, units: [{ label: units[tooLong]!.label, problems: [`Řádek má víc než ${DIS_CSV_MAX_LINE} znaků.`] }], error: "Řádek je příliš dlouhý." };
  const csv = `${lines.join("\r\n")}\r\n`;
  if (new TextEncoder().encode(csv).length > DIS_CSV_MAX_BYTES) return { ok: false, units: [], error: "Soubor je větší než 5 MB." };
  return { ok: true, csv, rows: lines.length };
}
