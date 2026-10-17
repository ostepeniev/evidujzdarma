/**
 * R7.2 (рецензія №4, B N2) – konfigurace nginx nesmí otevřít uzavřené sekce (lib/launch.ts):
 *  - každá location, která chytí cestu z isClosed, má auth_basic (vlastní, nebo serverové);
 *  - location pro /api/pokladna/* má auth_basic off (pokladna posílá Bearer token);
 *  - žádná location nemá vlastní proxy_set_header (jinak ztratí serverové, mj. X-Real-IP);
 *  - /api/internal/* (cron, dis-launch) zvenku vrací 404 (R8.5, Д-7).
 * Kontroluje infra/nginx/evidujzdarma.conf a pro ukázku i plán dne otevření z open-site.md (1aec031), který měl
 * exact-location certifikátu bez hesla, a blok z B-r4, rozd. 3.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLOSED_API, CLOSED_SECTIONS } from "@/lib/launch";
import { type Directive, effectiveAuth, locations, mainServer, matchLocation, parseNginx } from "./helpers/nginx";

const CONF_PATH = new URL("../../../infra/nginx/evidujzdarma.conf", import.meta.url);
const current = readFileSync(CONF_PATH, "utf8");

/** Cesty, které musí být za heslem. */
const CLOSED_PATHS = [
  ...[...CLOSED_SECTIONS, ...CLOSED_API].flatMap((p) => [p, `${p}/`, `${p}/x`]),
  "/api/ucet/certifikat",
  "/u/00000000-0000-4000-8000-000000000000",
];

/** S3: katalog je veřejný – žádná z těchto cest nesmí být za heslem (a má mikrocache, kromě živého náhledu z ARES). */
const CATALOG_PUBLIC = ["/firmy", "/firmy/obec/554961-karlovy-vary", "/firma/12345679-x", "/firma/sitemap/0.xml", "/provozovna/1-x", "/obor/x/kraj/y", "/firmy/sitemap.xml"];

/** Porušení pravidel R7.2 (prázdné = v pořádku). */
function violations(conf: string): string[] {
  const server = mainServer(parseNginx(conf));
  const out: string[] = [];
  for (const path of CLOSED_PATHS) {
    const auth = effectiveAuth(server, path);
    if (!auth || auth === "off") out.push(`${path}: bez auth_basic (location ${matchLocation(locations(server), path)?.pattern ?? "—"})`);
  }
  if (effectiveAuth(server, "/api/pokladna/x") !== "off") out.push("/api/pokladna/x: chybí auth_basic off");
  // interní maršruty zvenku nedostupné – jinak by cron a dis-launch držel jen CRON_SECRET (R8.5, Д-7)
  const internal = matchLocation(locations(server), "/api/internal/x");
  if (!internal?.block.some((d: Directive) => d.name === "return" && d.args[0] === "404")) out.push(`/api/internal/x: nevrací 404 (location ${internal?.pattern ?? "—"})`);
  for (const loc of locations(server)) if (loc.block.some((d: Directive) => d.name === "proxy_set_header")) out.push(`location ${loc.pattern}: vlastní proxy_set_header`);
  return out;
}

/** Blok z recenze B-r4, rozd. 3 (den otevření). */
const fromReview = readFileSync(new URL("../../../docs/tasks/2026-10-03-review-4/B-r4.md", import.meta.url), "utf8")
  .split("```nginx")[1]!
  .split("```")[0]!;

/**
 * Plán z open-site.md (1aec031): uzavřené sekce regexem a auth_basic pryč z úrovně server – ale exact-location certifikátu
 * zůstala bez vlastního hesla. Model = blok z B-r4 bez auth_basic v `= /api/ucet/certifikat` (nezávisle na tom, jak
 * vypadá aktuální soubor – R8.5, Д-7).
 */
