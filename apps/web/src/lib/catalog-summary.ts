import { classifyNace, isNaturalPerson, legalFormName } from "@ez/cz";
import { naceDivisionLabel } from "@/components/catalog/nace-labels";

/**
 * S3 – věta-shrnutí o subjektu pro lidi i AI asistenty a fakturační údaje ke zkopírování. Jen z polí registru:
 * nic nedomýšlíme (žádný „hlavní obor“ – pořadí oborů v ARES převažující činnost neoznačuje).
 */

/** 3. 5. 2015 z ISO data. */
export function dateCs(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : "";
}

/**
 * 6. pád názvu obce s předložkou („v Karlových Varech“). Jen ověřené tvary měst Karlovarského kraje a krajských měst;
 * jinak neutrální „v obci X“, které je gramaticky správně vždy.
 */
const LOCATIVE: Readonly<Record<string, string>> = {
  "Karlovy Vary": "v Karlových Varech",
  Cheb: "v Chebu",
  Sokolov: "v Sokolově",
  "Mariánské Lázně": "v Mariánských Lázních",
  Ostrov: "v Ostrově",
  Aš: "v Aši",
  Chodov: "v Chodově",
  "Františkovy Lázně": "ve Františkových Lázních",
  Nejdek: "v Nejdku",
  Kraslice: "v Kraslicích",
  "Horní Slavkov": "v Horním Slavkově",
  Jáchymov: "v Jáchymově",
  Loket: "v Lokti",
  Habartov: "v Habartově",
  "Nová Role": "v Nové Roli",
  Toužim: "v Toužimi",
  Žlutice: "ve Žluticích",
  "Kynšperk nad Ohří": "v Kynšperku nad Ohří",
  "Lázně Kynžvart": "v Lázních Kynžvart",
  Teplá: "v Teplé",
  Bochov: "v Bochově",
  "Bečov nad Teplou": "v Bečově nad Teplou",
  Hroznětín: "v Hroznětíně",
  Rotava: "v Rotavě",
  Březová: "v Březové",
  Hranice: "v Hranicích",
  Praha: "v Praze",
  Brno: "v Brně",
  Plzeň: "v Plzni",
  Ostrava: "v Ostravě",
  Liberec: "v Liberci",
  Olomouc: "v Olomouci",
  "České Budějovice": "v Českých Budějovicích",
  "Hradec Králové": "v Hradci Králové",
  Pardubice: "v Pardubicích",
  Jihlava: "v Jihlavě",
  Zlín: "ve Zlíně",
  "Ústí nad Labem": "v Ústí nad Labem",
};

export function cityLocative(city: string): string {
  return LOCATIVE[city] ?? `v obci ${city}`;
}

/** Rod podstatného jména právní formy – kvůli shodě „vznikla / vzniklo / vznikl“. */
const FORM_GENDER: Readonly<Record<string, "f" | "n" | "m">> = {
  "111": "f",
  "112": "f",
  "113": "f",
  "121": "f",
  "141": "f",
  "205": "n",
  "706": "m",
  "801": "f",
};

const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

/** „CZ-NACE 96021 – Kadeřnictví a kosmetika“ (náš krátký název skupiny), jinak název oddílu ČSÚ, jinak jen kód. */
export function naceHuman(code: string): string {
  const label = classifyNace(code)?.label ?? naceDivisionLabel(code);
  return label ? `CZ-NACE ${code} – ${label}` : `CZ-NACE ${code}`;
}

export interface SummaryInput {
  name: string;
  ico: string;
  legalForm: string | null;
  isNaturalPerson: boolean;
  city: string | null;
  /** jen u právnických osob – má-li sídlo ulici (jinak „se sídlem“ neříkáme) */
  hasSeat: boolean;
  foundedAt: string | null;
  dissolvedAt: string | null;
  nace: readonly string[];
}

/**
 * „XY s.r.o. (IČO 12345678) je společnost s ručením omezeným se sídlem v Karlových Varech, vznikla 3. 5. 2015.
 * Obor činnosti: CZ-NACE 96021 – Kadeřnictví a kosmetika.“ U OSVČ jen obec, bez adresy.
 */
export function firmSummary(f: SummaryInput): string {
  const natural = f.isNaturalPerson || isNaturalPerson(f.legalForm);
  const form = f.legalForm ? lowerFirst(legalFormName(f.legalForm)) : null;
  const parts: string[] = [];
  if (natural) {
    const who = form && !form.startsWith("právní forma") ? form : "podnikající fyzická osoba";
    parts.push(`${f.name} (IČO ${f.ico}) je ${who}${f.city ? `, obec sídla ${f.city}` : ""}.`);
    if (f.foundedAt) parts.push(`Datum vzniku: ${dateCs(f.foundedAt)}.`);
  } else {
    const gender = f.legalForm ? FORM_GENDER[f.legalForm] : undefined;
    const subject = form && !form.startsWith("právní forma") && form !== "neuvedeno" ? form : "právnická osoba";
    const seat = f.city ? ` se sídlem ${cityLocative(f.city)}` : "";
    const founded = f.foundedAt && gender ? `, ${gender === "f" ? "vznikla" : gender === "n" ? "vzniklo" : "vznikl"} ${dateCs(f.foundedAt)}` : "";
    parts.push(`${f.name} (IČO ${f.ico}) je ${subject}${f.hasSeat || f.city ? seat : ""}${founded}.`);
    if (f.foundedAt && !gender) parts.push(`Datum vzniku: ${dateCs(f.foundedAt)}.`);
  }
  if (f.dissolvedAt) parts.push(`Datum zániku: ${dateCs(f.dissolvedAt)}.`);
  const codes = [...new Set(f.nace)].filter(Boolean);
  if (codes.length === 1) parts.push(`Obor činnosti: ${naceHuman(codes[0]!)}.`);
  else if (codes.length > 1) {
    const shown = codes.slice(0, 2).map(naceHuman).join("; ");
    const rest = codes.length - 2;
    parts.push(`Obory činnosti: ${shown}${rest > 0 ? ` a ${rest} ${rest === 1 ? "další" : rest < 5 ? "další" : "dalších"}` : ""}.`);
  }
  return parts.join(" ");
}

export interface BillingInput {
  name: string;
  ico: string;
  isNaturalPerson: boolean;
  /** u OSVČ vždy null – ulici nezobrazujeme ani nekopírujeme */
  street: string | null;
  postalCode: string | null;
  city: string | null;
  dic: string | null;
}

/** Fakturační údaje ke zkopírování: název, adresa (u OSVČ jen obec), IČO, DIČ (jen u právnických osob). */
export function billingText(f: BillingInput): string {
  const natural = f.isNaturalPerson;
  const lines = [f.name];
  if (!natural && f.street) lines.push(f.street);
  const place = natural ? f.city : [f.postalCode ? f.postalCode.replace(/^(\d{3})(\d{2})$/, "$1 $2") : null, f.city].filter(Boolean).join(" ");
  if (place) lines.push(place);
  lines.push(`IČO: ${f.ico}`);
  if (!natural && f.dic) lines.push(`DIČ: ${f.dic}`);
  return lines.join("\n");
}

/** „a dalších 37 živnostníků“ – OSVČ v seznamech jen počtem (rozhodnutí majitele, S3). */
export function personsCountText(n: number, withOthers: boolean): string {
  const noun = n === 1 ? "živnostník" : n >= 2 && n <= 4 ? "živnostníci" : "živnostníků";
  if (!withOthers) return `${n} ${noun}`;
  return `${n === 1 || (n >= 2 && n <= 4) ? "a další" : "a dalších"} ${n} ${noun}`;
}
