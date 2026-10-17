/**
 * S2/B2 (17. 10. 2026): parametry peněžních kalkulaček pro rok 2026 – jediný zdroj pro výpočty, tabulku „Parametry výpočtu“
 * na stránkách i pro kontrolu účetní. Každá hodnota má datum platnosti a oficiální zdroj (zákon v aktuálním znění, ČSSZ, MPSV,
 * VZP, Finanční správa). Odvozené hodnoty (3× / 36× / 48× průměrné mzdy, minimální základy) jsou opsané z úředních zdrojů a test
 * s2-money je přepočítává ze vzorců zákona – kdyby se rozešly, test spadne.
 */
import { FACTS, SOURCES, type Source } from "@/content/facts";

export interface MoneyParam {
  /** popis pro tabulku (česky, bez čísla) */
  label: string;
  value: number;
  unit: "Kč" | "%" | "Kč/měs." | "Kč/rok";
  /** od kdy hodnota platí (lidsky) */
  validFrom: string;
  source: Source;
  /** paragraf, ze kterého hodnota plyne (je-li) */
  basis?: string;
}

const p = (label: string, value: number, unit: MoneyParam["unit"], validFrom: string, source: Source, basis?: string): MoneyParam => ({
  label,
  value,
  unit,
  validFrom,
  source,
  basis,
});

const R2026 = "1. 1. 2026";

