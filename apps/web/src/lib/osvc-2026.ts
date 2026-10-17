/**
 * S2/B2: OSVČ – roční daň z příjmů, sociální a zdravotní pojištění za rok 2026 (čistá logika pro stránku i testy).
 *
 * Daň (ZDP): dílčí základ = příjmy − výdaje (paušál § 7 odst. 7 se stropem, nebo skutečné výdaje); základ se zaokrouhlí na
 * celá sta Kč dolů (§ 16 odst. 2); daň 15 % / 23 % nad 36× průměrné mzdy, zaokrouhlená na Kč nahoru (§ 146 daňového řádu);
 * − sleva na poplatníka (§ 35ba); − daňové zvýhodnění (sleva do výše daně, zbytek bonus od 100 Kč při příjmech aspoň
 * 6× minimální mzdy – § 35c odst. 3 a 4).
 * Sociální pojištění (z. č. 589/1992 Sb.): VZ = 55 % dílčího základu nahoru na Kč (§ 5b, § 5d), nejméně minimální VZ × počet
 * měsíců (hlavní: 35 % průměrné mzdy pro celý rok 2026 – čl. II bod 5 z. č. 90/2026 Sb.; vedlejší: 11 %, a jen když dílčí
 * základ dosáhl rozhodné částky), nejvýše 48× průměrné mzdy; pojistné 29,2 % nahoru na Kč.
 * Zdravotní pojištění (z. č. 592/1992 Sb.): VZ = 50 % dílčího základu, u hlavní činnosti nejméně 50 % průměrné mzdy × počet
 * měsíců (§ 3a); kdo je zároveň zaměstnanec nebo státní pojištěnec, minimum nemá (§ 3a odst. 3); pojistné 13,5 % nahoru na Kč.
 * Nepočítá: zvýhodněný minimální základ začínajících OSVČ, nemocenské pojištění, nezdanitelné části základu (§ 15),
 * souběh se zaměstnáním v jednom přiznání, slevu pro poživatele důchodu.
 */
import { EXPENSE_FLAT, P2026, PAUSAL_LIMITS, childBenefitYearly, floor100, pctCeil, pctExact, progressiveTaxCeil, type ExpenseRate } from "./money-2026";

export type Activity = "hlavni" | "vedlejsi";

export interface OsvcInput {
  /** příjmy ze samostatné činnosti za rok 2026 v Kč */
  income: number;
  /** druh činnosti = výdajový paušál, který lze k příjmům uplatnit (i pro pásma paušální daně) */
  expenseRate: ExpenseRate;
  /** skutečné výdaje v Kč; null = výdaje paušálem */
  realExpenses: number | null;
  activity: Activity;
  /** počet kalendářních měsíců činnosti v roce 2026 (1–12) */
  months: number;
  taxpayerCredit: boolean;
  children: number;
}

export const OSVC_DEFAULT: OsvcInput = {
  income: 800_000,
  expenseRate: 60,
  realExpenses: null,
  activity: "hlavni",
  months: 12,
  taxpayerCredit: true,
  children: 0,
};

export interface PausalBand {
  band: 1 | 2 | 3;
  monthly: number;
  yearly: number;
  /** rozhodné příjmy pro toto pásmo při zvoleném druhu činnosti */
  incomeLimit: number;
  available: boolean;
}

export interface OsvcResult {
  income: number;
  expenses: number;
  /** strop výdajového paušálu, pokud výdaje omezil */
  expensesCapped: boolean;
  /** dílčí základ daně (může být záporný = ztráta) */
  profit: number;
  taxBase: number;
  taxBeforeCredits: number;
  taxpayerCredit: number;
  childCredit: number;
  childBonus: number;
  childBonusLost: number;
  /** daň po slevách (≥ 0); bonus je zvlášť */
  tax: number;
  social: { participates: boolean; threshold: number | null; base: number; minBase: number; capped: boolean; premium: number };
  health: { base: number; minBase: number; premium: number };
  /** daň − bonus + sociální + zdravotní */
  total: number;
  months: number;
  pausal: PausalBand[];
  /** nejlevnější dostupné pásmo paušální daně (null = příjmy nad 2 mil. Kč) */
  cheapestPausal: PausalBand | null;
}

