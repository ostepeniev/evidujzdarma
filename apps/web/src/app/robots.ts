import type { MetadataRoute } from "next";
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

const PRIVATE = ["/api/", "/pokladna/", "/ucet/", "/registrace/", "/prihlaseni"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const extra = await extraSitemaps();
  return {
    rules: [
      { userAgent: AI_AND_SEARCH_BOTS, allow: "/", disallow: PRIVATE },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, ...extra.map((p) => `${SITE_URL}${p}`)],
    host: SITE_URL,
  };
}
