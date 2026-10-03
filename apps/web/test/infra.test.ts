/**
 * R7.2 (рецензія №4, B N2) – konfigurace nginx nesmí otevřít uzavřené sekce (lib/launch.ts):
 *  - každá location, která chytí cestu z isClosed, má auth_basic (vlastní, nebo serverové);
 *  - location pro /api/pokladna/* má auth_basic off (pokladna posílá Bearer token);
 *  - žádná location nemá vlastní proxy_set_header (jinak ztratí serverové, mj. X-Real-IP).
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
  "/firma/sitemap/0.xml",
  "/provozovna/sitemap/0.xml",
  "/u/00000000-0000-4000-8000-000000000000",
];

/** Porušení pravidel R7.2 (prázdné = v pořádku). */
function violations(conf: string): string[] {
  const server = mainServer(parseNginx(conf));
  const out: string[] = [];
  for (const path of CLOSED_PATHS) {
    const auth = effectiveAuth(server, path);
    if (!auth || auth === "off") out.push(`${path}: bez auth_basic (location ${matchLocation(locations(server), path)?.pattern ?? "—"})`);
  }
  if (effectiveAuth(server, "/api/pokladna/x") !== "off") out.push("/api/pokladna/x: chybí auth_basic off");
  for (const loc of locations(server)) if (loc.block.some((d: Directive) => d.name === "proxy_set_header")) out.push(`location ${loc.pattern}: vlastní proxy_set_header`);
  return out;
}

/** Plán z open-site.md (1aec031): auth_basic z úrovně server pryč, uzavřené sekce regexem – ale exact certifikát zůstal bez hesla. */
const planFromOpenSite = current
  .replace(/\n\s*auth_basic "EvidujZdarma";\n\s*auth_basic_user_file [^\n]+\n/, "\n")
  .replace(
    "    location / {\n        proxy_pass http://127.0.0.1:3100;\n    }\n}",
    `    location ~ ^/(pokladna|prihlaseni|kabinet|pozvanka|u|firmy|firma|provozovna|obor)(/|$) {
        auth_basic "EvidujZdarma"; auth_basic_user_file /etc/nginx/evidujzdarma.htpasswd;
        proxy_pass http://127.0.0.1:3100;
    }
    location ~ ^/api/(ucet|auth|kabinet|pozvanka)(/|$) {
        auth_basic "EvidujZdarma"; auth_basic_user_file /etc/nginx/evidujzdarma.htpasswd;
        proxy_pass http://127.0.0.1:3100;
    }
    location / {
        proxy_pass http://127.0.0.1:3100;
    }
}`,
  );

/** Blok z recenze B-r4, rozd. 3 (den otevření). */
const fromReview = readFileSync(new URL("../../../docs/tasks/2026-10-03-review-4/B-r4.md", import.meta.url), "utf8")
  .split("```nginx")[1]!
  .split("```")[0]!;

describe("R7.2 – nginx keeps the closed sections closed", () => {
  it("gate: infra/nginx/evidujzdarma.conf passes", () => {
    expect(violations(current)).toEqual([]);
  });

  it("gate: the opening-day plan from open-site.md (1aec031) is caught – exact /api/ucet/certifikat would be public", () => {
    expect(planFromOpenSite).not.toBe(current);
    const v = violations(planFromOpenSite);
    expect(v.some((x) => x.startsWith("/api/ucet/certifikat:"))).toBe(true);
  });

  it("the opening-day block from B-r4 (section 3) passes", () => {
    expect(violations(fromReview)).toEqual([]);
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
