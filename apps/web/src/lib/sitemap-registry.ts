import "server-only";

/**
 * Další sitemapy mimo hlavní /sitemap.xml (např. katalog firem po 50 000 URL).
 * Sekce se registrují zde, robots.txt je vypíše všechny.
 */
export async function extraSitemaps(): Promise<string[]> {
  const out: string[] = [];
  try {
    const mod = await import("./server/catalog-sitemaps");
    out.push(...(await mod.catalogSitemapPaths()));
  } catch {
    // katalog ještě není nasazen nebo DB není dostupná
  }
  return out;
}
