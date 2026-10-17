/**
 * Dny pracovního klidu v ČR podle zákona č. 245/2000 Sb., o státních svátcích, o ostatních svátcích, o významných dnech
 * a o dnech pracovního klidu (znění k 13. 5. 2026): státní svátky (§ 1) a ostatní svátky (§ 2) jsou dny pracovního klidu (§ 3).
 * Velký pátek a Velikonoční pondělí se počítají od data Velikonoc (gregoriánský kalendář).
 * Datum = řetězec „RRRR-MM-DD“; počítáme v UTC, aby výsledek nezávisel na časovém pásmu prohlížeče.
 */

export interface CzHoliday {
  date: string;
  name: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function parseIso(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === date ? d : null;
}

/** Platné datum „RRRR-MM-DD“? */
export function isIsoDate(date: string): boolean {
  return parseIso(date) !== null;
}

/** Velikonoční neděle (anonymní gregoriánský algoritmus – Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** Posun data o n dní (n může být záporné). */
export function addDays(date: string, n: number): string {
  const d = parseIso(date);
  if (!d) throw new Error(`Neplatné datum: ${date}`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Počet dní od `from` do `to` (to − from). */
export function daysBetween(from: string, to: string): number {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a || !b) throw new Error(`Neplatné datum: ${from} / ${to}`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const WEEKDAYS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"] as const;

/** Den v týdnu česky („pondělí“…). */
export function weekdayCs(date: string): string {
  const d = parseIso(date);
  if (!d) throw new Error(`Neplatné datum: ${date}`);
  return WEEKDAYS[d.getUTCDay()]!;
}

export function isWeekend(date: string): boolean {
  const d = parseIso(date);
  if (!d) throw new Error(`Neplatné datum: ${date}`);
  return d.getUTCDay() === 0 || d.getUTCDay() === 6;
}

/** Státní a ostatní svátky v daném roce, seřazené podle data (1. 1. je obojí – jeden záznam se dvěma názvy). */
export function czHolidays(year: number): CzHoliday[] {
  const easter = easterSunday(year);
  const list: CzHoliday[] = [
    { date: iso(year, 1, 1), name: "Den obnovy samostatného českého státu; Nový rok" },
    { date: addDays(easter, -2), name: "Velký pátek" },
    { date: addDays(easter, 1), name: "Velikonoční pondělí" },
    { date: iso(year, 5, 1), name: "Svátek práce" },
    { date: iso(year, 5, 8), name: "Den vítězství" },
    { date: iso(year, 7, 5), name: "Den slovanských věrozvěstů Cyrila a Metoděje" },
    { date: iso(year, 7, 6), name: "Den upálení mistra Jana Husa" },
    { date: iso(year, 9, 28), name: "Den české státnosti" },
    { date: iso(year, 10, 28), name: "Den vzniku samostatného československého státu" },
    { date: iso(year, 11, 17), name: "Den boje za svobodu a demokracii a Mezinárodní den studentstva" },
    { date: iso(year, 12, 24), name: "Štědrý den" },
    { date: iso(year, 12, 25), name: "1. svátek vánoční" },
    { date: iso(year, 12, 26), name: "2. svátek vánoční" },
  ];
  return list.sort((x, y) => x.date.localeCompare(y.date));
}

/** Název svátku, připadá-li na datum svátek; jinak null. */
export function czHolidayName(date: string): string | null {
  const year = Number(date.slice(0, 4));
  return czHolidays(year).find((h) => h.date === date)?.name ?? null;
}

/** Pracovní den = ne sobota, ne neděle, ne státní ani ostatní svátek. */
export function isCzWorkingDay(date: string): boolean {
  return !isWeekend(date) && czHolidayName(date) === null;
}

/** Datum samo, je-li pracovním dnem, jinak nejbližší následující pracovní den. */
export function nextCzWorkingDay(date: string): string {
  let d = date;
  while (!isCzWorkingDay(d)) d = addDays(d, 1);
  return d;
}