const clampMonths = (m: number) => Math.min(12, Math.max(1, Math.trunc(Number.isFinite(m) ? m : 12) || 12));
const nonNeg = (x: number) => Math.max(0, Number.isFinite(x) ? x : 0);

export function calculateOsvc(i: OsvcInput): OsvcResult {
  const income = Math.round(nonNeg(i.income) * 100) / 100;
  const months = clampMonths(i.months);
  const flat = EXPENSE_FLAT[i.expenseRate];

  // --- výdaje a dílčí základ daně ---
  let expenses: number;
  let expensesCapped = false;
  if (i.realExpenses === null) {
    const raw = pctExact(income, flat.rate);
    expensesCapped = raw > flat.cap;
    expenses = Math.min(raw, flat.cap);
  } else expenses = Math.round(nonNeg(i.realExpenses) * 100) / 100;
  const profit = Math.round((income - expenses) * 100) / 100;

  // --- daň ---
  const taxBase = floor100(Math.max(0, profit));
  const taxBeforeCredits = progressiveTaxCeil(taxBase, P2026.hraniceRocni.value);
  const taxpayerCredit = i.taxpayerCredit ? Math.min(taxBeforeCredits, P2026.slevaPoplatnik.value) : 0;
  const afterTaxpayer = taxBeforeCredits - taxpayerCredit;
  const benefit = childBenefitYearly(Math.min(10, nonNeg(i.children)));
  const childCredit = Math.min(afterTaxpayer, benefit);
  const bonusClaim = benefit - childCredit;
  const bonusOk = bonusClaim >= P2026.bonusMinRocni.value && income >= P2026.bonusPrijemRocni.value;
  const childBonus = bonusOk ? bonusClaim : 0;
  const tax = afterTaxpayer - childCredit;

  // --- sociální pojištění ---
  const maxBase = P2026.maxVzSoc.value;
  const soc55 = pctCeil(Math.max(0, profit), P2026.socOsvcPodil.value);
  let social: OsvcResult["social"];
  if (i.activity === "hlavni") {
    const minBase = P2026.minVzHlavni.value * months;
    const base = Math.min(maxBase, Math.max(soc55, minBase));
    social = { participates: true, threshold: null, base, minBase, capped: Math.max(soc55, minBase) > maxBase, premium: pctCeil(base, P2026.socOsvcSazba.value) };
  } else {
    const threshold = P2026.rozhodnaCastka.value - P2026.rozhodnaCastkaMesic.value * (12 - months);
    const minBase = P2026.minVzVedlejsi.value * months;
    const participates = profit >= threshold;
    const base = participates ? Math.min(maxBase, Math.max(soc55, minBase)) : 0;
    social = { participates, threshold, base, minBase, capped: participates && Math.max(soc55, minBase) > maxBase, premium: participates ? pctCeil(base, P2026.socOsvcSazba.value) : 0 };
  }

  // --- zdravotní pojištění ---
  const zdr50 = pctExact(Math.max(0, profit), P2026.zdrOsvcPodil.value);
  const healthMin = i.activity === "hlavni" ? Math.round(P2026.minVzZdr.value * months * 100) / 100 : 0;
  const healthBase = Math.max(zdr50, healthMin);
  const health = { base: healthBase, minBase: healthMin, premium: pctCeil(healthBase, P2026.zdrCelkem.value) };

  // --- paušální daň pro srovnání ---
  const monthlyBands = { 1: P2026.pausal1.value, 2: P2026.pausal2.value, 3: P2026.pausal3.value } as const;
  const pausal: PausalBand[] = ([1, 2, 3] as const).map((band) => {
    const incomeLimit = PAUSAL_LIMITS[band][i.expenseRate];
    return { band, monthly: monthlyBands[band], yearly: monthlyBands[band] * months, incomeLimit, available: income <= incomeLimit };
  });

  return {
    income,
    expenses,
    expensesCapped,
    profit,
    taxBase,
    taxBeforeCredits,
    taxpayerCredit,
    childCredit,
    childBonus,
    childBonusLost: bonusClaim - childBonus,
    tax,
    social,
    health,
    total: Math.round((tax - childBonus + social.premium + health.premium) * 100) / 100,
    months,
    pausal,
    cheapestPausal: pausal.find((b) => b.available) ?? null,
  };
}
