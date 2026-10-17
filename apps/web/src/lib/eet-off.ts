/**
 * Kalkulačka EET OFF — čistá logika (sdílí ji stránka i testy).
 * Podmínky a částky z FACTS (eet.gov.cz + oznámené paušály 2027, které jsou předběžné).
 */
import { FACTS } from "@/content/facts";

export type Band = 1 | 2 | 3 | 0; // 0 = není v paušálním režimu

export interface EetOffInput {
  band: Band;
  /** roční příjmy ze samostatné činnosti v Kč */
  income: number;
  /** odhad času na evidenci (minuty za pracovní den) */
  minutesPerDay: number;
  workDaysPerMonth: number;
  /** cena vaší hodiny v Kč */
  hourlyRate: number;
  /** měsíční náklady na pokladnu / aplikaci / tiskárnu v Kč */
  toolsMonthly: number;
  /** jednorázové pořízení (tiskárna, tablet) v Kč, rozpočítá se na 3 roky */
  hardwareOneOff: number;
  /** měsíc zahájení činnosti v roce (1 = podniká celý rok); přirážka se platí od tohoto měsíce */
  startMonth?: number;
}

export const DEFAULT_INPUT: EetOffInput = {
  band: 1,
  income: 600_000,
  minutesPerDay: 5,
  workDaysPerMonth: 21,
  hourlyRate: 300,
  toolsMonthly: 0,
  hardwareOneOff: 0,
  startMonth: 1,
};

export type EetOffResult =
  | { eligible: false; reason: string }
  | {
      eligible: true;
      surchargeYearly: number;
      evidenceYearly: number;
      timeHoursYearly: number;
      difference: number;
      verdict: "eet-off" | "evidence" | "tie";
      pausalMonthly: number;
      pausalWithSurchargeMonthly: number;
      /** počet měsíců v roce, za které se platí přirážka / eviduje */
      months: number;
    };

export function calculateEetOff(i: EetOffInput): EetOffResult {
  const { surchargeMonthly, incomeLimit } = FACTS.eetOff;
  if (i.band === 0) return { eligible: false, reason: "EET OFF je jen pro fyzické osoby v 1. pásmu paušálního režimu." };
  if (i.band !== 1) return { eligible: false, reason: "EET OFF je jen pro 1. pásmo paušálního režimu. Ve 2. a 3. pásmu musíte tržby evidovat." };
  if (i.income > incomeLimit)
    return { eligible: false, reason: `EET OFF lze zvolit jen s příjmy ze samostatné činnosti do ${incomeLimit.toLocaleString("cs-CZ")} Kč ročně.` };

  // Kdo začne podnikat v průběhu roku, platí přirážku od měsíce zahájení (a jen tehdy by i evidoval).
  const start = Math.min(12, Math.max(1, Math.trunc(i.startMonth ?? 1) || 1));
  const months = 13 - start;
  const surchargeYearly = surchargeMonthly * months;
  const timeHoursYearly = (Math.max(0, i.minutesPerDay) * Math.max(0, i.workDaysPerMonth) * months) / 60;
  const evidenceYearly = Math.round(
    timeHoursYearly * Math.max(0, i.hourlyRate) + Math.max(0, i.toolsMonthly) * months + (Math.max(0, i.hardwareOneOff) / 3) * (months / 12),
  );
  const difference = evidenceYearly - surchargeYearly;
  const verdict = Math.abs(difference) < 1200 ? "tie" : difference > 0 ? "eet-off" : "evidence";
  const pausalMonthly = FACTS.pausal[2027].band1;
  return {
    eligible: true,
    surchargeYearly,
    evidenceYearly,
    timeHoursYearly: Math.round(timeHoursYearly * 10) / 10,
    difference,
    verdict,
    pausalMonthly,
    pausalWithSurchargeMonthly: pausalMonthly + surchargeMonthly,
    months,
  };
}

/**
 * S2/B2 (17. 10. 2026): roční součet pro paušalistu v 1. pásmu a bod zvratu. Místo samostatné stránky
 * /kalkulacka-pausal-vs-eet-off (duplicitní obsah) rozšiřuje tuto kalkulačku: paušální daň + přirážka vs. paušální daň
 * + evidence (pokladna EvidujZdarma 0 Kč, tedy jen váš čas a případné zařízení).
 */
export interface EetOffYear {
  /** paušální daň za období (bez přirážky) */
  pausalTotal: number;
  /** paušální daň + přirážka EET OFF */
  withEetOff: number;
  /** paušální daň + náklady evidence podle vašich odhadů */
  withEvidence: number;
  /** kolik minut evidence za pracovní den stojí stejně jako přirážka (null = nelze spočítat, např. nulová cena hodiny) */
  breakEvenMinutesPerDay: number | null;
}

export function eetOffYear(i: EetOffInput, r: Extract<EetOffResult, { eligible: true }>): EetOffYear {
  const pausalTotal = r.pausalMonthly * r.months;
  const fixed = Math.max(0, i.toolsMonthly) * r.months + (Math.max(0, i.hardwareOneOff) / 3) * (r.months / 12);
  const perMinute = (Math.max(0, i.hourlyRate) / 60) * Math.max(0, i.workDaysPerMonth) * r.months;
  const breakEven = perMinute > 0 ? Math.max(0, (r.surchargeYearly - fixed) / perMinute) : null;
  return {
    pausalTotal,
    withEetOff: pausalTotal + r.surchargeYearly,
    withEvidence: pausalTotal + r.evidenceYearly,
    breakEvenMinutesPerDay: breakEven === null ? null : Math.round(breakEven * 10) / 10,
  };
}
