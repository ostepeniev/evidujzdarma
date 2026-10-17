import { STATIC_PAGES } from "./static-pages";

/**
 * Odkaz „Vystavit fakturu této firmě“ na generátor faktur (/faktura-zdarma, samostatný proud S2-C).
 * Odběratel jde ve fragmentu (#odberatel=IČO), ne v query – roboti fragment neprocházejí (COMMON 9).
 */
export const FAKTURA_PATH = "/faktura-zdarma";

export function fakturaLink(ico: string): string {
  return `${FAKTURA_PATH}#odberatel=${ico}`;
}

/**
 * Generátor je zveřejněný, jen když je stránka v registru statických stránek (static-pages.ts). Do té doby
 * katalog na /faktura-zdarma neodkazuje – žádný odkaz na 404, ať se proudy sloučí v jakémkoli pořadí.
 */
export function hasFakturaPage(): boolean {
  return STATIC_PAGES.some((p) => p.path === FAKTURA_PATH);
}
