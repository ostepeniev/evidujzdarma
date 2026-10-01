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

/** Kódy 10x označují podnikající fyzické osoby (OSVČ). */
export function isNaturalPerson(code: string | null | undefined): boolean {
  return !!code && /^10\d$/.test(code);
}

export function legalFormName(code: string | null | undefined): string {
  if (!code) return "neuvedeno";
  return NAMES[code] ?? `právní forma (kód ${code})`;
}

export function legalFormShort(code: string | null | undefined): string {
  if (isNaturalPerson(code)) return "OSVČ";
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