export const P2026 = {
  // --- společné ---
  prumernaMzda: p("Průměrná mzda pro rok 2026 (46 278 Kč × 1,0581)", 48_967, "Kč", R2026, SOURCES.csszUdaje2026, "nařízení vlády č. 365/2025 Sb."),
  minimalniMzda: p("Minimální mzda", 22_400, "Kč/měs.", R2026, SOURCES.mpsvMinMzda2026),

  // --- daň z příjmů fyzických osob (zákon č. 586/1992 Sb., znění 1. 8. – 31. 12. 2026) ---
  sazbaDane: p("Sazba daně (a zálohy) do hranice", 15, "%", R2026, SOURCES.zdp, "§ 16 odst. 1, § 38h odst. 2 ZDP"),
  sazbaDaneVyssi: p("Sazba daně (a zálohy) nad hranicí", 23, "%", R2026, SOURCES.zdp, "§ 16 odst. 1, § 38h odst. 2 ZDP"),
  hraniceRocni: p("Hranice pro 23 % ročně (36× průměrná mzda)", 1_762_812, "Kč/rok", R2026, SOURCES.zdp, "§ 16 odst. 1 ZDP"),
  hraniceMesicni: p("Hranice pro 23 % u zálohy (3× průměrná mzda)", 146_901, "Kč/měs.", R2026, SOURCES.zdp, "§ 38h odst. 2 ZDP"),
  slevaPoplatnik: p("Sleva na poplatníka", 30_840, "Kč/rok", R2026, SOURCES.zdp, "§ 35ba odst. 1 písm. a) ZDP"),
  dite1: p("Daňové zvýhodnění na 1. dítě", 15_204, "Kč/rok", R2026, SOURCES.zdp, "§ 35c odst. 1 ZDP"),
  dite2: p("Daňové zvýhodnění na 2. dítě", 22_320, "Kč/rok", R2026, SOURCES.zdp, "§ 35c odst. 1 ZDP"),
  dite3: p("Daňové zvýhodnění na 3. a každé další dítě", 27_840, "Kč/rok", R2026, SOURCES.zdp, "§ 35c odst. 1 ZDP"),
  bonusMinMesicni: p("Nejnižší měsíční daňový bonus, který se vyplácí", 50, "Kč", R2026, SOURCES.zdp, "§ 35d odst. 4 ZDP"),
  bonusMinRocni: p("Nejnižší roční daňový bonus", 100, "Kč", R2026, SOURCES.zdp, "§ 35c odst. 3 ZDP"),
  bonusPrijemRocni: p("Roční daňový bonus jen při příjmech ze zaměstnání nebo podnikání aspoň 6× minimální mzda", 134_400, "Kč/rok", R2026, SOURCES.zdp, "§ 35c odst. 4 ZDP"),

  // --- pojistné zaměstnance a zaměstnavatele ---
  socZamestnanec: p("Sociální pojištění zaměstnance (6,5 % důchodové + 0,6 % nemocenské)", 7.1, "%", R2026, SOURCES.mpsvPojisteni2026, "§ 7 odst. 1 písm. d) z. č. 589/1992 Sb."),
  socZamestnavatel: p("Sociální pojištění zaměstnavatele (21,5 % + 2,1 % + 1,2 %)", 24.8, "%", R2026, SOURCES.csszUdaje2026, "§ 7 odst. 1 písm. a) z. č. 589/1992 Sb."),
  zdrCelkem: p("Zdravotní pojištění celkem (zaměstnanec hradí třetinu = 4,5 %, zaměstnavatel 9 %)", 13.5, "%", R2026, SOURCES.vzpZamestnavatel, "§ 2 a § 9 z. č. 592/1992 Sb."),
  maxVzSoc: p("Maximální vyměřovací základ pro sociální pojištění (48× průměrná mzda)", 2_350_416, "Kč/rok", R2026, SOURCES.csszUdaje2026, "§ 15a z. č. 589/1992 Sb."),
  rozhodnyPrijemZam: p("Rozhodný příjem pro účast zaměstnance na pojištění (zaměstnání malého rozsahu)", 4_500, "Kč/měs.", R2026, SOURCES.csszUdaje2026),

  // --- OSVČ ---
  socOsvcSazba: p("Sazba pojistného na důchodové pojištění OSVČ", 29.2, "%", R2026, SOURCES.zakonPojistneSoc, "§ 7 odst. 1 písm. e) z. č. 589/1992 Sb."),
  socOsvcPodil: p("Vyměřovací základ OSVČ pro sociální pojištění (podíl z dílčího základu daně)", 55, "%", R2026, SOURCES.zakonPojistneSoc, "§ 5b odst. 1 z. č. 589/1992 Sb."),
  minVzHlavni: p(
    "Minimální měsíční vyměřovací základ – hlavní činnost (35 % průměrné mzdy, pro přehled za rok 2026)",
    17_139,
    "Kč/měs.",
    "celý rok 2026 (zákon č. 90/2026 Sb.)",
    SOURCES.zakon90,
    "§ 14 odst. 5 z. č. 589/1992 Sb., čl. II bod 5 z. č. 90/2026 Sb.",
  ),
  minZalohaHlavniDoCervna: p("Minimální záloha na sociální pojištění – hlavní činnost, leden až červen", 5_720, "Kč/měs.", R2026, SOURCES.csszMinZalohy2026),
  minZalohaHlavniOdCervence: p("Minimální záloha na sociální pojištění – hlavní činnost, od července", 5_005, "Kč/měs.", "1. 7. 2026", SOURCES.csszOsvcOd072026),
  minVzZacinajici: p(
    "Minimální měsíční vyměřovací základ – začínající OSVČ, hlavní činnost (25 % průměrné mzdy; kalkulačka nepočítá)",
    12_242,
    "Kč/měs.",
    R2026,
    SOURCES.csszUdaje2026,
    "§ 14 odst. 5 věta druhá z. č. 589/1992 Sb.",
  ),
  minVzVedlejsi: p("Minimální měsíční vyměřovací základ – vedlejší činnost (11 % průměrné mzdy)", 5_387, "Kč/měs.", R2026, SOURCES.csszUdaje2026, "§ 14 odst. 5 z. č. 589/1992 Sb."),
  minZalohaVedlejsi: p("Minimální záloha na sociální pojištění – vedlejší činnost", 1_574, "Kč/měs.", R2026, SOURCES.csszUdaje2026),
  rozhodnaCastka: p("Rozhodná částka pro vedlejší činnost (účast na důchodovém pojištění)", 117_521, "Kč/rok", R2026, SOURCES.csszRozhodnaCastka),
  rozhodnaCastkaMesic: p("Snížení rozhodné částky za každý měsíc bez vedlejší činnosti", 9_794, "Kč", R2026, SOURCES.csszRozhodnaCastka),
  zdrOsvcPodil: p("Vyměřovací základ OSVČ pro zdravotní pojištění (podíl z dílčího základu daně)", 50, "%", R2026, SOURCES.zakonPojistneZdr, "§ 3a odst. 1 z. č. 592/1992 Sb."),
  minVzZdr: p("Minimální měsíční vyměřovací základ OSVČ pro zdravotní pojištění (50 % průměrné mzdy)", 24_483.5, "Kč/měs.", R2026, SOURCES.vzpMinVzOsvc, "§ 3a odst. 2 z. č. 592/1992 Sb."),
  minZalohaZdr: p("Minimální záloha na zdravotní pojištění OSVČ", 3_306, "Kč/měs.", R2026, SOURCES.vzpPlatby2026),
  nemocenskeOsvcSazba: p("Nemocenské pojištění OSVČ (dobrovolné) – sazba", 2.7, "%", R2026, SOURCES.zakonPojistneSoc, "§ 7 odst. 1 písm. e) bod 2 z. č. 589/1992 Sb."),
  nemocenskeOsvcMin: p("Nemocenské pojištění OSVČ (dobrovolné) – nejnižší platba", 243, "Kč/měs.", R2026, SOURCES.csszUdaje2026),

  // --- paušální režim 2026 (měsíční paušální záloha; 1. pásmo zpětně od 1. 1. 2026 podle čl. II bodu 4 z. č. 90/2026 Sb.) ---
  pausal1: p("Paušální záloha – 1. pásmo (100 Kč daň + 5 756 Kč sociální + 3 306 Kč zdravotní)", FACTS.pausal[2026].band1, "Kč/měs.", "celý rok 2026 (zákon č. 90/2026 Sb.)", SOURCES.pausal2026, "§ 38lk ZDP"),
  pausal1DoCervna: p("Paušální záloha – 1. pásmo, leden až červen 2026 (před zákonem č. 90/2026 Sb.)", 9_984, "Kč/měs.", R2026, SOURCES.pausal2026, "§ 38lk ZDP"),
  pausal2: p("Paušální záloha – 2. pásmo", FACTS.pausal[2026].band2, "Kč/měs.", R2026, SOURCES.mpsvPojisteni2026, "§ 38lk ZDP"),
  pausal3: p("Paušální záloha – 3. pásmo", FACTS.pausal[2026].band3, "Kč/měs.", R2026, SOURCES.mpsvPojisteni2026, "§ 38lk ZDP"),
} as const satisfies Record<string, MoneyParam>;

