/**
 * Které údaje katalog firem zobrazuje – stejný seznam v zásadách i na stránce námitky a odpovídá tomu, co
 * vykresluje /firma/[slug] a /provozovna/[slug] (R7.8, Z9). Změníte-li stránku firmy, změňte i tento seznam.
 * S3 (LIA): u fyzických osob jen obec, bez DIČ a bez provozoven a živností ze živnostenského rejstříku.
 */
export const CATALOG_DATA =
  "název (u fyzických osob jméno a příjmení), IČO, právní forma, data vzniku a zániku, sídlo (u fyzických osob jen obec), kraj, obory činnosti (CZ-NACE), zda je plátce DPH a jen u právnických osob také DIČ a provozovny ze živnostenského rejstříku (IČP, název, adresa, datum zahájení a živnosti)";
