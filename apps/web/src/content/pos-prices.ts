/**
 * S2-E: ceny pokladních systémů pro stránku /prechod-z-jine-pokladny (srovnávací reklama – § 2980 občanského zákoníku).
 * Srovnáváme jen to, co je srovnatelné: cenu tarifu, který podle výrobce zahrnuje evidenci tržeb, podle veřejného ceníku
 * k datu PRICES_CHECKED. Bez hardwaru a poplatků za platby kartou. Ke každému řádku zdroj (ceník výrobce).
 * Při změně ceníku: opravte řádek, posuňte PRICES_CHECKED a `modified` stránky v lib/static-pages.ts.
 * Obchodní zdroje (ceníky firem) nejsou fakta o zákoně, proto nejsou v SOURCES ve facts.ts.
 */
import type { Source } from "./facts";
import { FACTS, SOURCES } from "./facts";
import { isClosed } from "@/lib/launch";

export const PRICES_CHECKED = "2026-10-17";
export const PRICES_CHECKED_LABEL = "17. 10. 2026";

export interface PosPrice {
  id: string;
  /** systém a tarif, jak ho výrobce jmenuje */
  system: string;
  plan: string;
  /** měsíční cena v Kč podle ceníku (null = ceník nezveřejňuje) – pro kalkulačku */
  monthly: number | null;
  /** cena, jak ji ceník uvádí (včetně toho, zda je bez DPH) */
  priceText: string;
  /** cena za 12 měsíců podle ceníku */
  yearText: string;
  /** co tarif podle výrobce obsahuje (vč. evidence tržeb) */
  includes: string;
  /** vyšší tarify / další poznámka */
  note?: string;
  sources: readonly Source[];
  /** stát a my – v tabulce zvýrazněno jinak */
  kind: "state" | "ours" | "commercial";
}

const src = (label: string, url: string): Source => ({ label, url });

export const POS_PRICE_SOURCES = {
  dotykacka: src("Dotykačka: Ceník (licence a pokladny)", "https://dotykacka.cz/cenik/"),
  kasafik: src("KASA FIK: Ceník", "https://www.kasafik.cz/web/cs/cenik/"),
  elementary: src("Elementary POS: Ceník", "https://elementarypos.com/cs/cenik/"),
  smable: src("Smable: Ceník", "https://www.smable.cz/cenik/"),
  sumupPos: src("SumUp: Software prodejního místa (srovnání předplatných POS)", "https://www.sumup.com/cs-cz/pos-sumup/"),
  sumupFees: src("SumUp: Ceny a poplatky", "https://www.sumup.com/cs-cz/ceny/"),
  storyousEet: src("Storyous: EET pokladna", "https://www.storyous.com/cs/eet-pokladna"),
  storyousFaq: src("Storyous: Časté otázky", "https://www.storyous.com/cs/faq"),
} as const satisfies Record<string, Source>;

