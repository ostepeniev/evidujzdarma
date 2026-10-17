import "server-only";
import { hasDatabase } from "@ez/db";
import { SITEMAP_CHUNK, countIndexableEstablishments, countIndexableFirms } from "./catalog";

/**
 * Cesty sitemap katalogu firem pro robots.txt:
 *  - /firmy/sitemap.xml             seznamové stránky (kraje, obor × kraj, nové firmy)
 *  - /obor/sitemap/0.xml            stránky obor × obec (jen s ≥ OBEC_MIN_FIRMS ověřenými subjekty)
 *  - /firma/sitemap/{n}.xml         stránky firem po ≤ 50 000 URL
 *  - /provozovna/sitemap/{n}.xml    stránky provozoven po ≤ 50 000 URL
 *
 * Stránek obor × obec je řádově tisíce (10 oborů × obce nad prahem; odhad pro celou ČR 8–12 tisíc), vejdou se do jedné
 * sitemapy – robots.txt kvůli nim nepočítá agregace za kraje (studený výpočet za celou ČR trvá sekundy a pomalý
 * robots.txt bere Google jako nedostupný). Kdyby jich bylo přes 50 000, /obor/sitemap/{n}.xml je vygeneruje samo.
 */
export async function catalogSitemapPaths(): Promise<string[]> {
  const out = ["/firmy/sitemap.xml"];
  if (!hasDatabase()) return out;
  out.push("/obor/sitemap/0.xml");
  const [firms, ests] = await Promise.all([countIndexableFirms().catch(() => 0), countIndexableEstablishments().catch(() => 0)]);
  for (let i = 0; i < Math.ceil(firms / SITEMAP_CHUNK); i++) out.push(`/firma/sitemap/${i}.xml`);
  for (let i = 0; i < Math.ceil(ests / SITEMAP_CHUNK); i++) out.push(`/provozovna/sitemap/${i}.xml`);
  return out;
}
