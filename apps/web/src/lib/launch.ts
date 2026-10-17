/**
 * Co je na webu veřejné (eet-open-site, docs/tasks/2026-10-03-open-site.md). Veřejný je obsah, nástroje, předregistrace
 * a od S3 i katalog firem (/firmy, /firma, /provozovna, /obor): test oprávněného zájmu je hotový (docs/LIA-katalog-firem.md),
 * OSVČ jsou noindex a v seznamech jen počtem (lib/catalog-policy.ts). Pokladna, přihlášení, Účetní kabinet, pozvánky
 * a účtenky se otevírají 2. 11. 2026 (DECISIONS П6). Uzavřené sekce hlídá basic auth v nginx (regex v
 * infra/nginx/evidujzdarma.conf – měňte obě místa); web na ně neodkazuje, robots.txt je zakazuje a sitemapy je
 * neobsahují. Otevření sekce = odebrat ji odsud.
 */
export const CLOSED_SECTIONS = ["/pokladna", "/prihlaseni", "/kabinet", "/pozvanka", "/u"] as const;

/** API uzavřených sekcí (session cookie) – pro nginx; /api/pokladna/* zůstává otevřené (token zařízení). */
export const CLOSED_API = ["/api/ucet", "/api/auth", "/api/kabinet", "/api/pozvanka"] as const;

/** Patří cesta do uzavřené sekce? Porovnává celé segmenty („/u“ neschová „/ucetni“). */
export function isClosed(path: string): boolean {
  return [...CLOSED_SECTIONS, ...CLOSED_API].some((p) => path === p || path.startsWith(`${p}/`));
}

/** Je katalog firem uzavřený? Od S3 ne – sitemapy katalogu jsou v robots.txt a seznamy mají sdílenou cache. */
export const CATALOG_CLOSED = isClosed("/firmy");