/** Řádky srovnání. Pořadí: stát, my, pak komerční systémy podle ceny základního tarifu. */
export const POS_PRICES: readonly PosPrice[] = [
  {
    id: "moje-eet",
    system: "MOJE eet",
    plan: "státní aplikace",
    monthly: 0,
    priceText: "0 Kč",
    yearText: "0 Kč",
    includes: "Evidence tržeb, až 2 evidenční jednotky a přístup pro 2 zaměstnance, katalog zboží, PDF doklady. Od 1. 12. 2026.",
    sources: FACTS.mojeEet.sources,
    kind: "state",
  },
  {
    id: "evidujzdarma",
    system: "EvidujZdarma",
    plan: "Zdarma",
    monthly: 0,
    priceText: "0 Kč navždy",
    yearText: "0 Kč",
    includes: `Evidence tržeb, práce bez signálu, až 5 uživatelů a 3 evidenční jednotky, doklad e-mailem a QR, export CSV.${isClosed("/pokladna") ? " Spouštíme 2. 11. 2026." : ""}`,
    note: "Premium (bez limitu jednotek a uživatelů, SMS účtenky, export pro Pohodu a Money) spustíme později za 149 Kč měsíčně.",
    sources: [],
    kind: "ours",
  },
  {
    id: "elementary",
    system: "Elementary POS",
    plan: "Basic",
    monthly: 0,
    priceText: "0 Kč",
    yearText: "0 Kč",
    includes: "Podle výrobce EET 2.0 zdarma ve všech tarifech. Basic: 1 zařízení, 0 zaměstnanců (administrátorů neomezeně), offline režim, pokladní kniha.",
    note: "Premium 280 Kč měsíčně bez DPH (2 800 Kč ročně při roční platbě): 2 zařízení, 1 zaměstnanec, statistiky, sklad.",
    sources: [POS_PRICE_SOURCES.elementary],
    kind: "commercial",
  },
  {
    id: "sumup",
    system: "SumUp",
    plan: "Bezplatný POS",
    monthly: 0,
    priceText: "0 Kč měsíčně",
    yearText: "0 Kč (platíte transakční poplatky za platby kartou)",
    includes: "Software předinstalovaný na pokladnách a POS zařízeních SumUp: katalog, objednávky, přehledy. Podporu EET 2.0 si ověřte u SumUp.",
    note: "POS Plus 1 199 Kč měsíčně (rozvržení stolů, napojení na účetní systémy, čtečka čárových kódů).",
    sources: [POS_PRICE_SOURCES.sumupPos, POS_PRICE_SOURCES.sumupFees],
    kind: "commercial",
  },
  {
    id: "smable",
    system: "Smable",
    plan: "Rychlá platba",
    monthly: 190,
    priceText: "190 Kč měsíčně za provozovnu bez DPH",
    yearText: "2 280 Kč bez DPH",
    includes: "Podle výrobce „Buďte připraveni na EET“: prodej zadáním částky, online přehled tržeb, offline režim, účtenka tiskem i e-mailem, denní uzávěrka. Do 10 účtenek měsíčně 0 Kč, platí se zpětně podle využití.",
    note: "Pokladna Základ 390 Kč měsíčně za provozovnu bez DPH (mapa stolů, bony do kuchyně, fiskalizace EET); každé další zařízení +195 Kč.",
    sources: [POS_PRICE_SOURCES.smable],
    kind: "commercial",
  },
  {
    id: "kasafik",
    system: "KASA FIK",
    plan: "LITE",
    monthly: 297,
    priceText: "297 Kč měsíčně bez DPH (měsíční platba)",
    yearText: "3 564 Kč bez DPH; při roční platbě sleva 15 %",
    includes: "Podpora EET 2.0, až 60 položek v ceníku, bez omezení počtu účtenek, výstupy pro účetní (Pohoda, Money, Excel), podpora 24/7.",
    note: "STANDARD 424 Kč a PREMIUM 849 Kč měsíčně bez DPH (víc položek, sklad, mapa stolů, docházka).",
    sources: [POS_PRICE_SOURCES.kasafik],
    kind: "commercial",
  },
  {
    id: "dotykacka",
    system: "Dotykačka",
    plan: "SNADNO",
    monthly: 590,
    priceText: "590 Kč měsíčně bez DPH (713,90 Kč s DPH), měsíční platba bez platebního terminálu",
    yearText: "7 080 Kč bez DPH; roční licence 6 018 Kč bez DPH (sleva 15 %)",
    includes: "Podle ceníku EET 2.0 zdarma ke všem licencím (od 1. 1. 2027), nonstop podpora, vzdálená správa, základní pokladní funkce, mapa stolů.",
    note: "S platebním terminálem Dotypay a vyšším obratem kartou je licence levnější. NAPLNO 1 190 Kč a NEOMEZENĚ 1 990 Kč měsíčně bez DPH (sklad, API, objednávkové systémy).",
    sources: [POS_PRICE_SOURCES.dotykacka],
    kind: "commercial",
  },
  {
    id: "storyous",
    system: "Storyous",
    plan: "pokladna pro gastro",
    monthly: null,
    priceText: "Ceník na webu nezveřejňuje",
    yearText: "—",
    includes: "Podle výrobce připraveno na EET 2.0; mobilní číšník, sklady a inventury, věrnostní program, rozvozové služby, integrovaný platební terminál.",
    note: "Ukázku předvede obchodní zástupce (online, osobně nebo v showroomu); v některých případech nabízí měsíc na vyzkoušení zdarma.",
    sources: [POS_PRICE_SOURCES.storyousEet, POS_PRICE_SOURCES.storyousFaq],
    kind: "commercial",
  },
];

/** Rychlé předvolby kalkulačky: měsíční cena základního tarifu podle ceníku (bez DPH). */
export const CALCULATOR_PRESETS = POS_PRICES.filter((p) => p.kind === "commercial" && p.monthly !== null && p.monthly > 0).map((p) => ({
  label: `${p.system} ${p.plan}`,
  monthly: p.monthly!,
}));

/** Kalkulačka: kolik stojí pokladna za rok (a za 3 roky); cena bez DPH u neplátce DPH + 21 %. */
export function yearlyCost(monthly: number, opts: { addVat: boolean }): { monthly: number; year: number; threeYears: number } {
  const m = Math.max(0, Number.isFinite(monthly) ? monthly : 0);
  const withVat = opts.addVat ? Math.round(m * 121) / 100 : m;
  const year = Math.round(withVat * 12 * 100) / 100;
  return { monthly: withVat, year, threeYears: Math.round(year * 3 * 100) / 100 };
}

/** Zdroje pod tabulkou: ceníky výrobců + fakta o MOJE eet a certifikátu. */
export const SWITCH_SOURCES: readonly Source[] = [
  ...Object.values(POS_PRICE_SOURCES),
  ...FACTS.mojeEet.sources,
  SOURCES.harmonogram,
  SOURCES.jakZacit,
];
