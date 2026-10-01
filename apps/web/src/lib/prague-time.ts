/**
 * Kalendářní dny v časovém pásmu Europe/Prague (včetně letního času) – pro exporty a přehledy
 * „od–do“, aby tržba po půlnoci nespadla do špatného dne.
 */
const TZ = "Europe/Prague";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Posun pražského času proti UTC (v minutách) v daném okamžiku: +60 v zimě, +120 v létě. */
export function pragueOffsetMinutes(at: Date): number {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** Půlnoc daného dne (RRRR-MM-DD) v Praze jako okamžik. */
export function pragueDayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(y, m - 1, d);
  let ts = utcMidnight - pragueOffsetMinutes(new Date(utcMidnight)) * 60_000;
  // kolem přechodu na letní/zimní čas přepočítat s posunem platným v nalezeném okamžiku
  ts = utcMidnight - pragueOffsetMinutes(new Date(ts)) * 60_000;
  return new Date(ts);
}

/** Interval [začátek dne `from`, začátek dne po `to`) v pražském čase. */
export function pragueDayRange(from: string, to: string): { start: Date; end: Date } {
  const [y, m, d] = to.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { start: pragueDayStart(from), end: pragueDayStart(next) };
}

/** Dnešní datum v Praze (RRRR-MM-DD). */
export function pragueToday(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(now);
}

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
