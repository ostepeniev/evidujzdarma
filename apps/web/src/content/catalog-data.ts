/**
 * Které údaje katalog firem zobrazuje – stejný seznam v zásadách i na stránce námitky a odpovídá tomu, co
 * vykresluje /firma/[slug] a /provozovna/[slug] (R7.8, Z9). Změníte-li stránku firmy, změňte i tento seznam.
 */
export const CATALOG_DATA =
  "název, IČO, DIČ, zda je plátce DPH, právní forma, data vzniku a zániku, sídlo (u fyzických osob jen obec), kraj, obory činnosti (CZ-NACE) a provozovny ze živnostenského rejstříku (IČP, název, adresa – u fyzických osob jen obec – a datum zahájení)";
