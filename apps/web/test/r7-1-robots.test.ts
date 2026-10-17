/**
 * R7.1 (рецензія №4, B N1) – robots.txt nesmí blokovat veřejné stránky. Disallow je prefix (RFC 9309), takže
 * „Disallow: /u“ chytal i /ucetni. Uzavřené sekce se zakazují jako „/u$“ (přesně) a „/u/“ (vše pod).
 */
import { describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";

vi.mock("@/lib/sitemap-registry", () => ({ extraSitemaps: async () => [] }));
// zavřená pokladna (do 2. 11.) simulovaná ze skutečných seznamů – commit otevření test nerozbije (R17.2)
mockLaunch("closed");
const { default: robots } = await import("@/app/robots");
const { STATIC_PAGES } = await import("@/lib/static-pages");

/** Blokuje pravidlo cestu? `$` na konci = přesná shoda (Google, Bing). */
const blocks = (rule: string, path: string) => (rule.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule));

describe("R7.1 – robots.txt does not block public pages", () => {
  it("gate: no Disallow blocks a STATIC_PAGES path; /u/x and /pokladna are blocked", async () => {
    const r = await robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    for (const rule of rules) {
      const dis = ([] as string[]).concat(rule.disallow ?? []);
      const blocked = STATIC_PAGES.flatMap((p) => dis.filter((d) => blocks(d, p.path)).map((d) => `${p.path} <- ${d}`));
      expect(blocked, String(rule.userAgent)).toEqual([]);
      for (const p of ["/u/x", "/pokladna", "/pokladna/nastaveni", "/u"]) expect(dis.some((d) => blocks(d, p)), p).toBe(true);
      // S3: katalog je otevřený – robots.txt ho nesmí blokovat (sitemapy katalogu jsou v robots.txt)
      for (const p of ["/firmy", "/firma/12345679-x", "/firma/sitemap/0.xml", "/obor/kadernictvi-a-kosmetika/kraj/karlovarsky", "/provozovna/1-x"]) expect(dis.some((d) => blocks(d, p)), p).toBe(false);
    }
  });
});
