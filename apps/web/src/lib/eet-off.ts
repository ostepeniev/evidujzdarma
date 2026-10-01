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
}

export const DEFAULT_INPUT: EetOffInput = {
  band: 1,
  income: 600_000,
  minutesPerDay: 5,
  workDaysPerMonth: 21,
  hourlyRate: 300,
  toolsMonthly: 0,
  hardwareOneOff: 0,
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
    };

export function calculateEetOff(i: EetOffInput): EetOffResult {
  const { surchargeMonthly, incomeLimit } = FACTS.eetOff;
  if (i.band === 0) return { eligible: false, reason: "EET OFF je jen pro poplatníky v paušálním režimu." };
  if (i.band !== 1) return { eligible: false, reason: "EET OFF je jen pro 1. pásmo paušálního režimu. Ve 2. a 3. pásmu musíte tržby evidovat." };
  if (i.income > incomeLimit)
    return { eligible: false, reason: `EET OFF lze zvolit jen s příjmy ze samostatné činnosti do ${incomeLimit.toLocaleString("cs-CZ")} Kč ročně.` };

  const surchargeYearly = surchargeMonthly * 12;
  const timeHoursYearly = (Math.max(0, i.minutesPerDay) * Math.max(0, i.workDaysPerMonth) * 12) / 60;
  const evidenceYearly = Math.round(timeHoursYearly * Math.max(0, i.hourlyRate) + Math.max(0, i.toolsMonthly) * 12 + Math.max(0, i.hardwareOneOff) / 3);
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
  };
}