const planFromOpenSite = fromReview.replace(/(location = \/api\/ucet\/certifikat \{\n)\s*auth_basic "EvidujZdarma";\n\s*auth_basic_user_file [^\n]+\n/, "$1");

describe("R7.2 – nginx keeps the closed sections closed", () => {
  it("gate: infra/nginx/evidujzdarma.conf passes", () => {
    expect(violations(current)).toEqual([]);
  });

  it("gate S3: the catalogue is public with a microcache keyed without query; the live ARES view /firma/{IČO} is not cached", () => {
    const server = mainServer(parseNginx(current));
    const locs = locations(server);
    for (const p of CATALOG_PUBLIC) {
      expect(effectiveAuth(server, p) ?? "off", p).toBe("off");
      const loc = matchLocation(locs, p)!;
      const d = (n: string) => loc.block.find((x: Directive) => x.name === n)?.args;
      expect(d("proxy_cache"), p).toEqual(["ez_catalog"]);
      // klíč bez query, ale s variantou kódování (gzip / bez) – Next.js odpovídá s Vary: Accept-Encoding
      expect(d("proxy_cache_key"), p).toEqual(["$scheme$host$uri$ez_cache_ae"]);
      // obejít kešku: query (?…) a požadavky klientské navigace Next.js (RSC hlavičky)
      expect(d("proxy_cache_bypass"), p).toEqual(["$is_args", "$ez_cache_rsc"]);
      expect(d("proxy_no_cache"), p).toEqual(["$is_args", "$ez_cache_rsc"]);
      expect(d("proxy_cache_use_stale"), p).toEqual(expect.arrayContaining(["updating", "error", "timeout"]));
      expect(d("proxy_cache_valid"), p).toEqual(["200", "301", "308", "10m"]);
    }
    for (const p of ["/firma/12345679", "/firma/12345679/"]) {
      const loc = matchLocation(locs, p)!;
      expect(loc.block.some((x: Directive) => x.name === "proxy_cache"), p).toBe(false);
      expect(effectiveAuth(server, p) ?? "off", p).toBe("off");
    }
    // zóna je v http kontextu ve vlastním souboru pro /etc/nginx/conf.d/
    const cacheConf = readFileSync(new URL("../../../infra/nginx/evidujzdarma-cache.conf", import.meta.url), "utf8");
    expect(cacheConf).toMatch(/^proxy_cache_path \/var\/cache\/nginx\/evidujzdarma .*keys_zone=ez_catalog:/m);
    expect(cacheConf).toMatch(/^map \$http_accept_encoding \$ez_cache_ae \{/m);
    expect(cacheConf).toMatch(/^map "\$http_rsc\$http_next_router_prefetch\$http_next_router_state_tree" \$ez_cache_rsc \{/m);
  });

  it("gate: the opening-day plan from open-site.md (1aec031) is caught – exact /api/ucet/certifikat would be public", () => {
    expect(planFromOpenSite).not.toBe(fromReview);
    const v = violations(planFromOpenSite);
    expect(v.some((x) => x.startsWith("/api/ucet/certifikat:"))).toBe(true);
  });

  it("the opening-day block from B-r4 (section 3) passes", () => {
    expect(violations(fromReview)).toEqual([]);
  });

  it("gate Д-7: /api/internal/ answers 404 from outside; a conf without that location is caught", () => {
    const server = mainServer(parseNginx(current));
    expect(matchLocation(locations(server), "/api/internal/x")?.block.find((d) => d.name === "return")?.args).toEqual(["404"]);
    const without = current.replace(/\n\s*location \^~ \/api\/internal\/ \{\n\s*return 404;\n\s*\}/, "");
    expect(without).not.toBe(current);
    expect(violations(without).some((v) => v.startsWith("/api/internal/x:"))).toBe(true);
  });

  it("a location with its own proxy_set_header is caught", () => {
    const bad = current.replace("    location = /api/health {\n", "    location = /api/health {\n        proxy_set_header X-Foo bar;\n");
    expect(violations(bad)).toContain("location /api/health: vlastní proxy_set_header");
  });

  it("matcher sanity: exact beats regex, ^~ stops regex search, /ucetni is not /u", () => {
    const server = mainServer(parseNginx(fromReview));
    const locs = locations(server);
    expect(matchLocation(locs, "/api/ucet/certifikat")?.modifier).toBe("=");
    expect(matchLocation(locs, "/api/pokladna/sales")?.modifier).toBe("^~");
    expect(matchLocation(locs, "/ucetni")?.pattern).toBe("/");
    expect(effectiveAuth(server, "/ucetni")).toBeNull();
  });
});
