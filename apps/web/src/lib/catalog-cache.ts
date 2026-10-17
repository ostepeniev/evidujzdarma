import { CATALOG_CLOSED } from "./launch";

/**
 * Cache-Control seznamových stránek katalogu (S2, výkon pro 1M+ stránek na malém serveru). Stránky se renderují
 * dynamicky (bez ISR cache na disku, R3.3); krátké s-maxage dovolí budoucímu CDN odlehčit serveru, prohlížeč si je
 * neukládá (max-age=0). Jen pro seznamy (/firmy, /obor): /firma a /provozovna mohou být živý dotaz do ARES s limitem
 * na IP – takovou odpověď (i 404 po limitu) nesmí sdílená cache rozdávat dalším.
 * Dokud je katalog za heslem (CATALOG_CLOSED), hlavičku nepřidáváme: s-maxage by sdílené cache dovolilo vydat
 * stránku chráněnou basic auth i bez hesla (RFC 9111, 3.5).
 */
export const CATALOG_LIST_CACHE_CONTROL = "public, max-age=0, s-maxage=600, stale-while-revalidate=3600";

export function catalogCacheHeaders(closed: boolean = CATALOG_CLOSED): { source: string; headers: { key: string; value: string }[] }[] {
  if (closed) return [];
  const headers = [{ key: "Cache-Control", value: CATALOG_LIST_CACHE_CONTROL }];
  return [
    { source: "/firmy/:path*", headers },
    { source: "/obor/:path*", headers },
  ];
}
