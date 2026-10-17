/**
 * Zátěžový test katalogu firem (S3) – bez závislostí, jen fetch a Promise.all.
 *
 *   pnpm --filter @ez/worker exec tsx src/catalog/loadtest.ts -- [volby]
 *   (na serveru: cd /opt/evidujzdarma/apps/worker && node --import tsx src/catalog/loadtest.ts --base http://127.0.0.1:3100)
 *
 * URL bere ze sitemap katalogu, které vypisuje robots.txt (/firmy/sitemap.xml, /obor/sitemap/0.xml, /firma/sitemap/N.xml…),
 * a stáhne je z `--base` (absolutní adresy ze sitemap se přepíšou na --base). Pak pošle `--requests` požadavků po
 * `--concurrency` souběžně a vypíše p50/p95/p99, nejpomalejší URL a chyby.
 *
 * Volby:
 *   --base <url>          kam posílat (výchozí http://127.0.0.1:3100 = web přímo, bez nginx; přes nginx https://evidujzdarma.cz)
 *   --concurrency <n>     souběžných požadavků (výchozí 8)
 *   --requests <n>        počet požadavků celkem (výchozí 400; URL se opakují, když jich je méně)
 *   --urls <n>            kolik různých URL ze sitemap vzít (výchozí 200, náhodný, ale opakovatelný výběr)
 *   --prefix <cesta>      jen URL začínající cestou, např. /firma/ nebo /obor/
 *   --timeout <ms>        časový limit jednoho požadavku (výchozí 15000)
 *   --seed <n>            semínko výběru URL (výchozí 1)
 *
 * Měří celý požadavek včetně stažení těla. Přesměrování nenásleduje (počítá se jako odpověď 3xx).
 * Na sdíleném serveru pouštějte mimo špičku a s rozumnou souběžností (8–16) – test zatěžuje i ostatní aplikace.
 */
import { argNumber, argString, parseArgs } from "./common.ts";

interface Sample {
  url: string;
  ms: number;
  status: number;
  bytes: number;
  cache: string | null;
  error?: string;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kvantil (0–1) ze seřazeného pole. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i]!;
}

function rebase(url: string, base: string): string {
  const u = new URL(url, base);
  const b = new URL(base);
  return `${b.origin}${u.pathname}${u.search}`;
}

async function text(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "EvidujZdarma loadtest (S3)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function collectUrls(base: string, timeoutMs: number): Promise<string[]> {
  const robots = await text(`${base}/robots.txt`, timeoutMs);
  const maps = [...robots.matchAll(/^Sitemap:\s*(\S+)/gim)].map((m) => rebase(m[1]!, base)).filter((u) => /\/(firmy|firma|obor|provozovna)\//.test(u));
  const urls: string[] = [];
  for (const map of maps) {
    try {
      const xml = await text(map, timeoutMs);
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(rebase(m[1]!.replace(/&amp;/g, "&"), base));
    } catch (e) {
      console.error(`sitemapa ${map}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return [...new Set(urls)];
}

async function hit(url: string, timeoutMs: number): Promise<Sample> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "EvidujZdarma loadtest (S3)" } });
    const body = await res.arrayBuffer();
    return { url, ms: performance.now() - t0, status: res.status, bytes: body.byteLength, cache: res.headers.get("x-cache-status") };
  } catch (e) {
    return { url, ms: performance.now() - t0, status: 0, bytes: 0, cache: null, error: e instanceof Error ? e.name : String(e) };
  }
}

async function main() {
  const args = parseArgs();
  const base = (argString(args, "base") ?? "http://127.0.0.1:3100").replace(/\/$/, "");
  const concurrency = Math.max(1, Math.min(64, argNumber(args, "concurrency", 8)));
  const total = Math.max(1, argNumber(args, "requests", 400));
  const maxUrls = Math.max(1, argNumber(args, "urls", 200));
  const timeoutMs = Math.max(1000, argNumber(args, "timeout", 15_000));
  const prefix = argString(args, "prefix");
  const random = rng(argNumber(args, "seed", 1));

  let urls = await collectUrls(base, timeoutMs);
  if (prefix) urls = urls.filter((u) => new URL(u).pathname.startsWith(prefix));
  if (urls.length === 0) {
    console.error("Ze sitemap katalogu jsme nezískali žádnou URL (je katalog otevřený a v DB jsou data?).");
    process.exitCode = 2;
    return;
  }
  for (let i = urls.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [urls[i], urls[j]] = [urls[j]!, urls[i]!];
  }
  urls = urls.slice(0, maxUrls);
  console.log(`${urls.length} URL, ${total} požadavků, souběžně ${concurrency}, cíl ${base}`);

  const samples: Sample[] = [];
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (;;) {
        const i = next++;
        if (i >= total) return;
        samples.push(await hit(urls[i % urls.length]!, timeoutMs));
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;

  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const byStatus = new Map<string, number>();
  for (const s of samples) byStatus.set(s.error ? `chyba ${s.error}` : String(s.status), (byStatus.get(s.error ? `chyba ${s.error}` : String(s.status)) ?? 0) + 1);
  const errors = samples.filter((s) => s.error || s.status >= 500).length;
  const cache = new Map<string, number>();
  for (const s of samples) if (s.cache) cache.set(s.cache, (cache.get(s.cache) ?? 0) + 1);
  const fmt = (n: number) => `${Math.round(n)} ms`;

  console.log(`hotovo za ${seconds.toFixed(1)} s – ${(samples.length / seconds).toFixed(1)} req/s`);
  console.log(`latence: p50 ${fmt(quantile(ms, 0.5))} · p95 ${fmt(quantile(ms, 0.95))} · p99 ${fmt(quantile(ms, 0.99))} · max ${fmt(ms[ms.length - 1] ?? 0)}`);
  console.log(`stavy: ${[...byStatus].map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  if (cache.size) console.log(`nginx X-Cache-Status: ${[...cache].map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  console.log(`chyby (síť, časový limit, 5xx): ${errors} z ${samples.length}`);
  console.log("nejpomalejší:");
  for (const s of [...samples].sort((a, b) => b.ms - a.ms).slice(0, 5)) console.log(`  ${fmt(s.ms)}  ${s.status || s.error}  ${new URL(s.url).pathname}`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
