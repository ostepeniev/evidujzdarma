/**
 * S2/B2 (17. 10. 2026): JEDINÝ přepínač peněžních kalkulaček (čistá mzda, OSVČ, spropitné). Dokud je `false`, stránky mají
 * robots noindex,follow a nejsou v sitemap.xml (tedy ani v měření návštěvnosti), v llms.txt ani v rozcestníku /nastroje.
 * S3-OPEN: účetní (Helena Jeřábková) kalkulačky 17. 10. 2026 zkontrolovala → `true`: index, sitemap, llms.txt, /nastroje
 * a na stránce „Odborná revize: …“ s datem MONEY_REVIEWED_ON.
 */
import type { Metadata } from "next";

export const MONEY_CALCULATORS_REVIEWED: boolean = true;

/** Den odborné revize peněžních kalkulaček (Helena Jeřábková, účetní). */
export const MONEY_REVIEWED_ON = "2026-10-17";

/** Viditelné upozornění na každé peněžní kalkulačce (doslovně podle zadání). */
export const MONEY_DISCLAIMER = "Orientační výpočet, nejde o daňové poradenství.";

export interface MoneyPage {
  path: string;
  title: string;
  /** text karty v rozcestníku /nastroje */
  text: string;
  time: string;
  /** lastmod v sitemap */
  modified: string;
}

export const MONEY_PAGES: readonly MoneyPage[] = [
  {
    path: "/kalkulacka-cista-mzda",
    title: "Kalkulačka čisté mzdy 2026",
    text: "Z hrubé mzdy spočítá čistou mzdu zaměstnance pro rok 2026: pojistné, zálohu na daň, slevu na poplatníka a daňové zvýhodnění na děti. Ukáže i náklady zaměstnavatele.",
    time: "1 minuta",
    modified: "2026-10-17",
  },
  {
    path: "/kalkulacka-osvc",
    title: "Kalkulačka OSVČ 2026: daň a pojistné",
    text: "Daň z příjmů, sociální a zdravotní pojištění za rok 2026 z příjmů a výdajů (paušálem i skutečně), pro hlavní i vedlejší činnost. Porovná výsledek s paušální daní.",
    time: "2 minuty",
    modified: "2026-10-17",
  },
  {
    path: "/kalkulacka-spropitne",
    title: "Kalkulačka spropitného od roku 2027",
    text: "Spropitné zaměstnanců v gastronomii je od 1. 1. 2027 osvobozené do 7 % měsíčních příjmů podniku ze stravovacích služeb. Spočítejte limit na zaměstnance a část nad limit.",
    time: "1 minuta",
    modified: "2026-10-17",
  },
];

/** robots pro peněžní kalkulačku – noindex,follow do odborné kontroly; po ní nic (platí index,follow z layoutu). */
export function moneyRobots(): Pick<Metadata, "robots"> {
  return MONEY_CALCULATORS_REVIEWED ? {} : { robots: { index: false, follow: true } };
}

/** Stránky pro STATIC_PAGES (sitemap, měření) – prázdné, dokud kalkulačky nejsou zkontrolované. */
export function reviewedMoneyStaticPages(): { path: string; title: string; priority: number; changeFrequency: "monthly"; modified: string }[] {
  return MONEY_CALCULATORS_REVIEWED ? MONEY_PAGES.map((m) => ({ path: m.path, title: m.title, priority: 0.6, changeFrequency: "monthly" as const, modified: m.modified })) : [];
}

/** Karty pro rozcestník /nastroje (skupina „Kalkulačky a ověření“) – prázdné, dokud kalkulačky nejsou zkontrolované. */
export function reviewedMoneyTools(): { href: string; title: string; text: string; time: string; group: "kalkulacky" }[] {
  return MONEY_CALCULATORS_REVIEWED ? MONEY_PAGES.map((m) => ({ href: m.path, title: m.title, text: m.text, time: m.time, group: "kalkulacky" as const })) : [];
}

/** Cesty pro seznam nástrojů v llms.txt – prázdné, dokud kalkulačky nejsou zkontrolované. */
export function reviewedMoneyPaths(): string[] {
  return MONEY_CALCULATORS_REVIEWED ? MONEY_PAGES.map((m) => m.path) : [];
}
