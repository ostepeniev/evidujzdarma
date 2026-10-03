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

// uzavřené sekce (eet-open-site) – i bez lomítka, ať robot nezkouší ani „/pokladna“
const PRIVATE = ["/api/", "/ucet/", "/registrace/", ...CLOSED_SECTIONS.flatMap((p) => [p, `${p}/`])];

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
