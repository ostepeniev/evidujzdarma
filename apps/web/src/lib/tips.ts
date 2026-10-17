/**
 * S2/B2: spropitné ze stravovacích služeb od 1. 1. 2027 – § 6 odst. 9 písm. g) a odst. 19 ZDP ve znění zákona č. 180/2026 Sb.
 * (část druhá, § 30 bod 7 a 9; účinnost § 36). Doslovně:
 *
 *   „g) spropitné ze stravovacích služeb obdržené zaměstnancem vykonávajícím činnost v provozovně stravovacích služeb, za kterou
 *   je poskytování spropitného obvyklé, a to za kalendářní měsíc do výše odpovídající podílu 7 % z měsíčních příjmů ze
 *   stravovacích služeb zaměstnavatele a počtu zaměstnanců tohoto zaměstnavatele, kteří za daný kalendářní měsíc obdrželi
 *   spropitné ze stravovacích služeb, nebo do výše určené zaměstnavatelem tak, aby úhrn osvobozeného spropitného ze
 *   stravovacích služeb zaměstnanců, kteří u něho v daném kalendářním měsíci vykonávají činnost, ze které plynou příjmy ze
 *   závislé činnosti, nepřekročil 7 % z jeho měsíčních příjmů ze stravovacích služeb; …“
 *   „(19) … za plátce příjmu v podobě spropitného ze stravovacích služeb se považuje zaměstnavatel …“
 *
 * Limit tedy NENÍ 7 % z jednoho účtu: je měsíční, na zaměstnance, a počítá se z měsíčních příjmů zaměstnavatele ze
 * stravovacích služeb. Dva způsoby: (A) rovným dílem mezi zaměstnance, kteří v měsíci spropitné dostali; (B) částky určí
 * zaměstnavatel, jen úhrn osvobozeného spropitného nesmí přesáhnout 7 %. Kalkulačka zákon jen přepočítává – co zákon
 * neříká (DPH v příjmech, pojistné z části nad limit, doložení způsobu B), nechává na účetní (viz otázky v hlášení S2/B2).
 */

/** 7 % podle § 6 odst. 9 písm. g) ZDP ve znění zákona č. 180/2026 Sb. */
export const TIP_EXEMPT_PERCENT = 7;
/** Od kdy osvobození platí (§ 36 zákona č. 180/2026 Sb.). */
export const TIP_RULE_FROM = "1. 1. 2027";

export interface TipsInput {
  /** měsíční příjmy zaměstnavatele ze stravovacích služeb v Kč */
  monthlyFoodIncome: number;
  /** spropitné, které jednotliví zaměstnanci za měsíc dostali (Kč); 0 = nedostal */
  tips: number[];
}

export const TIPS_DEFAULT: TipsInput = { monthlyFoodIncome: 400_000, tips: [12_000, 9_000, 3_000] };

export interface TipsEmployeeRow {
  tip: number;
  /** způsob A: osvobozená část */
  exempt: number;
  /** způsob A: část nad limit (zdanitelný příjem ze závislé činnosti) */
  over: number;
}

export interface TipsResult {
  /** 7 % z měsíčních příjmů ze stravovacích služeb */
  cap: number;
  /** počet zaměstnanců, kteří v měsíci spropitné dostali */
  recipients: number;
  /** způsob A: limit na jednoho zaměstnance (null, když spropitné nikdo nedostal) */
  perEmployeeLimit: number | null;
  rows: TipsEmployeeRow[];
  totalTips: number;
  /** způsob A – úhrn osvobozeného a úhrn nad limitem */
  exemptA: number;
  overA: number;
  /** způsob B – nejvýše možný úhrn osvobozeného spropitného (když zaměstnavatel určí částky) a nejmenší úhrn nad limitem */
  exemptBMax: number;
  overBMin: number;
}

const money = (x: number) => Math.round(Math.max(0, Number.isFinite(x) ? x : 0) * 100) / 100;

export function calculateTips(i: TipsInput): TipsResult {
  const income = money(i.monthlyFoodIncome);
  const tips = i.tips.map(money);
  // počítá se v haléřích a dolů – osvobozená částka nesmí limit přesáhnout ani o haléř (zákon zaokrouhlení neurčuje)
  const capHal = Math.floor((Math.round(income * 100) * TIP_EXEMPT_PERCENT) / 100);
  const cap = capHal / 100;
  const recipients = tips.filter((t) => t > 0).length;
  const perEmployeeLimit = recipients > 0 ? Math.floor(capHal / recipients) / 100 : null;
  const rows = tips.map((tip) => {
    const exempt = perEmployeeLimit === null ? 0 : Math.min(tip, perEmployeeLimit);
    return { tip, exempt, over: Math.round((tip - exempt) * 100) / 100 };
  });
  const totalTips = Math.round(tips.reduce((a, b) => a + b, 0) * 100) / 100;
  const exemptA = Math.round(rows.reduce((a, r) => a + r.exempt, 0) * 100) / 100;
  const exemptBMax = Math.min(totalTips, cap);
  return {
    cap,
    recipients,
    perEmployeeLimit,
    rows,
    totalTips,
    exemptA,
    overA: Math.round((totalTips - exemptA) * 100) / 100,
    exemptBMax,
    overBMin: Math.round((totalTips - exemptBMax) * 100) / 100,
  };
}
