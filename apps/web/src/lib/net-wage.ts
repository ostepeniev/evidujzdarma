/**
 * S2/B2: čistá mzda zaměstnance v pracovním poměru za kalendářní měsíc roku 2026 – čistá logika (stránka i testy).
 * Postup podle zákona o daních z příjmů (§ 38h, § 35d) a zákonů o pojistném v znění pro rok 2026; parametry v money-2026.ts.
 *
 *  1. sociální pojištění zaměstnance 7,1 % z hrubé mzdy, zaokrouhleno na Kč nahoru (§ 7 odst. 3 z. č. 589/1992 Sb.);
 *  2. zdravotní pojištění: 13,5 % z hrubé mzdy nahoru na Kč, zaměstnanec hradí třetinu (nahoru na Kč), zbytek zaměstnavatel;
 *  3. základ pro zálohu = hrubá mzda zaokrouhlená na celé stokoruny nahoru (§ 38h odst. 1);
 *  4. záloha 15 % do 3× průměrné mzdy (146 901 Kč) + 23 % nad ní, nahoru na Kč (§ 38h odst. 2 a 3);
 *  5. s prohlášením: − měsíční sleva na poplatníka 2 570 Kč (nejvýše do výše zálohy), − měsíční daňové zvýhodnění (sleva do
 *     výše zbylé zálohy, zbytek je daňový bonus, vyplácí se od 50 Kč a při mzdě aspoň poloviny minimální mzdy – § 35d odst. 3, 4).
 * Nepočítá: srážkovou daň a mzdy pod 4 500 Kč, DPP/DPČ, ZTP/P, slevy na invaliditu, doplatek do minimálního vyměřovacího
 * základu zdravotního pojištění, slevu zaměstnavatele na pojistném (§ 7a) a strop 48× průměrné mzdy v průběhu roku.
 */
import { P2026, ceilAdvanceBase, childBenefitMonthly, pctCeil, progressiveTaxCeil } from "./money-2026";

export interface NetWageInput {
  /** hrubá měsíční mzda v Kč */
  gross: number;
  /** podepsané prohlášení poplatníka u tohoto zaměstnavatele */
  declaration: boolean;
  /** počet vyživovaných dětí, na které uplatňujete daňové zvýhodnění (jen s prohlášením) */
  children: number;
}

export const NET_WAGE_DEFAULT: NetWageInput = { gross: 40_000, declaration: true, children: 0 };

export type NetWageResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      gross: number;
      socialEmployee: number;
      healthEmployee: number;
      healthTotal: number;
      advanceBase: number;
      /** záloha před slevami */
      advance: number;
      /** uplatněná sleva na poplatníka */
      taxpayerCredit: number;
      /** uplatněná sleva na děti (část daňového zvýhodnění, která snížila zálohu) */
      childCredit: number;
      /** vyplacený měsíční daňový bonus */
      childBonus: number;
      /** nárok na daňové zvýhodnění, který se kvůli podmínkám bonusu nevyplatí */
      childBonusLost: number;
      /** záloha po slevách (kolik zaměstnavatel srazí) */
      advanceAfterCredits: number;
      net: number;
      socialEmployer: number;
      healthEmployer: number;
      employerCost: number;
      warnings: string[];
    };

export function calculateNetWage(i: NetWageInput): NetWageResult {
  const gross = Math.round(Math.max(0, Number.isFinite(i.gross) ? i.gross : 0) * 100) / 100;
  if (gross < P2026.rozhodnyPrijemZam.value)
    return {
      ok: false,
      reason: `Kalkulačka počítá mzdu od ${P2026.rozhodnyPrijemZam.value.toLocaleString("cs-CZ")} Kč. U nižší mzdy (zaměstnání malého rozsahu) platí jiná pravidla pro pojištění i daň – poraďte se s mzdovou účetní.`,
    };

  const socialEmployee = pctCeil(gross, P2026.socZamestnanec.value);
  const healthTotal = pctCeil(gross, P2026.zdrCelkem.value);
  const healthEmployee = Math.ceil(healthTotal / 3);
  const healthEmployer = healthTotal - healthEmployee;
  const socialEmployer = pctCeil(gross, P2026.socZamestnavatel.value);

  const advanceBase = ceilAdvanceBase(gross);
  const limit = P2026.hraniceMesicni.value;
  const advance = progressiveTaxCeil(advanceBase, limit);

  const monthlyTaxpayer = P2026.slevaPoplatnik.value / 12;
  const taxpayerCredit = i.declaration ? Math.min(advance, monthlyTaxpayer) : 0;
  const afterTaxpayer = advance - taxpayerCredit;

  const children = i.declaration ? Math.max(0, Math.min(10, Math.trunc(i.children || 0))) : 0;
  const benefit = childBenefitMonthly(children);
  const childCredit = Math.min(afterTaxpayer, benefit);
  const bonusClaim = benefit - childCredit;
  const halfMinWage = Math.floor(P2026.minimalniMzda.value / 2);
  const bonusPaid = bonusClaim >= P2026.bonusMinMesicni.value && gross >= halfMinWage ? bonusClaim : 0;

  const advanceAfterCredits = afterTaxpayer - childCredit;
  const net = Math.round((gross - socialEmployee - healthEmployee - advanceAfterCredits + bonusPaid) * 100) / 100;

  const warnings: string[] = [];
  if (!i.declaration && (i.children || 0) > 0) warnings.push("Bez podepsaného prohlášení zaměstnavatel slevu na poplatníka ani daňové zvýhodnění na děti neuplatní. Můžete si je nárokovat v daňovém přiznání.");
  if (gross < P2026.minimalniMzda.value)
    warnings.push(
      `Mzda je nižší než minimální mzda (${P2026.minimalniMzda.value.toLocaleString("cs-CZ")} Kč). Zdravotní pojištění se pak obvykle doplácí z minimálního vyměřovacího základu – kalkulačka ho počítá jen z vaší mzdy. Ověřte u mzdové účetní.`,
    );
  if (bonusClaim > 0 && bonusPaid === 0)
    warnings.push(
      bonusClaim < P2026.bonusMinMesicni.value
        ? `Měsíční daňový bonus ${bonusClaim.toLocaleString("cs-CZ")} Kč je nižší než 50 Kč, proto se měsíčně nevyplácí.`
        : `Daňový bonus se měsíčně vyplácí jen při mzdě aspoň ${halfMinWage.toLocaleString("cs-CZ")} Kč (polovina minimální mzdy).`,
    );
  if (advanceBase > limit) warnings.push(`Z části základu nad ${limit.toLocaleString("cs-CZ")} Kč (3× průměrná mzda) se záloha počítá sazbou 23 %.`);
  if (gross * 12 > P2026.maxVzSoc.value)
    warnings.push(
      `Při této mzdě dosáhnete v průběhu roku maximálního vyměřovacího základu ${P2026.maxVzSoc.value.toLocaleString("cs-CZ")} Kč – od té doby se sociální pojištění neplatí a čistá mzda vzroste. Kalkulačka počítá jeden běžný měsíc.`,
    );

  return {
    ok: true,
    gross,
    socialEmployee,
    healthEmployee,
    healthTotal,
    advanceBase,
    advance,
    taxpayerCredit,
    childCredit,
    childBonus: bonusPaid,
    childBonusLost: bonusClaim - bonusPaid,
    advanceAfterCredits,
    net,
    socialEmployer,
    healthEmployer,
    employerCost: Math.round((gross + socialEmployer + healthEmployer) * 100) / 100,
    warnings,
  };
}
