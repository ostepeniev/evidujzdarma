/**
 * Klasifikace chybových kódů odpovědi EET 2.0 podle „Popis datového rozhraní“ v1.2 (25. 8. 2026), kap. 3.5.4
 * (R5.3, DECISIONS Ф10):
 *   < 0          dočasná chyba („odešlete později“; -999…-2 rezervováno)          → opakovat
 *   8            „technická chyba nebo chyba dat“ – nejednoznačná                 → omezené opakování
 *   2,3,4,6,7    kódování, XSD, podpis, struktura EIČ, příliš velká zpráva        → odmítnuto, opraví vlastník/provozovatel
 *   0 mimo ověřovací mód, 1, 5, 9–999 (rezervované / historické)                  → odmítnuto + upozornění provozovatele
 * Chybová odpověď FS není podepsaná (kap. 3.5).
 */
export type EetErrorClass = "temporary" | "ambiguous" | "permanent" | "unexpected";

const PERMANENT = new Set([2, 3, 4, 6, 7]);

export function classifyChyba(code: number): EetErrorClass {
  if (!Number.isInteger(code)) return "unexpected";
  if (code < 0) return "temporary";
  if (code === 8) return "ambiguous";
  if (PERMANENT.has(code)) return "permanent";
  return "unexpected";
}

/** Co s odmítnutou tržbou dělat – doplňuje text FS ve stavu tržby. */
export const CHYBA_HINT: Record<number, string> = {
  2: "zpráva nemá správné kódování – chyba pokladního softwaru, provozovatel ji řeší",
  3: "zpráva neodpovídá schématu XML – chyba pokladního softwaru nebo údajů tržby",
  4: "podpis zprávy je neplatný – zkontrolujte pokladní certifikát (nahrajte ho znovu)",
  6: "EIČ nemá platnou strukturu – opravte EIČ v nastavení",
  7: "zpráva je příliš velká – kontaktujte provozovatele",
  8: "Finanční správa opakovaně hlásí technickou chybu nebo chybu dat",
};

export function chybaHint(code: number): string {
  return CHYBA_HINT[code] ?? "neočekávaný kód odpovědi Finanční správy – provozovatel byl upozorněn";
}
