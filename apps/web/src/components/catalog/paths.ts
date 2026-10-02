/**
 * Cesty a formátování katalogu firem (čisté funkce — použitelné na serveru i v klientu).
 */

export function firmPath(f: { ico: string; slug: string }): string {
  return `/firma/${f.ico}-${f.slug}`;
}

export function establishmentPath(e: { icp: string; slug: string }): string {
  return `/provozovna/${e.icp}-${e.slug}`;
}

export function krajPath(krajSlug: string, opts: { page?: number; eet?: string } = {}): string {
  const qs = new URLSearchParams();
  if (opts.eet) qs.set("eet", opts.eet);
  if (opts.page && opts.page > 1) qs.set("strana", String(opts.page));
  const q = qs.toString();
  return `/firmy/kraj/${krajSlug}${q ? `?${q}` : ""}`;
}

export function oborKrajPath(obor: string, krajSlug: string, page?: number): string {
  return `/obor/${obor}/kraj/${krajSlug}${page && page > 1 ? `?strana=${page}` : ""}`;
}

export function monthPath(month: string, page?: number): string {
  return `/firmy/nove/${month}${page && page > 1 ? `?strana=${page}` : ""}`;
}

export function aresUrl(ico: string): string {
  return `https://ares.gov.cz/ekonomicke-subjekty?ico=${ico}`;
}

export function objectionPath(q: { ico?: string; icp?: string }): string {
  const qs = new URLSearchParams();
  if (q.ico) qs.set("ico", q.ico);
  if (q.icp) qs.set("icp", q.icp);
  const s = qs.toString();
  return `/namitka${s ? `?${s}` : ""}`;
}

/** "12345679-jana-testovaci" → { ico, suffix }; IČO musí mít přesně 8 číslic. */
/**
 * Co udělat se suffixem v URL firmy/provozovny: kanonický → vykreslit, prázdný → jedno přesměrování,
 * cokoli jiného → 404. Přesměrování z libovolného suffixu by z každé URL dělalo nový záznam v cache (R3.3).
 */
export function slugDecision(suffix: string, canonical: string): "ok" | "redirect" | "notfound" {
  if (suffix === canonical) return "ok";
  return suffix === "" ? "redirect" : "notfound";
}

export function parseFirmSlug(param: string): { ico: string; suffix: string } | null {
  const m = safeDecode(param).match(/^(\d{8})(?:-(.*))?$/);
  return m ? { ico: m[1]!, suffix: m[2] ?? "" } : null;
}

/** "1001234567-kadernictvi-karlovy-vary" → { icp, suffix }. */
export function parseEstablishmentSlug(param: string): { icp: string; suffix: string } | null {
  const m = safeDecode(param).match(/^(\d{6,12})(?:-(.*))?$/);
  return m ? { icp: m[1]!, suffix: m[2] ?? "" } : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** "2026-09-15" → "15. 9. 2026" (bez převodu časových pásem). */
export function dateCs(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const s = typeof iso === "string" ? iso : iso.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
}

const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

/** "2026-09" → "září 2026" */
export function monthLabel(month: string): string {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export function isMonthParam(s: string): boolean {
  const m = s.match(/^(\d{4})-(\d{2})$/);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1990 && Number(m[1]) <= 2100;
}

/** `?strana=` → kladné celé číslo (neplatné → 1). */
export function pageParam(v: string | string[] | undefined, max = 500): number {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : 1;
}

export function formatCount(n: number): string {
  return n.toLocaleString("cs-CZ");
}