export type ParamKey = keyof typeof P2026;

/** Výdajové paušály (§ 7 odst. 7 ZDP) – procento a strop výdajů. */
export const EXPENSE_FLAT = {
  80: { rate: 80, cap: 1_600_000, label: "80 % – řemeslná živnost, zemědělství, lesní a vodní hospodářství" },
  60: { rate: 60, cap: 1_200_000, label: "60 % – ostatní (volné, vázané, koncesované) živnosti" },
  40: { rate: 40, cap: 800_000, label: "40 % – jiné příjmy ze samostatné činnosti (např. svobodná povolání)" },
  30: { rate: 30, cap: 600_000, label: "30 % – nájem majetku v obchodním majetku" },
} as const;
export type ExpenseRate = keyof typeof EXPENSE_FLAT;

/** Rozhodné příjmy pásem paušálního režimu (§ 2a odst. 5 ZDP) podle toho, jaký výdajový paušál lze k příjmům uplatnit. */
export const PAUSAL_LIMITS: Record<1 | 2 | 3, Record<ExpenseRate, number>> = {
  1: { 80: 2_000_000, 60: 1_500_000, 40: 1_000_000, 30: 1_000_000 },
  2: { 80: 2_000_000, 60: 2_000_000, 40: 1_500_000, 30: 1_500_000 },
  3: { 80: 2_000_000, 60: 2_000_000, 40: 2_000_000, 30: 2_000_000 },
};

/** Zdroje k § 7 odst. 7 a § 2a odst. 5 – zákon o daních z příjmů. */
export const PAUSAL_LIMITS_SOURCE = SOURCES.zdp;

