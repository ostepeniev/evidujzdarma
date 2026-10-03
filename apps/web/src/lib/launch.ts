/**
 * Co je na webu veřejné (eet-open-site, docs/tasks/2026-10-03-open-site.md). Veřejný je obsah, nástroje
 * a předregistrace. Pokladna, přihlášení, Účetní kabinet, pozvánky a účtenky čekají na obchodní podmínky po právníkovi,
 * katalog firem na test proporcionality (LIA, DECISIONS „Відкрите“ 6). Uzavřené sekce hlídá basic auth v nginx;
 * web na ně neodkazuje, robots.txt je zakazuje a sitemapy je neobsahují. Otevření sekce = odebrat ji odsud.
 */
export const CLOSED_SECTIONS = ["/pokladna", "/prihlaseni", "/kabinet", "/pozvanka", "/u", "/firmy", "/firma", "/provozovna", "/obor"] as const;

/** API uzavřených sekcí (session cookie) – pro nginx; /api/pokladna/* zůstává otevřené (token zařízení). */
export const CLOSED_API = ["/api/ucet", "/api/auth", "/api/kabinet", "/api/pozvanka"] as const;

/** Patří cesta do uzavřené sekce? Porovnává celé segmenty („/u“ neschová „/ucetni“). */
export function isClosed(path: string): boolean {
  return [...CLOSED_SECTIONS, ...CLOSED_API].some((p) => path === p || path.startsWith(`${p}/`));
}

/** Katalog firem je uzavřený – jeho sitemapy se nezveřejňují. */
export const CATALOG_CLOSED = isClosed("/firmy");
