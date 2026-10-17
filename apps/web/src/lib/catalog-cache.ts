import { CATALOG_CLOSED } from "./launch";

/**
 * Cache-Control stránek katalogu (S2, S3 – výkon na sdíleném serveru 2 vCPU). Stránky se renderují dynamicky
 * (force-dynamic, bez ISR cache na disku, R3.3). Next 16 v produkci u dynamické stránky Cache-Control z next.config
 * ponechá (app-page: `if (!res.getHeader('Cache-Control'))`), takže s-maxage dovolí sdílené cache – mikrocache nginx
 * (infra/nginx/evidujzdarma-cache.conf) a případně CDN – odlehčit serveru. Prohlížeč si stránku neukládá (max-age=0).
 *
 *  - /firmy, /obor, /provozovna a /firma/{IČO}-{slug}: jen data z DB (stejná pro všechny), sdílená cache smí;
 *  - /firma/{IČO} bez slugu: živý náhled z ARES s limitem na IP (i 404 po limitu, výpadek ARES) – nikdy do sdílené cache
 *    (lib/server/firm-page.ts sem přesměruje každou firmu mimo katalog). Pozdější pravidlo pro stejnou hlavičku vyhrává.
 * Dokud je katalog za heslem (CATALOG_CLOSED), hlavičky nepřidáváme: s-maxage by sdílené cache dovolilo vydat stránku
 * chráněnou basic auth i bez hesla (RFC 9111, 3.5).
 */
export const CATALOG_CACHE_CONTROL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
/** Zpětná kompatibilita (S2): seznamy mají stejnou hlavičku jako ostatní stránky katalogu. */
export const CATALOG_LIST_CACHE_CONTROL = CATALOG_CACHE_CONTROL;
export const CATALOG_LIVE_CACHE_CONTROL = "private, no-store";

export function catalogCacheHeaders(closed: boolean = CATALOG_CLOSED): { source: string; headers: { key: string; value: string }[] }[] {
  if (closed) return [];
  const shared = [{ key: "Cache-Control", value: CATALOG_CACHE_CONTROL }];
  return [
    { source: "/firmy/:path*", headers: shared },
    { source: "/obor/:path*", headers: shared },
    { source: "/provozovna/:path*", headers: shared },
    { source: "/firma/:slug", headers: shared },
    // živý náhled z ARES (/firma/12345678) – musí být až za /firma/:slug, aby jeho hlavičku přepsal
    { source: "/firma/:ico(\\d{8})", headers: [{ key: "Cache-Control", value: CATALOG_LIVE_CACHE_CONTROL }] },
  ];
}