/**
 * Procento z částky zaokrouhlené na celé koruny nahoru (§ 7 odst. 3 z. č. 589/1992 Sb., § 2 odst. 2 z. č. 592/1992 Sb.,
 * § 38h odst. 3 ZDP). Počítá se v haléřích a v desetitisícinách procenta, aby 0,1 + 0,2 nedalo 0,30000000000000004.
 */
export function pctCeil(amount: number, percent: number): number {
  const hal = Math.round(amount * 100);
  const bp = Math.round(percent * 100); // 7,1 % → 710
  const n = hal * bp; // celé číslo; v Kč je to n / 1 000 000
  return n <= 0 ? 0 : Math.ceil(n / 1_000_000);
}

/** Procento z částky přesně (v Kč s haléři), bez zaokrouhlení. */
export function pctExact(amount: number, percent: number): number {
  const hal = Math.round(amount * 100);
  const bp = Math.round(percent * 100);
  return (hal * bp) / 1_000_000;
}

/**
 * Daň 15 % do hranice + 23 % nad ní, zaokrouhlená na Kč nahoru – záloha (§ 38h odst. 2 a 3 ZDP) i roční daň (§ 16 ZDP,
 * § 146 odst. 1 daňového řádu). Celočíselně v haléřích.
 */
export function progressiveTaxCeil(base: number, limit: number): number {
  const lower = Math.round(Math.max(0, Math.min(base, limit)) * 100) * Math.round(P2026.sazbaDane.value * 100);
  const upper = Math.round(Math.max(0, base - limit) * 100) * Math.round(P2026.sazbaDaneVyssi.value * 100);
  const n = lower + upper;
  return n <= 0 ? 0 : Math.ceil(n / 1_000_000);
}

/** Na celé koruny nahoru. */
export const ceilKc = (x: number) => Math.ceil(Math.round(x * 100) / 100);
/** Základ pro výpočet zálohy: do 100 Kč na celé koruny nahoru, nad 100 Kč na celé stokoruny nahoru (§ 38h odst. 1 ZDP, 2026). */
export const ceilAdvanceBase = (x: number) => (x <= 100 ? ceilKc(x) : Math.ceil(Math.round(x * 100) / 10_000) * 100);
/** Na celé stokoruny dolů. */
export const floor100 = (x: number) => Math.floor(Math.round(x * 100) / 10_000) * 100;

/** Daňové zvýhodnění na děti za rok podle pořadí (1., 2., 3. a další). */
export function childBenefitYearly(children: number): number {
  const n = Math.max(0, Math.trunc(children));
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += i === 1 ? P2026.dite1.value : i === 2 ? P2026.dite2.value : P2026.dite3.value;
  return sum;
}

/** Měsíční daňové zvýhodnění = 1/12 ročního (§ 35d odst. 2 ZDP); částky 2026 jsou dělitelné 12 beze zbytku. */
export function childBenefitMonthly(children: number): number {
  const n = Math.max(0, Math.trunc(children));
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += (i === 1 ? P2026.dite1.value : i === 2 ? P2026.dite2.value : P2026.dite3.value) / 12;
  return sum;
}

/** Formát Kč pro výsledky (celé koruny; haléře jen tam, kde nejsou nulové). */
export function kc(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const whole = Number.isInteger(rounded);
  return `${rounded.toLocaleString("cs-CZ", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })} Kč`;
}

/** Hodnota parametru pro tabulku. */
export function paramDisplay(x: MoneyParam): string {
  if (x.unit === "%") return `${x.value.toLocaleString("cs-CZ")} %`;
  const n = x.value.toLocaleString("cs-CZ", { minimumFractionDigits: Number.isInteger(x.value) ? 0 : 2, maximumFractionDigits: 2 });
  return x.unit === "Kč" ? `${n} Kč` : `${n} ${x.unit}`;
}

/** Zdroje parametrů stránky bez duplicit (pořadí: nejdřív `extra`, pak parametry). */
export function uniqueSources(keys: readonly ParamKey[], extra: readonly Source[] = []): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of [...extra, ...keys.map((k) => P2026[k].source)]) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}
