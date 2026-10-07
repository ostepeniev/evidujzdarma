/**
 * S1.1 – IndexNow: oznámí Seznamu (a přes sdílení protokolu i Bingu) nové a změněné URL. Google IndexNow nepodporuje.
 * Spouští kontrolor po nasazení, ne web – žádný cron ani volání z běhu aplikace:
 *   pnpm --filter web indexnow -- --since 2026-10-07     URL ze sitemap.xml s lastmod >= datum
 *   pnpm --filter web indexnow -- --all                  všechny URL ze sitemap.xml
 *   pnpm --filter web indexnow -- --url https://evidujzdarma.cz/navody/eet-off …
 * Klíč je podle protokolu veřejný (není to tajemství): https://evidujzdarma.cz/<klíč>.txt = public/<klíč>.txt.
 * Nasazení nikdy neshodí: exit 0 i při chybě sítě nebo odpovědi 4xx; jen chybné argumenty skončí exit 2.
 * Bez importů z aplikace, aby běžel v čistém Node 22 (--experimental-strip-types) bez sestavení.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const HOST = "evidujzdarma.cz";
export const ORIGIN = `https://${HOST}`;
export const INDEXNOW_KEY = "912a26b93bca28e140cda1b6b2c8c464";
export const KEY_LOCATION = `${ORIGIN}/${INDEXNOW_KEY}.txt`;
export const ENDPOINT = "https://search.seznam.cz/indexnow";
export const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
/** strop protokolu na jeden požadavek */
export const MAX_URLS = 10_000;

export type Selection = { mode: "since"; since: number } | { mode: "all" } | { mode: "urls"; urls: string[] };
export interface SitemapEntry {
  loc: string;
  lastmod: number | null;
}
export interface Payload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export class ArgError extends Error {}

const USAGE = "Použití: pnpm --filter web indexnow -- --since <ISO datum> | --all | --url <URL>...";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** Vlastní URL webu v normalizovaném tvaru (https://evidujzdarma.cz/…), jinak null – cizí host, http, port, přihlašovací údaje. */
export function ownUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.host !== HOST || u.username || u.password) return null;
  u.hash = "";
  return u.href;
}

export function parseArgs(argv: readonly string[]): Selection {
  const args = argv.filter((a) => a !== "--");
  const [flag, ...rest] = args;
  if (flag === "--all") {
    if (rest.length) throw new ArgError(`--all nebere další argumenty: ${rest.join(" ")}`);
    return { mode: "all" };
  }
  if (flag === "--since") {
    const [value, ...extra] = rest;
    if (!value) throw new ArgError("--since potřebuje datum ve tvaru ISO, např. 2026-10-07");
    const since = Date.parse(value);
    if (!ISO_DATE.test(value) || Number.isNaN(since)) throw new ArgError(`--since: „${value}“ není datum ve tvaru ISO (např. 2026-10-07)`);
    if (extra.length) throw new ArgError(`--since nebere další argumenty: ${extra.join(" ")}`);
    return { mode: "since", since };
  }
  if (flag === "--url") {
    if (!rest.length) throw new ArgError("--url potřebuje aspoň jednu adresu");
    const urls = rest.map((r) => {
      const u = ownUrl(r);
      if (!u) throw new ArgError(`--url: „${r}“ není adresa ${ORIGIN}/…`);
      return u;
    });
    return { mode: "urls", urls: [...new Set(urls)] };
  }
  throw new ArgError(flag ? `neznámý argument „${flag}“` : "chybí argument");
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e]!);

/** <url><loc>…</loc><lastmod>…</lastmod></url> ze sitemap.xml; neplatný nebo chybějící lastmod = null. */
export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const [, body] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(body!)?.[1];
    if (!loc) continue;
    const lastmodRaw = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/.exec(body!)?.[1];
    const lastmod = lastmodRaw ? Date.parse(lastmodRaw) : NaN;
    out.push({ loc: unescapeXml(loc), lastmod: Number.isNaN(lastmod) ? null : lastmod });
  }
  return out;
}

/** Které URL poslat: --since podle lastmod (bez lastmod se nepošle), --all všechny, --url zadané. Jen vlastní URL, bez duplicit. */
export function selectUrls(entries: readonly SitemapEntry[], sel: Selection): string[] {
  const picked =
    sel.mode === "urls"
      ? sel.urls
      : entries.filter((e) => sel.mode === "all" || (e.lastmod !== null && e.lastmod >= sel.since)).map((e) => e.loc);
  return [...new Set(picked.map(ownUrl).filter((u): u is string => u !== null))];
}

/** Těla požadavků: jen https://evidujzdarma.cz/…, nejvýš MAX_URLS adres v jednom. */
export function buildPayloads(urls: readonly string[]): Payload[] {
  const own = [...new Set(urls.map(ownUrl).filter((u): u is string => u !== null))];
  const out: Payload[] = [];
  for (let i = 0; i < own.length; i += MAX_URLS) {
    out.push({ host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList: own.slice(i, i + MAX_URLS) });
  }
  return out;
}

export function describeStatus(status: number): { ok: boolean; message: string } {
  switch (status) {
    case 200:
      return { ok: true, message: "200 OK – URL přijaty." };
    case 202:
      return { ok: true, message: "202 Accepted – URL přijaty, klíč se ještě ověřuje." };
    case 400:
      return { ok: false, message: "400 Bad Request – neplatný formát požadavku." };
    case 403:
      return { ok: false, message: `403 Forbidden – klíč neplatí: ${KEY_LOCATION} musí vracet přesně klíč. Je soubor public/${INDEXNOW_KEY}.txt nasazený?` };
    case 422:
      return { ok: false, message: `422 Unprocessable Entity – některá URL nepatří k ${HOST} nebo klíč neodpovídá protokolu.` };
    case 429:
      return { ok: false, message: "429 Too Many Requests – příliš mnoho požadavků (možný spam). Zkuste to později a posílejte jen změněné URL (--since)." };
    default:
      return { ok: status >= 200 && status < 300, message: `${status} – neočekávaná odpověď vyhledávače.` };
  }
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function main(argv: readonly string[]): Promise<number> {
  let sel: Selection;
  try {
    sel = parseArgs(argv);
  } catch (e) {
    console.error(`${reason(e)}\n${USAGE}`);
    return 2;
  }
  let urls: string[];
  if (sel.mode === "urls") {
    urls = sel.urls;
  } else {
    try {
      const res = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        console.error(`${SITEMAP_URL}: HTTP ${res.status} – nic se neodeslalo.`);
        return 0;
      }
      urls = selectUrls(parseSitemap(await res.text()), sel);
    } catch (e) {
      console.error(`${SITEMAP_URL} se nepodařilo stáhnout (${reason(e)}) – nic se neodeslalo.`);
      return 0;
    }
  }
  const payloads = buildPayloads(urls);
  if (!payloads.length) {
    console.log("Žádné URL k odeslání.");
    return 0;
  }
  for (const [i, payload] of payloads.entries()) {
    const label = `[${i + 1}/${payloads.length}] ${payload.urlList.length} URL → ${ENDPOINT}`;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const d = describeStatus(res.status);
      (d.ok ? console.log : console.error)(`${label}: ${d.message}`);
    } catch (e) {
      console.error(`${label}: chyba sítě (${reason(e)}).`);
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
