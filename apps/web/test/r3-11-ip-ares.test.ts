/**
 * R3.11 – IP jen z X-Real-IP (nastavuje Caddy), IPv6 po /64; rozpočet ARES rozdělený podle účelu,
 * takže hromadné dotazy ani živý katalog nevyčerpají interaktivní kontrolu IČO.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARES_POOLS, AresBusyError, takeAresToken } from "@/lib/server/ares";
import { clientIp } from "@/lib/server/rate-limit";

const req = (h: Record<string, string>) => new Request("http://localhost/", { headers: h });

describe("R3.11 – client IP", () => {
  it("gate: a spoofed X-Forwarded-For is ignored; only X-Real-IP from Caddy counts", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
  });

  it("IPv6 addresses are keyed by their /64", () => {
    const a = clientIp(req({ "x-real-ip": "2001:db8:abcd:12::1" }));
    const b = clientIp(req({ "x-real-ip": "2001:0db8:abcd:0012:ffff:ffff:ffff:ffff" }));
    const c = clientIp(req({ "x-real-ip": "2001:db8:abcd:13::1" }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(clientIp(req({ "x-real-ip": "::1" }))).toBe("0:0:0:0::/64");
  });
});

describe("R3.11 – ARES budget per purpose", () => {
  it("the pools add up to the process limit and an exhausted pool does not starve the others", async () => {
    const total = Object.values(ARES_POOLS).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(240);
    for (let i = 0; i < ARES_POOLS.catalog; i++) await takeAresToken("catalog", 0);
    await expect(takeAresToken("catalog", 0)).rejects.toBeInstanceOf(AresBusyError);
    await expect(takeAresToken("interactive", 0)).resolves.toBeUndefined();
  });

  it("the IČO check page limits live lookups per IP", () => {
    expect(readFileSync(join(__dirname, "../src/app/(site)/kontrola-ico/page.tsx"), "utf8")).toMatch(/rateLimit\(`ico-page:/);
  });
});
