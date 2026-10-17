/**
 * S2: URL s IČO/IČP v query (?ico=, &ico=, ?icp=) tvoří téměř nekonečný prostor – jedna varianta na každý subjekt
 * (konkurent tak měl desítky tisíc návštěv robotů denně). Web na ně neodkazuje (IČO jde ve fragmentu #ico=…), staré
 * odkazy a odeslané formuláře ale existují. Zástupný znak „*“ podporují Google, Bing i Seznam; žádná cesta ze
 * STATIC_PAGES se tím neblokuje (R7.1) – „/kontrola-ico?“ blokuje jen variantu s parametry, ne samotnou stránku.
 * Výsledky kontroly IČO, předvyplněná námitka a vyhledávání v katalogu (/firmy?q=, IČO i název) jsou navíc noindex.
 */
export const QUERY_ID_DISALLOW = ["/*?ico=", "/*&ico=", "/*?icp=", "/*&icp=", "/kontrola-ico?", "/namitka?", "/firmy?q="] as const;
