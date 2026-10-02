/**
 * R3.3 – ISR nezaplní disk: /firma a /provozovna se renderují dynamicky (bez cache na disku),
 * libovolný suffix je 404 (ne přesměrování) a živé dotazy do ARES mají limit na IP.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { slugDecision } from "@/components/catalog/paths";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("R3.3 – no unbounded ISR keys", () => {
  it("gate: only the canonical suffix renders; an empty one redirects once; anything else is 404", () => {
    expect(slugDecision("kadernictvi-jana", "kadernictvi-jana")).toBe("ok");
    expect(slugDecision("", "kadernictvi-jana")).toBe("redirect");
    expect(slugDecision("nahodny-retezec-123", "kadernictvi-jana")).toBe("notfound");
    expect(slugDecision("kadernictvi-jana-x", "kadernictvi-jana")).toBe("notfound");
  });

  it("firm and establishment pages are dynamic (no ISR on disk); live ARES pages are rate limited per IP", () => {
    for (const f of ["src/app/(site)/firma/[slug]/page.tsx", "src/app/(site)/provozovna/[slug]/page.tsx"]) {
      const s = read(f);
      expect(s, f).toContain('export const dynamic = "force-dynamic"');
      expect(s, f).not.toMatch(/export const revalidate/);
    }
    expect(read("src/app/(site)/provozovna/[slug]/page.tsx")).toContain("slugDecision(");
    // logika stránky firmy je v lib/server/firm-page.ts (R4: výpadek ARES → stav „unavailable“)
    expect(read("src/app/(site)/firma/[slug]/page.tsx")).toContain("loadFirmPage(");
    const loader = read("src/lib/server/firm-page.ts");
    expect(loader).toContain("slugDecision(");
    expect(loader).toMatch(/rateLimit\(`firm-live:/);
  });
});
