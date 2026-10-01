/**
 * Jediný zdroj faktů o EET 2.0 pro celý web (landing, e-maily, llms.txt, návody).
 * Každý fakt má zdroj. Při změně zákona/harmonogramu upravte JEN tento soubor
 * a datum FACTS_UPDATED — projeví se všude.
 */

export const FACTS_UPDATED = "2026-10-01";

export interface Source {
  label: string;
  url: string;
}

export const SOURCES = {
  eetGov: { label: "eet.gov.cz – oficiální web EET", url: "https://eet.gov.cz" },
  fsHarmonogram: {
    label: "Finanční správa: zahájení technické přípravy EET",
    url: "https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2026/financni-sprava-zahajuje-technickou-pripravu-k-eet",
  },
  daucMojeEet: {
    label: "DAUC / Komora daňových poradců: MOJE eet pro drobné podnikatele",
    url: "https://www.dauc.cz/aktuality/2087/moje-eet-pro-drobne-podnikatele",
  },
  podnikatelMojeEet: {
    label: "Podnikatel.cz: Jak bude vypadat aplikace MOJE eet",
    url: "https://www.podnikatel.cz/clanky/financni-sprava-ukazala-jak-by-mela-vypadat-aplikace-zdarma-moje-eet/",
  },
} as const satisfies Record<string, Source>;

export interface TimelineItem {
  date: string; // ISO
  dateLabel: string;
  title: string;
  action: string;
  source: Source;
}

export const TIMELINE: readonly TimelineItem[] = [
  {
    date: "2026-11-01",
    dateLabel: "1. 11. 2026",
    title: "Spuštění přípravy v DIS+",
    action: "Aktivujte přístup do DIS+, oznamte evidenční jednotky a stáhněte certifikát pro evidenci.",
    source: SOURCES.fsHarmonogram,
  },
  {
    date: "2026-12-01",
    dateLabel: "1. 12. 2026",
    title: "Státní aplikace MOJE eet",
    action: "Vyzkoušejte pokladnu v ověřovacím režimu – u nás i ve státní aplikaci.",
    source: SOURCES.daucMojeEet,
  },
  {
    date: "2027-01-01",
    dateLabel: "1. 1. 2027",
    title: "Start EET 2.0",
    action: "Evidence tržeb začíná – pokladna musí být připravená.",
    source: SOURCES.fsHarmonogram,
  },
  {
    date: "2027-01-11",
    dateLabel: "11. 1. 2027",
    title: "Lhůta pro EET OFF",
    action: "Poslední den pro volbu režimu EET OFF (zvýšená paušální daň místo evidence).",
    source: SOURCES.fsHarmonogram,
  },
  {
    date: "2027-02-01",
    dateLabel: "1. 2. 2027",
    title: "Ostrý provoz",
    action: "Ostrý provoz – tržby se musí evidovat.",
    source: SOURCES.fsHarmonogram,
  },
];

export const LIVE_DATE = "2027-02-01";

export function daysUntil(isoDate: string, now = new Date()): number {
  const target = new Date(`${isoDate}T00:00:00+01:00`).getTime();
  return Math.max(0, Math.ceil((target - now.getTime()) / 86_400_000));
}
