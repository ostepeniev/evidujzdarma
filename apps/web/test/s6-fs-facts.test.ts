/**
 * S6-FS (28. 10. 2026): fakta z prezentace MF a FS (roadshow KHK KV 20. 10. 2026) – na web jen to, co stojí ve veřejném
 * zdroji: prezentace pro vývojáře (SOURCES.seminarVyvojari) nebo zákon č. 180/2026 Sb. (SOURCES.zakonUplne). DECISIONS Ф14.
 */
import { describe, expect, it } from "vitest";
import { SOURCES } from "@/content/facts";
import { getGuide } from "@/content/guides";
import { OBOR_LANDINGS } from "@/content/obor-landings";

const text = (slug: string) => JSON.stringify(getGuide(slug));
const CHANGED = [
  "eet-gastronomie",
  "eet-kadernictvi-kosmetika",
  "trzba-za-jineho",
  "storno-a-vraceni-eet",
  "eet-bez-internetu",
  "eet-ubytovani",
  "kontaktni-platba",
  "koho-se-eet-tyka",
] as const;

describe("S6-FS – facts from the MF/FS presentation", () => {
  it("gate: every changed guide has a 28. 10. changelog entry on top, updated 2026-10-28 and a public source", () => {
    for (const slug of CHANGED) {
      const g = getGuide(slug)!;
      expect(g.updated, slug).toBe("2026-10-28");
      expect(g.changelog?.[0]?.date, slug).toBe("2026-10-28");
      const urls = g.sources.map((s) => s.url);
      expect(urls.includes(SOURCES.seminarVyvojari.url) || urls.includes(SOURCES.zakonUplne.url), slug).toBe(true);
    }
  });

  it("gate: no „stanovisko jsme nenašli“ left for tips and deposits", () => {
    for (const slug of ["eet-gastronomie", "eet-kadernictvi-kosmetika", "eet-ubytovani", "kontaktni-platba"]) {
      expect(text(slug), slug).not.toMatch(/nenašli|výslovně neřeší|Výslovné stanovisko Finanční správy/);
    }
    expect(JSON.stringify(OBOR_LANDINGS)).not.toContain("Výslovné stanovisko Finanční správy ke spropitnému");
  });

  it("gate: tips – business income is evidenced, employee tips voluntarily; exemption only on-site, 7 % for the whole restaurant", () => {
    const g = text("eet-gastronomie");
    for (const s of ["evidovanou tržbou", "evidenci nepodléhá", "dobrovolně", "food trucky", "couvert", "pro všechny zaměstnance dohromady"]) {
      expect(g, s).toContain(s);
    }
  });

  it("gate: representation – direct, indirect (whole amount, agent's certificate), multi-payer flag, one payment for several taxpayers", () => {
    const g = getGuide("trzba-za-jineho")!;
    expect(g.sections.map((s) => s.id)).toContain("zastoupeni");
    const t = JSON.stringify(g);
    for (const s of ["mandátní smlouva", "komisionářská smlouva", "celou tržbu", "EIČ zastoupeného ve zprávě není", "povereni_vice_popl", "dvou samostatných datových zprávách"]) {
      expect(t, s).toContain(s);
    }
    expect(t).not.toContain("nevysvětlila");
    expect(g.summary.length).toBeGreaterThanOrEqual(3);
    expect(g.summary.length).toBeLessThanOrEqual(5);
  });

  it("gate: storno is not tied to the original sale, current date, new UUID, difference message", () => {
    const t = text("storno-a-vraceni-eet");
    for (const s of ["neváží", "aktuálním datem a časem", "UUID", "rozdílov"]) expect(t, s).toContain(s);
  });

  it("gate: outage – send without delay, the duty lasts even after 48 hours", () => {
    const t = text("eet-bez-internetu");
    expect(t).toContain("bezodkladně");
    expect(t).toContain("trvá i po uplynutí 48 hodin");
  });

  it("gate: deposit – neither paid-in nor returned is evidenced, only the used part paid in person", () => {
    for (const slug of ["eet-ubytovani", "kontaktni-platba"]) {
      const t = text(slug);
      expect(t, slug).toMatch(/ani (při )?vrácení/);
      expect(t, slug).toMatch(/použije|použijete/);
    }
    expect(text("kontaktni-platba")).toContain("Jedna tržba 1 000 Kč");
  });

  it("gate: exemptions table has § 11 odst. 4 a 5, § 12 odst. 1 (employees, schools), § 13 odst. 1 and the mobile-network payment", () => {
    const t = text("koho-se-eet-tyka");
    for (const s of ["§ 11 odst. 4 a 5", "hluchoslepotě", "školské zařízení", "§ 13 odst. 1", "do přidělení DIČ", "veřejnou mobilní síť"]) {
      expect(t, s).toContain(s);
    }
  });
});
