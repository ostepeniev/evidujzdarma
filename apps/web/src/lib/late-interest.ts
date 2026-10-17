/**
 * S2 B1 (17. 10. 2026): zákonný úrok z prodlení a minimální náklady uplatnění pohledávky.
 *
 * Nařízení vlády č. 351/2013 Sb. (znění k 1. 1. 2026, § 2 odst. 1 beze změny od 1. 1. 2014):
 *   „Výše úroku z prodlení odpovídá ročně výši repo sazby stanovené Českou národní bankou pro první den kalendářního
 *    pololetí, v němž došlo k prodlení, zvýšené o 8 procentních bodů.“
 *   → sazba se určí podle pololetí, ve kterém prodlení začalo, a po celou dobu prodlení se nemění.
 * § 3: mezi podnikateli (a podnikatelem a veřejným zadavatelem) činí minimální náklady uplatnění každé pohledávky 1 200 Kč.
 * § 2 odst. 2 (výživné pro nezletilé dítě, od 1. 1. 2026 2,5 promile denně) kalkulačka neřeší.
 *
 * Denní úrok počítáme jako roční sazba × dny prodlení / 365 (nařízení stanoví jen roční výši). Prodlení začíná dnem po
 * splatnosti (§ 1968 OZ: dlužník, který dluh včas neplní, je v prodlení); počet dní = den zaplacení − den splatnosti.
 */
import { addDays, daysBetween, isIsoDate } from "@ez/cz/holidays";

/** 2T repo sazba ČNB: [platná od, % ročně]. Zdroj: cnb.cz, „Jak se vyvíjela dvoutýdenní repo sazba ČNB?“ (data staženo 17. 10. 2026). */
export const CNB_REPO_HISTORY: readonly (readonly [string, number])[] = [
  ["2012-11-02", 0.05],
  ["2017-08-04", 0.25],
  ["2017-11-03", 0.5],
  ["2018-02-02", 0.75],
  ["2018-06-28", 1.0],
  ["2018-08-03", 1.25],
  ["2018-09-27", 1.5],
  ["2018-11-02", 1.75],
  ["2019-05-03", 2.0],
  ["2020-02-07", 2.25],
  ["2020-03-17", 1.75],
  ["2020-03-27", 1.0],
  ["2020-05-11", 0.25],
  ["2021-06-24", 0.5],
  ["2021-08-06", 0.75],
  ["2021-10-01", 1.5],
  ["2021-11-05", 2.75],
  ["2021-12-23", 3.75],
  ["2022-02-04", 4.5],
  ["2022-04-01", 5.0],
  ["2022-05-06", 5.75],
  ["2022-06-23", 7.0],
  ["2023-12-22", 6.75],
  ["2024-02-09", 6.25],
  ["2024-03-21", 5.75],
  ["2024-05-03", 5.25],
  ["2024-06-28", 4.75],
  ["2024-08-02", 4.5],
  ["2024-09-26", 4.25],
  ["2024-11-08", 4.0],
  ["2025-02-07", 3.75],
  ["2025-05-09", 3.5],
  ["2026-06-19", 3.75],
];

/** Do kdy je tabulka ověřená (poslední změna platí aspoň do tohoto dne). Po každém jednání bankovní rady ČNB zkontrolovat. */
export const CNB_REPO_VERIFIED_AT = "2026-10-17";

/** Nařízení vlády č. 351/2013 Sb. je účinné od 1. 1. 2014; pro starší prodlení platila jiná pravidla. */
export const LATE_INTEREST_FROM = "2014-01-01";
/** Procentní body nad repo sazbou (§ 2 odst. 1 NV č. 351/2013 Sb.). */
export const LATE_INTEREST_MARGIN = 8;
/** Minimální náklady uplatnění každé pohledávky mezi podnikateli (§ 3 NV č. 351/2013 Sb.). */
export const MIN_RECOVERY_COSTS = 1200;

