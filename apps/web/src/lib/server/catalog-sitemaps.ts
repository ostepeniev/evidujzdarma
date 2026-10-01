import "server-only";
import { hasDatabase } from "@ez/db";
import { SITEMAP_CHUNK, countIndexableEstablishments, countIndexableFirms } from "./catalog";

/**
 * Cesty sitemap katalogu firem pro robots.txt:
 *  - /firmy/sitemap.xml             seznamové stránky (kraje, obor × kraj, nové firmy)
 *  - /firma/sitemap/{n}.xml         stránky firem po ≤ 50 000 URL
 *  - /provozovna/sitemap/{n}.xml    stránky provozoven po ≤ 50 000 URL
 */
export async function catalogSitemapPaths(): Promise<string[]> {
  const out = ["/firmy/sitemap.xml"];
  if (!hasDatabase()) return out;
  const [firms, ests] = await Promise.all([countIndexableFirms().catch(() => 0), countIndexableEstablishments().catch(() => 0)]);
  for (let i = 0; i < Math.ceil(firms / SITEMAP_CHUNK); i++) out.push(`/firma/sitemap/${i}.xml`);
  for (let i = 0; i < Math.ceil(ests / SITEMAP_CHUNK); i++) out.push(`/provozovna/sitemap/${i}.xml`);
  return out;
}
