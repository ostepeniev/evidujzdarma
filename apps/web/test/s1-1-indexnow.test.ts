/**
 * S1.1 (SEO, K4) – IndexNow pro Seznam a Bing (Google ho nepodporuje). Klíč je veřejný (soubor public/<klíč>.txt),
 * odesílá skript scripts/indexnow.ts, který spouští kontrolor po nasazení – žádný cron ani volání z běhu webu.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENDPOINT, HOST, INDEXNOW_KEY, SITEMAP_URL, buildPayloads, describeStatus, main, parseArgs, parseSitemap, selectUrls } from "../scripts/indexnow.ts";

const PUBLIC = new URL("../public/", import.meta.url);
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://evidujzdarma.cz</loc><lastmod>2026-10-01</lastmod></url>
<url><loc>https://evidujzdarma.cz/navody/eet-off</loc><lastmod>2026-10-07</lastmod></url>
<url><loc>https://evidujzdarma.cz/cenik</loc><lastmod>2026-10-03T00:00:00.000Z</lastmod></url>
<url><loc>https://evil.example/x</loc><lastmod>2026-10-07</lastmod></url>
</urlset>`;

describe("S1.1 – IndexNow", () => {
  it("gate: the key is 8–128 [A-Za-z0-9-] (here 32 hex) and public/<key>.txt holds exactly the key (UTF-8, no BOM, no newline)", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    expect(INDEXNOW_KEY).toMatch(/^[A-Za-z0-9-]{8,128}$/);
    const file = new URL(`${INDEXNOW_KEY}.txt`, PUBLIC);
    expect(existsSync(file)).toBe(true);
    const bytes = readFileSync(file);
    expect(bytes.toString("utf8")).toBe(INDEXNOW_KEY);
    expect(bytes[0]).not.toBe(0xef);
    // jediný klíčový soubor ve public
    expect(readdirSync(PUBLIC).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f))).toEqual([`${INDEXNOW_KEY}.txt`]);
  });

  it("gate: the payload carries only https://evidujzdarma.cz/… URLs, at most 10 000 per request, and the right host", () => {
    const many = Array.from({ length: 10_005 }, (_, i) => `https://evidujzdarma.cz/p/${i}`);
    const payloads = buildPayloads([...many, "https://evil.example/x", "http://evidujzdarma.cz/plain-http"]);
    expect(payloads).toHaveLength(2);
    for (const p of payloads) {
      expect(p.host).toBe("evidujzdarma.cz");
      expect(p.host).toBe(HOST);
      expect(p.key).toBe(INDEXNOW_KEY);
      expect(p.keyLocation).toBe(`https://evidujzdarma.cz/${INDEXNOW_KEY}.txt`);
      expect(p.urlList.length).toBeLessThanOrEqual(10_000);
      for (const u of p.urlList) expect(u.startsWith("https://evidujzdarma.cz/"), u).toBe(true);
    }
    expect(payloads.flatMap((p) => p.urlList)).toHaveLength(10_005);
    expect(ENDPOINT).toBe("https://search.seznam.cz/indexnow");
  });

  it("gate: filter by lastmod (--since), --all, --url", () => {
    const entries = parseSitemap(SITEMAP);
    expect(entries).toHaveLength(4);
    expect(selectUrls(entries, { mode: "since", since: Date.parse("2026-10-03T00:00:00Z") })).toEqual(["https://evidujzdarma.cz/navody/eet-off", "https://evidujzdarma.cz/cenik"]);
    // domovská stránka bez lomítka (tak ji píše sitemap) jde v normalizovaném tvaru https://evidujzdarma.cz/
    expect(selectUrls(entries, { mode: "all" })).toEqual(["https://evidujzdarma.cz/", "https://evidujzdarma.cz/navody/eet-off", "https://evidujzdarma.cz/cenik"]);
    expect(buildPayloads(["https://evidujzdarma.cz", "https://evidujzdarma.cz:8443/x", "https://evidujzdarma.cz.evil.example/", "https://u@evidujzdarma.cz/"])[0]!.urlList).toEqual(["https://evidujzdarma.cz/"]);
    expect(selectUrls(entries, { mode: "urls", urls: ["https://evidujzdarma.cz/o-nas"] })).toEqual(["https://evidujzdarma.cz/o-nas"]);
  });

  it("arguments: --since <ISO> | --all | --url <URL>...; anything else is an argument error", () => {
    expect(parseArgs(["--since", "2026-10-07"])).toEqual({ mode: "since", since: Date.parse("2026-10-07") });
    expect(parseArgs(["--all"])).toEqual({ mode: "all" });
    expect(parseArgs(["--url", "https://evidujzdarma.cz/a", "https://evidujzdarma.cz/b"])).toEqual({ mode: "urls", urls: ["https://evidujzdarma.cz/a", "https://evidujzdarma.cz/b"] });
    expect(parseArgs(["--", "--all"])).toEqual({ mode: "all" });
    for (const bad of [[], ["--since"], ["--since", "včera"], ["--url"], ["--url", "https://evil.example/a"], ["--all", "--since", "2026-10-07"], ["--nevim"]]) {
      expect(() => parseArgs(bad), JSON.stringify(bad)).toThrow();
    }
  });

  it("responses: 200/202 ok; 403, 422, 429 explained", () => {
    expect(describeStatus(200).ok).toBe(true);
    expect(describeStatus(202).ok).toBe(true);
    for (const s of [403, 422, 429]) {
      const d = describeStatus(s);
      expect(d.ok).toBe(false);
      expect(d.message.length).toBeGreaterThan(20);
    }
  });

  describe("main: never breaks a deploy – exit 0 except argument errors", () => {
    afterEach(() => vi.unstubAllGlobals());
    const quiet = () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    };

    it("reads sitemap.xml, posts JSON to Seznam with the right headers; 403 still exits 0", async () => {
      quiet();
      const calls: { url: string; init?: RequestInit }[] = [];
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return url === SITEMAP_URL ? new Response(SITEMAP) : new Response("", { status: 403 });
      });
      expect(await main(["--", "--since", "2026-10-07"])).toBe(0);
      expect(calls.map((c) => c.url)).toEqual([SITEMAP_URL, ENDPOINT]);
      const post = calls[1]!.init!;
      expect(post.method).toBe("POST");
      expect(post.headers).toEqual({ "Content-Type": "application/json; charset=utf-8" });
      expect(JSON.parse(post.body as string)).toEqual({
        host: "evidujzdarma.cz",
        key: INDEXNOW_KEY,
        keyLocation: `https://evidujzdarma.cz/${INDEXNOW_KEY}.txt`,
        urlList: ["https://evidujzdarma.cz/navody/eet-off"],
      });
    });

    it("network failure → exit 0; bad arguments → exit 2 without any request", async () => {
      quiet();
      const fetchMock = vi.fn(async () => {
        throw new Error("ECONNRESET");
      });
      vi.stubGlobal("fetch", fetchMock);
      expect(await main(["--all"])).toBe(0);
      expect(await main(["--url", "https://evidujzdarma.cz/cenik"])).toBe(0);
      fetchMock.mockClear();
      expect(await main(["--since", "včera"])).toBe(2);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("gate: no runtime call – the old /api/internal/indexnow route and INDEXNOW_KEY rewrite are gone", () => {
    const src = new URL("../src/", import.meta.url);
    expect(existsSync(new URL("app/api/internal/indexnow/route.ts", src))).toBe(false);
    expect(existsSync(new URL("lib/server/indexnow.ts", src))).toBe(false);
    expect(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8")).not.toMatch(/indexnow/i);
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.indexnow).toMatch(/scripts\/indexnow\.ts/);
  });
});
