/** Webináře „EET 2.0 pro účetní“ — sdílí stránka /ucetni (JSON-LD, texty) i přihlašovací formulář. */

export interface WebinarOption {
  /** hodnota utm_campaign posílaná do /api/preregistrace */
  value: "webinar-2026-11-05" | "webinar-2026-12-03" | "kabinet";
  label: string;
  hint: string;
  /** ISO datum konání (jen webináře) */
  date?: string;
  dateLabel?: string;
  topic?: string;
}

export const WEBINAR_OPTIONS: readonly WebinarOption[] = [
  {
    value: "webinar-2026-11-05",
    label: "Webinář 5. 11. 2026",
    hint: "Týden po spuštění EET v DIS+",
    date: "2026-11-05",
    dateLabel: "5. 11. 2026",
    topic: "Přihlášení klientů k evidenci v DIS+, evidenční jednotky, pokladní certifikát a rozhodnutí o EET OFF.",
  },
  {
    value: "webinar-2026-12-03",
    label: "Webinář 3. 12. 2026",
    hint: "Po spuštění státní aplikace MOJE eet",
    date: "2026-12-03",
    dateLabel: "3. 12. 2026",
    topic: "Výběr pokladny pro různé typy klientů (MOJE eet i jiné pokladny), test pokladny v prosinci před začátkem evidence 1. 1. 2027 a export tržeb do účetnictví.",
  },
  { value: "kabinet", label: "Jen mi dejte vědět o spuštění Účetního kabinetu", hint: "Bez webináře" },
];

export const WEBINARS = WEBINAR_OPTIONS.filter((w): w is WebinarOption & { date: string; dateLabel: string; topic: string } => Boolean(w.date));
