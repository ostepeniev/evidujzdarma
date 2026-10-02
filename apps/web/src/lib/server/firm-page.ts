import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { firmPath, parseFirmSlug, slugDecision } from "@/components/catalog/paths";
import { AresUnavailableError, getFirmView, isFirmInCatalog, type FirmView } from "./catalog";
import { rateLimit } from "./rate-limit";

export type FirmPageState = { kind: "firm"; firm: FirmView } | { kind: "unavailable"; ico: string };

/**
 * Data pro /firma/[slug]. Deduplikováno v rámci requestu (metadata + stránka), takže živý dotaz
 * se do limitu na IP počítá jednou. Výpadek ARES → stav „unavailable“ (R4); chyba DB se propaguje.
 */
export const loadFirmPage = cache(async (slugParam: string, ip: string): Promise<FirmPageState> => {
  const parsed = parseFirmSlug(slugParam);
  if (!parsed) notFound();
  // Firmy mimo naši DB (živě z ARES) se renderují dynamicky, bez ISR cache, a s limitem na IP (R3.3)
  if (!(await isFirmInCatalog(parsed.ico)) && !rateLimit(`firm-live:${ip}`, 30, 3600)) notFound();
  let firm: FirmView | null;
  try {
    firm = await getFirmView(parsed.ico);
  } catch (e) {
    if (e instanceof AresUnavailableError) return { kind: "unavailable", ico: parsed.ico };
    throw e;
  }
  if (!firm) notFound();
  const decision = slugDecision(parsed.suffix, firm.slug);
  if (decision === "notfound") notFound();
  if (decision === "redirect") permanentRedirect(firmPath(firm));
  return { kind: "firm", firm };
});
