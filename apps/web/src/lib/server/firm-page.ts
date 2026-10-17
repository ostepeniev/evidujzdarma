import "server-only";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cache } from "react";
import { parseFirmSlug, slugDecision } from "@/components/catalog/paths";
import { AresUnavailableError, getFirmView, isFirmInCatalog, type FirmView } from "./catalog";
import { rateLimit } from "./rate-limit";

export type FirmPageState = { kind: "firm"; firm: FirmView } | { kind: "unavailable"; ico: string };

/** Kanonická cesta stránky firmy: v katalogu /firma/{IČO}-{slug}, živý náhled z ARES (mimo DB) /firma/{IČO}. */
export function firmPagePath(firm: { ico: string; slug: string; inDb: boolean }): string {
  return firm.inDb ? `/firma/${firm.ico}-${firm.slug}` : `/firma/${firm.ico}`;
}

/**
 * Data pro /firma/[slug]. Deduplikováno v rámci requestu (metadata + stránka), takže živý dotaz
 * se do limitu na IP počítá jednou. Výpadek ARES → stav „unavailable“ (R4); chyba DB se propaguje.
 *
 * S3 – sdílená cache (nginx, Cache-Control z next.config): všechno pod /firma/{IČO}-{slug} závisí jen na DB, ne na IP.
 * Živý náhled z ARES (limit na IP, výpadek ARES) má vlastní adresu /firma/{IČO} bez slugu a necachuje se;
 * firma mimo katalog se slugem v adrese se na ni přesměruje (bez dotazu do ARES).
 */
export const loadFirmPage = cache(async (slugParam: string, ip: string): Promise<FirmPageState> => {
  const parsed = parseFirmSlug(slugParam);
  if (!parsed) notFound();
  const inCatalog = await isFirmInCatalog(parsed.ico);
  // dočasné přesměrování (307): firma se může do katalogu dostat při příštím importu
  if (!inCatalog && parsed.suffix !== "") redirect(`/firma/${parsed.ico}`);
  // Firmy mimo naši DB (živě z ARES) se renderují dynamicky, bez ISR cache, a s limitem na IP (R3.3)
  if (!inCatalog && !rateLimit(`firm-live:${ip}`, 30, 3600)) notFound();
  let firm: FirmView | null;
  try {
    firm = await getFirmView(parsed.ico);
  } catch (e) {
    if (e instanceof AresUnavailableError) return { kind: "unavailable", ico: parsed.ico };
    throw e;
  }
  // zaniklý subjekt: 90 dnů po zániku stránku nezobrazujeme (LIA, docs/LIA-katalog-firem.md)
  if (!firm || firm.gone) notFound();
  if (firm.inDb) {
    const decision = slugDecision(parsed.suffix, firm.slug);
    if (decision === "notfound") notFound();
    if (decision === "redirect") permanentRedirect(firmPagePath(firm));
  }
  return { kind: "firm", firm };
});
