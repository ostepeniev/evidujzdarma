/**
 * R3.9 – nonce-CSP bez 'unsafe-inline' ve script-src a frame-ancestors 'none' pro pokladnu,
 * účtenky, přihlášení, kabinet a pozvánky.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { STRICT_CSP_PATHS, proxy } from "@/proxy";

const csp = (res: Response) => res.headers.get("content-security-policy") ?? "";
const directive = (policy: string, name: string) => policy.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("R3.9 – strict CSP on sensitive pages", () => {
  it("gate: /pokladna gets a per-request nonce, no 'unsafe-inline' in script-src and frame-ancestors 'none'", () => {
    for (const path of ["/pokladna", "/pokladna/nastaveni", "/u/123e4567-e89b-42d3-a456-426614174000", "/prihlaseni", "/prihlaseni/overeni", "/kabinet", "/pozvanka/abc"]) {
      const a = csp(proxy(new NextRequest(`http://localhost${path}`)));
      const b = csp(proxy(new NextRequest(`http://localhost${path}`)));
      const script = directive(a, "script-src");
      expect(script, path).toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
      expect(script, path).not.toContain("'unsafe-inline'");
      expect(directive(a, "frame-ancestors"), path).toBe("frame-ancestors 'none'");
      expect(a, path).not.toBe(b); // nonce je pro každý požadavek jiný
    }
  });

  it("other pages are left to the global policy", () => {
    expect(csp(proxy(new NextRequest("http://localhost/navody/eet-off")))).toBe("");
    expect(STRICT_CSP_PATHS.length).toBeGreaterThanOrEqual(5);
  });

  it("the global CSP header is not sent on strict pages (no double policy)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { default: nextConfig } = await import("../next.config");
    const rules = await nextConfig.headers!();
    vi.unstubAllEnvs();
    const withCsp = rules.filter((r) => r.headers.some((h) => h.key === "Content-Security-Policy"));
    expect(withCsp.length).toBeGreaterThan(0);
    for (const r of withCsp) {
      expect(r.source).toContain("(?!");
      for (const p of ["pokladna", "u/", "prihlaseni", "kabinet", "pozvanka"]) expect(r.source, p).toContain(p);
    }
  });

  it("the cash register page renders per request so the nonce can be applied", () => {
    expect(readFileSync(join(__dirname, "../src/app/(app)/pokladna/page.tsx"), "utf8")).toMatch(/force-dynamic|await connection\(\)/);
  });
});
