import type { MetadataRoute } from "next";
import { CATALOG_CLOSED, CLOSED_SECTIONS } from "@/lib/launch";
import { SITE_URL } from "@/lib/site";
import { extraSitemaps } from "@/lib/sitemap-registry";

export const dynamic = "force-dynamic";

// Výslovně povolujeme vyhledávače i AI crawlery — chceme být citováni v odpovědích AI.
const AI_AND_SEARCH_BOTS = [
  "Googlebot",
  "Bingbot",
  "SeznamBot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "DuckDuckBot",
];

// Uzavřené sekce (eet-open-site): „/pokladna$“ přesně a „/pokladna/“ vše pod. Disallow je prefix (RFC 9309),
// takže samotné „/u“ by zakázalo i „/ucetni“ (R7.1).
const PRIVATE = ["/api/", "/ucet/", "/registrace/", ...CLOSED_SECTIONS.flatMap((p) => [`${p}$`, `${p}/`])];

export default async function robots(): Promise<MetadataRoute.Robots> {
  // sitemapy katalogu až s otevřením katalogu
  const extra = CATALOG_CLOSED ? [] : await extraSitemaps();
  return {
    rules: [
      { userAgent: AI_AND_SEARCH_BOTS, allow: "/", disallow: PRIVATE },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, ...extra.map((p) => `${SITE_URL}${p}`)],
    host: SITE_URL,
  };
}
