/**
 * R10.2 (рецензія №7) – dokud je /pokladna zavřená, popis služby nesmí tvrdit, že pokladna už funguje: SITE.description
 * (meta, patička, JSON-LD organizace) a meta popis úvodní stránky v budoucím čase. Po otevření se sám vrátí přítomný čas –
 * jedno místo s isClosed("/pokladna"), jako u CTA v guide-blocks.tsx.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const FUTURE_SITE =
  "Bezplatnou pokladnu pro EET 2.0 připravujeme: bude fungovat i bez signálu, pro až 5 uživatelů, s účtenkou e-mailem i QR. Nezávislá služba, není provozována Finanční správou.";
const FUTURE_HOME =
  "EET 2.0 od roku 2027: zkontrolujte podle IČO, zda se vás týká, a předregistrujte se k bezplatné pokladně. Bude fungovat i offline, pro až 5 uživatelů, s účtenkou e-mailem i QR.";
const PRESENT_SITE = "Bezplatná pokladna pro EET 2.0: funguje i bez signálu, až 5 uživatelů, účtenka e-mailem i QR. Nezávislá služba, není provozována Finanční správou.";

afterEach(() => {
  vi.doUnmock("@/lib/launch");
  vi.resetModules();
});

describe("R10.2 – the service in the future tense while /pokladna is closed", () => {
  it("gate: closed → SITE.description and the home meta description (verbatim); layout, footer and Organization use it", async () => {
    const { isClosed } = await import("@/lib/launch");
    expect(isClosed("/pokladna")).toBe(true);
    const { SITE } = await import("@/lib/site");
    expect(SITE.description).toBe(FUTURE_SITE);
    expect((await import("@/app/(site)/page")).metadata.description).toBe(FUTURE_HOME);
    expect((await import("@/app/layout")).metadata.description).toBe(FUTURE_SITE);
    const { organizationLd } = await import("@/lib/jsonld");
    expect(organizationLd().description).toBe(FUTURE_SITE);
  });

  it("open → the present tense comes back by itself", async () => {
    vi.resetModules();
    vi.doMock("@/lib/launch", async (orig) => {
      const real = await orig<typeof import("@/lib/launch")>();
      return { ...real, isClosed: (p: string) => (p === "/pokladna" ? false : real.isClosed(p)) };
    });
    const { SITE } = await import("@/lib/site");
    expect(SITE.description).toBe(PRESENT_SITE);
    expect((await import("@/app/(site)/page")).metadata.description).toMatch(/Funguje i offline/);
  });

  it("gate: one place – the texts live only in lib/site.ts", () => {
    const home = readFileSync(new URL("../src/app/(site)/page.tsx", import.meta.url), "utf8");
    expect(home).not.toContain("Funguje i offline, až 5 uživatelů");
    expect(home).not.toContain("Bude fungovat i offline");
    const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
    expect(site).toContain('isClosed("/pokladna")');
  });
});
