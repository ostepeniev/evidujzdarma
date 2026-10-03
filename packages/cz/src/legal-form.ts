/**
 * Právní forma — číselník ČSÚ (ARES pole `pravniForma`). Uvádíme jen kódy, které
 * ve výstupu skutečně zobrazujeme; neznámý kód se zobrazí jako "kód XXX".
 */
const NAMES: Record<string, string> = {
  "101": "Fyzická osoba podnikající dle živnostenského zákona",
  "102": "Fyzická osoba podnikající dle živnostenského zákona zapsaná v obchodním rejstříku",
  "105": "Fyzická osoba podnikající dle jiných zákonů než živnostenského",
  "107": "Zemědělský podnikatel – fyzická osoba",
  "111": "Veřejná obchodní společnost",
  "112": "Společnost s ručením omezeným",
  "113": "Komanditní společnost",
  "121": "Akciová společnost",
  "141": "Obecně prospěšná společnost",
  "205": "Družstvo",
  "706": "Spolek",
  "801": "Obec",
};

/** Podnikající fyzické osoby: 10x (OSVČ) a zahraniční fyzické osoby 424, 425. */
const NATURAL_PERSON_RE = /^10\d$|^42[45]$/;

/**
 * Je to fyzická osoba? Neznámá forma (null) se bere jako fyzická osoba – u ní neukazujeme adresu (fail-closed, R8.5, Д-8).
 * Společné pro /api/ico, katalog, UI a MCP.
 */
export function isNaturalPerson(code: string | null | undefined): boolean {
  return !code || NATURAL_PERSON_RE.test(code);
}

export function legalFormName(code: string | null | undefined): string {
  if (!code) return "neuvedeno";
  return NAMES[code] ?? `právní forma (kód ${code})`;
}

export function legalFormShort(code: string | null | undefined): string {
  // neznámou formu nevydáváme za OSVČ ani za právnickou osobu
  if (!code) return "neuvedeno";
  if (NATURAL_PERSON_RE.test(code)) return "OSVČ";
  switch (code) {
    case "112":
      return "s.r.o.";
    case "121":
      return "a.s.";
    case "111":
      return "v.o.s.";
    case "113":
      return "k.s.";
    case "205":
      return "družstvo";
    case "706":
      return "spolek";
    default:
      return "právnická osoba";
  }
}
