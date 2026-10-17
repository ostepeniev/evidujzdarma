/**
 * Cesty a formátování katalogu firem (čisté funkce — použitelné na serveru i v klientu).
 */
import { slugify } from "@ez/cz/slug";

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

/**
 * Obec v URL: "{kód obce}-{slug názvu}" (jako /firma/{IČO}-{slug}). Kód je jednoznačný – jmen obcí je v ČR
 * hodně stejných (Lhota, Nová Ves…), slug je jen pro čitelnost a kanonický tvar hlídá slugDecision().
 */
export function obecSlug(obec: { code: number; name: string }): string {
  return `${obec.code}-${slugify(obec.name, 60) || "obec"}`;
}

export function oborObecPath(obor: string, obec: { code: number; name: string }, page?: number): string {
  return `/obor/${obor}/obec/${obecSlug(obec)}${page && page > 1 ? `?strana=${page}` : ""}`;
}

/** Rozcestník obce (S3): /firmy/obec/{kód}-{slug}. */
export function obecHubPath(obec: { code: number; name: string }, page?: number): string {
  return `/firmy/obec/${obecSlug(obec)}${page && page > 1 ? `?strana=${page}` : ""}`;
}

/** "554961-karlovy-vary" → { code: 554961, suffix: "karlovy-vary" } */
export function parseObecSlug(param: string): { code: number; suffix: string } | null {
  const m = safeDecode(param).match(/^(\d{1,9})(?:-(.*))?$/);
  if (!m) return null;
  const code = Number(m[1]);
  return code > 0 ? { code, suffix: m[2] ?? "" } : null;
}

export function monthPath(month: string, page?: number): string {
  return `/firmy/nove/${month}${page && page > 1 ? `?strana=${page}` : ""}`;
}

export function aresUrl(ico: string): string {
  return `https://ares.gov.cz/ekonomicke-subjekty?ico=${ico}`;
}

/**
 * Právní formy zapisované do veřejného rejstříku (obchodní, spolkový, nadační rejstřík, rejstřík o. p. s., ústavů a SVJ),
 * které hledá or.justice.cz: v.o.s., s.r.o., k.s., a.s., družstvo, o. p. s., SVJ, ústav, nadace, nadační fond, spolek.
 */
const PUBLIC_REGISTER_FORMS = new Set(["111", "112", "113", "121", "205", "141", "145", "161", "117", "118", "706"]);

export function inPublicRegister(legalForm: string | null | undefined): boolean {
  return !!legalForm && PUBLIC_REGISTER_FORMS.has(legalForm);
}

/** Vyhledání subjektu podle IČO ve Veřejném rejstříku a Sbírce listin (or.justice.cz; ověřeno 17. 10. 2026). */
export function justiceUrl(ico: string): string {
  return `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${ico}`;
}

/** Vyhledání adresy na Mapy.com (dřív Mapy.cz) – jen externí odkaz, žádná vložená mapa ani skript (ověřeno 17. 10. 2026). */
export function mapyUrl(address: string): string {
  return `https://mapy.com/cs/zakladni?q=${encodeURIComponent(address)}`;
}

/**
 * Námitka k IČO/IČP: údaje ve fragmentu (#ico=…&icp=…), ne v query – z každé stránky firmy by jinak vedla
 * jiná URL a roboti by procházeli milion variant /namitka (COMMON 9). Formulář si fragment přečte sám.
 */
export function objectionPath(q: { ico?: string; icp?: string }): string {
  const qs = new URLSearchParams();
  if (q.ico) qs.set("ico", q.ico);
  if (q.icp) qs.set("icp", q.icp);
  const s = qs.toString();
  return `/namitka${s ? `#${s}` : ""}`;
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
