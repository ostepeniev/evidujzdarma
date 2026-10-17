/**
 * S3 – pravidla zveřejnění katalogu firem (čisté funkce, bez DB). Odpovídají testu oprávněného zájmu
 * v docs/LIA-katalog-firem.md – změníte-li pravidlo tady, změňte i dokument a zásady ochrany osobních údajů.
 *
 *  - podnikající fyzické osoby (OSVČ): stránka existuje (dohledání podle IČO), ale vždy noindex, mimo sitemapu
 *    a v seznamech jen počtem. Přepínač CATALOG_INDEX_PERSONS=1 je připravený pro případnou změnu po posouzení
 *    právníkem (výchozí 0 = neindexovat);
 *  - zaniklý subjekt: ze seznamů hned, stránka noindex; po DISSOLVED_GONE_DAYS dnech od zániku stránka zmizí (404).
 */

/** Po kolika dnech od zániku stránka zaniklého subjektu zmizí (404). */
export const DISSOLVED_GONE_DAYS = 90;

/** Indexovat stránky OSVČ? Výchozí ne (rozhodnutí majitele, S3); „1“ jen po posouzení právníkem. */
export function indexPersons(env: Record<string, string | undefined> = process.env): boolean {
  return env.CATALOG_INDEX_PERSONS === "1";
}

/** Počet dní mezi dvěma daty YYYY-MM-DD (to − from). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
  const b = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** Zanikl subjekt před víc než DISSOLVED_GONE_DAYS dny? Pak stránku nezobrazujeme vůbec. */
export function isGone(dissolvedAt: string | null | undefined, today: string): boolean {
  if (!dissolvedAt || !/^\d{4}-\d{2}-\d{2}/.test(dissolvedAt)) return false;
  return daysBetween(dissolvedAt.slice(0, 10), today) > DISSOLVED_GONE_DAYS;
}

/** Proč stránka subjektu není indexovaná (null = indexuje se). Pořadí = priorita důvodu. */
export type CatalogNoindexReason = "objection" | "dissolved" | "person" | "region" | "unverified" | "not-in-db";

export function catalogNoindexReason(
  f: { noindex: boolean; dissolvedAt: string | null; natural: boolean; indexRegion: boolean; verified: boolean },
  opts: { requireAres: boolean; indexPersons: boolean },
): CatalogNoindexReason | null {
  if (f.noindex) return "objection";
  if (f.dissolvedAt) return "dissolved";
  if (f.natural && !opts.indexPersons) return "person";
  if (!f.indexRegion) return "region";
  if (opts.requireAres && !f.verified) return "unverified";
  return null;
}
