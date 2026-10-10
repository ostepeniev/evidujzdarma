import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { gte, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { SITE_URL } from "@/lib/site";
import { sitePages } from "@/lib/site-pages";
import { clientIpFromHeaders } from "./rate-limit";

/**
 * Měření návštěvnosti bez cookies a bez ukládání IP (R15.1, zásady „Měření návštěvnosti“).
 *  - Unikátní návštěvník za den = sha256(denní sůl + IP + User-Agent). Sůl je náhodná, jen v paměti a mění se o půlnoci
 *    (Praha); otisky jsou jen v paměti aktuálního dne. Do DB jdou jen čísla po dnech (analytics_daily).
 *  - Boti, DNT: 1 a Sec-GPC: 1 se nepočítají vůbec – ani zobrazení, ani události trychtýře.
 *  - Jen stránky z rejstříku webu (sitemap.xml, R16.1); bez měst, zemí, celých adres odkazujících stránek a query.
 * Restart serveru během dne vygeneruje novou sůl – tentýž člověk se ten den může započítat dvakrát (horní odhad).
 */

/** Roboti a nástroje (stejný seznam jako u rozboru logu): obecné značky + známí AI a sociální roboti. */
export const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|preview|curl|wget|python|httpx|aiohttp|go-http|java\/|okhttp|libwww|scrapy|headless|phantom|lighthouse|pagespeed|facebookexternalhit|embedly|monitor|uptime|gptbot|chatgpt|oai-searchbot|claude|anthropic|perplexity|ccbot|bytespider|amazonbot|applebot|google-extended|cohere|diffbot|seznambot|petalbot|yandex|baiduspider|duckduckbot|semrush|ahrefs|mj12/i;

export const FUNNEL_EVENTS = ["ico_check", "quiz_done", "calculator_used", "prereg_submitted", "prereg_confirmed"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];
/** Události, které smí poslat prohlížeč; ostatní počítá server ve svých obslužných rutinách. */
export const CLIENT_EVENTS: readonly FunnelEvent[] = ["quiz_done", "calculator_used"];

export const MAX_SECONDS = 1800;
/** strop otisků v paměti za den – ochrana paměti; nad ním se další návštěvníci už nerozlišují */
const MAX_HASHES = 200_000;

/** Počítá se tento požadavek? Ne pro roboty, bez User-Agent, s DNT: 1 nebo Sec-GPC: 1. */
export function countable(h: Headers): boolean {
  const ua = h.get("user-agent") ?? "";
  if (!ua.trim() || BOT_UA.test(ua)) return false;
  if (h.get("dnt") === "1" || h.get("sec-gpc") === "1") return false;
  return true;
}

let tracked: Set<string> | null = null;

/**
 * Měřené cesty = rejstřík stránek webu, týž zdroj jako sitemap.xml (R16.1). Jiná cesta (vymyšlená, 404, návod mimo
 * sitemap, aplikace, API, admin) se nezapíše – podvržený beacon tak nemůže zakládat řádky s libovolnou adresou.
 */
export function trackedPaths(): ReadonlySet<string> {
  tracked ??= new Set(sitePages().map((p) => p.path));
  return tracked;
}

export function isTrackedPath(path: string): boolean {
  return trackedPaths().has(path);
}

export function deviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

/** Den v Praze (YYYY-MM-DD) – sůl i souhrny se dělí podle pražské půlnoci. */
export function pragueDay(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Doména zdroje (bez „www.“), jen cizí; z celé adresy se vezme jen host – cesta ani query se neukládají. */
export function referrerDomain(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim() || input.length > 2000) return null;
  let host: string;
  try {
    host = new URL(input.includes("://") ? input : `https://${input}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  if (!/^[a-z0-9.-]{1,100}$/.test(host) || !host.includes(".")) return null;
  const own = new URL(SITE_URL).hostname.replace(/^www\./, "");
  if (host === own || host.endsWith(`.${own}`) || host === "localhost") return null;
  return host;
}

let state: { day: string; salt: Buffer; seen: Set<string> } | null = null;

/** Nový návštěvník tohoto dne pro daný rozsah (celý web / stránka)? */
function firstVisit(scope: string, h: Headers, now: Date): boolean {
  const day = pragueDay(now);
  if (!state || state.day !== day) state = { day, salt: randomBytes(32), seen: new Set() };
  const hash = createHash("sha256")
    .update(state.salt)
    .update(`${clientIpFromHeaders(h)}\n${h.get("user-agent") ?? ""}\n${scope}`)
    .digest("base64url");
  if (state.seen.has(hash)) return false;
  if (state.seen.size >= MAX_HASHES) return false;
  state.seen.add(hash);
  return true;
}

async function bump(day: string, metric: string, key: string, inc: { views?: number; visitors?: number; secondsSum?: number; secondsCount?: number }) {
  const t = schema.analyticsDaily;
  const v = { views: inc.views ?? 0, visitors: inc.visitors ?? 0, secondsSum: inc.secondsSum ?? 0, secondsCount: inc.secondsCount ?? 0 };
  await getDb()
    .insert(t)
    .values({ day, metric, key, ...v })
    .onConflictDoUpdate({
      target: [t.day, t.metric, t.key],
      set: {
        views: sql`${t.views} + ${v.views}`,
        visitors: sql`${t.visitors} + ${v.visitors}`,
        secondsSum: sql`${t.secondsSum} + ${v.secondsSum}`,
        secondsCount: sql`${t.secondsCount} + ${v.secondsCount}`,
      },
    });
}

/** Zobrazení stránky (z beaconu). */
export async function recordView(h: Headers, input: { path: string; ref?: unknown }, now = new Date()): Promise<boolean> {
  if (!countable(h) || !isTrackedPath(input.path)) return false;
  const day = pragueDay(now);
  await bump(day, "page", input.path, { views: 1, visitors: firstVisit(`page:${input.path}`, h, now) ? 1 : 0 });
  await bump(day, "site", "", { views: 1, visitors: firstVisit("site", h, now) ? 1 : 0 });
  await bump(day, "device", deviceType(h.get("user-agent") ?? ""), { views: 1 });
  const ref = referrerDomain(input.ref);
  if (ref) await bump(day, "ref", ref, { views: 1 });
  return true;
}

/** Čas na stránce (z beaconu při skrytí stránky): sekundy 0–1800; `first` = první hlášení k tomuto zobrazení. */
export async function recordTime(h: Headers, input: { path: string; seconds: unknown; first: boolean }, now = new Date()): Promise<boolean> {
  if (!countable(h) || !isTrackedPath(input.path)) return false;
  const n = Number(input.seconds);
  const seconds = Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), MAX_SECONDS) : 0;
  await bump(pragueDay(now), "page", input.path, { secondsSum: seconds, secondsCount: input.first ? 1 : 0 });
  return true;
}

/** Událost trychtýře (bez osobních údajů) – jen počet za den. Chyba měření nesmí shodit obslužnou rutinu. */
export async function recordEvent(h: Headers, name: FunnelEvent, now = new Date()): Promise<boolean> {
  if (!countable(h) || !FUNNEL_EVENTS.includes(name)) return false;
  try {
    await bump(pragueDay(now), "event", name, { views: 1 });
    return true;
  } catch {
    return false;
  }
}

export interface TrafficReport {
  days: number;
  daily: { day: string; views: number; visitors: number }[];
  pages: { path: string; views: number; visitors: number; avgSeconds: number | null }[];
  referrers: { domain: string; views: number }[];
  devices: { device: string; views: number }[];
  events: Record<FunnelEvent, number>;
  visitors: number;
  views: number;
}

/** Souhrn pro adminský kabinet za posledních `days` dní (včetně dneška). */
export async function trafficReport(days: number, now = new Date()): Promise<TrafficReport> {
  const from = pragueDay(new Date(now.getTime() - (days - 1) * 86_400_000));
  const t = schema.analyticsDaily;
  const rows = await getDb().select().from(t).where(gte(t.day, from));
  const sum = (metric: string) => {
    const m = new Map<string, { key: string; views: number; visitors: number; secondsSum: number; secondsCount: number }>();
    for (const r of rows.filter((x) => x.metric === metric)) {
      const a = m.get(r.key) ?? { key: r.key, views: 0, visitors: 0, secondsSum: 0, secondsCount: 0 };
      a.views += r.views;
      a.visitors += r.visitors;
      a.secondsSum += r.secondsSum;
      a.secondsCount += r.secondsCount;
      m.set(r.key, a);
    }
    return [...m.values()].sort((a, b) => b.views - a.views || a.key.localeCompare(b.key));
  };
  const daily: TrafficReport["daily"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = pragueDay(new Date(now.getTime() - i * 86_400_000));
    const r = rows.find((x) => x.metric === "site" && x.day === day);
    daily.push({ day, views: r?.views ?? 0, visitors: r?.visitors ?? 0 });
  }
  const events = Object.fromEntries(FUNNEL_EVENTS.map((e) => [e, 0])) as Record<FunnelEvent, number>;
  for (const r of rows.filter((x) => x.metric === "event")) if (r.key in events) events[r.key as FunnelEvent] += r.views;
  return {
    days,
    daily,
    pages: sum("page").map((p) => ({ path: p.key, views: p.views, visitors: p.visitors, avgSeconds: p.secondsCount ? Math.round(p.secondsSum / p.secondsCount) : null })),
    referrers: sum("ref").map((r) => ({ domain: r.key, views: r.views })),
    devices: sum("device").map((d) => ({ device: d.key, views: d.views })),
    events,
    visitors: daily.reduce((a, d) => a + d.visitors, 0),
    views: daily.reduce((a, d) => a + d.views, 0),
  };
}

export function __resetAnalyticsForTests(): void {
  state = null;
}

export function __visitorStateForTests(): { day: string; hashes: number } | null {
  return state ? { day: state.day, hashes: state.seen.size } : null;
}