/** Repo sazba platná v daný den, nebo null (před začátkem tabulky nebo po dni ověření). */
export function cnbRepoOn(date: string): number | null {
  if (date < CNB_REPO_HISTORY[0]![0] || date > CNB_REPO_VERIFIED_AT) return null;
  let rate: number | null = null;
  for (const [from, r] of CNB_REPO_HISTORY) if (from <= date) rate = r;
  return rate;
}

/** První den kalendářního pololetí, do kterého datum patří (1. 1. nebo 1. 7.). */
export function halfYearStart(date: string): string {
  return `${date.slice(0, 4)}-${Number(date.slice(5, 7)) <= 6 ? "01" : "07"}-01`;
}

/** „1. pololetí 2026“ */
export function halfYearLabel(start: string): string {
  return `${start.slice(5, 7) === "01" ? "1." : "2."} pololetí ${start.slice(0, 4)}`;
}

/** Sazba úroku z prodlení (% ročně) pro pololetí; součet zaokrouhlený na setiny kvůli plovoucí čárce. */
const addMargin = (repo: number) => Math.round((repo + LATE_INTEREST_MARGIN) * 100) / 100;

export type RateResult =
  | { ok: true; halfYear: string; repo: number; rate: number }
  | { ok: false; error: "before-2014" | "not-verified"; halfYear: string };

/** Sazba pro prodlení, které začalo daného dne. */
export function lateInterestRate(firstDayOfDelay: string): RateResult {
  const halfYear = halfYearStart(firstDayOfDelay);
  if (firstDayOfDelay < LATE_INTEREST_FROM) return { ok: false, error: "before-2014", halfYear };
  const repo = cnbRepoOn(halfYear);
  if (repo === null) return { ok: false, error: "not-verified", halfYear };
  return { ok: true, halfYear, repo, rate: addMargin(repo) };
}

/** Přehled sazeb po pololetích od roku `fromYear` do posledního ověřeného pololetí. */
export function lateInterestTable(fromYear: number): { halfYear: string; repo: number; rate: number }[] {
  const out: { halfYear: string; repo: number; rate: number }[] = [];
  for (let y = fromYear; ; y++) {
    for (const m of ["01", "07"]) {
      const start = `${y}-${m}-01`;
      const repo = cnbRepoOn(start);
      if (repo === null) return out;
      out.push({ halfYear: start, repo, rate: addMargin(repo) });
    }
  }
}

export interface LateInterestInput {
  /** dlužná částka v Kč */
  amount: number;
  /** den splatnosti (RRRR-MM-DD) */
  dueDate: string;
  /** den zaplacení nebo den, ke kterému úrok počítáte */
  paidDate: string;
}

export type LateInterestResult =
  | { ok: true; firstDay: string; days: number; halfYear: string; repo: number; rate: number; interest: number; perDay: number }
  | { ok: false; error: "input" | "no-delay" | "before-2014" | "not-verified"; halfYear?: string };

/** Zaokrouhlení podílu kladných celých čísel na nejbližší celé číslo (polovina nahoru), bez plovoucí čárky. */
const divRound = (num: bigint, den: bigint) => (2n * num + den) / (2n * den);

export function lateInterest(input: LateInterestInput): LateInterestResult {
  const { amount, dueDate, paidDate } = input;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !isIsoDate(dueDate) || !isIsoDate(paidDate)) return { ok: false, error: "input" };
  const days = daysBetween(dueDate, paidDate);
  if (days <= 0) return { ok: false, error: "no-delay" };
  const firstDay = addDays(dueDate, 1);
  const r = lateInterestRate(firstDay);
  if (!r.ok) return { ok: false, error: r.error, halfYear: r.halfYear };
  const halere = BigInt(Math.round(amount * 100));
  const rateBp = BigInt(Math.round(r.rate * 100)); // 11,75 % → 1175
  // úrok v haléřích = jistina × sazba/100 × dny/365
  const interest = Number(divRound(halere * rateBp * BigInt(days), 10_000n * 365n)) / 100;
  const perDay = Number(divRound(halere * rateBp, 10_000n * 365n)) / 100;
  return { ok: true, firstDay, days, halfYear: r.halfYear, repo: r.repo, rate: r.rate, interest, perDay };
}
