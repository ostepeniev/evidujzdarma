import "server-only";
import { SITE } from "@/lib/site";

/**
 * IndexNow — okamžité oznámení nových/změněných URL vyhledávačům (Bing → ChatGPT search, Seznam, Yandex).
 * Klíč se ověřuje souborem https://{domena}/{INDEXNOW_KEY}.txt (rewrite v next.config).
 */
export async function submitToIndexNow(urls: string[]): Promise<{ submitted: number; status: number | null }> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || !urls.length) return { submitted: 0, status: null };
  let status: number | null = null;
  for (let i = 0; i < urls.length; i += 10_000) {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: SITE.domain, key, keyLocation: `https://${SITE.domain}/${key}.txt`, urlList: urls.slice(i, i + 10_000) }),
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
  }
  return { submitted: urls.length, status };
}
