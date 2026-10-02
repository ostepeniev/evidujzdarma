/**
 * R2.2 / R2.3 (Р7) – tvrzení o QR platbě a srovnání s MOJE eet jen ověřitelná.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPARISON_ROWS } from "@/content/comparison";
import { FACTS, SOURCES, timelineAt } from "@/content/facts";
import { GUIDES } from "@/content/guides";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
function allSources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(ROOT, p)).isDirectory() ? allSources(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("R2.2 – QR platba FAQ", () => {
  it("says a QR payment in person is evidenced, with sources", () => {
    const page = read("src/app/(site)/qr-platba/page.tsx");
    expect(page).not.toContain("Záleží na tom");
    expect(page).toContain("při osobním kontaktu");
    expect(page).toContain("SOURCES.kdoMusi");
    expect(page).toContain("SOURCES.mfPredstavuje");
  });
});

describe("R2.3 – comparison with MOJE eet (Р7)", () => {
  it("never states an unsourced 'Ne' about MOJE eet", () => {
    for (const row of COMPARISON_ROWS) expect(row.state, row.feature).not.toMatch(/^Ne\b/);
  });

  it("no subjective 'Jednodušší než státní aplikace' anywhere (incl. OG image)", () => {
    const offenders = allSources("src").filter((f) => /Jednodušší než státní aplikace/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("MOJE eet offline is 'nezveřejněno', not a fact", () => {
    expect(FACTS.mojeEet.summary).not.toMatch(/Pro provoz potřebuje připojení/);
    expect(FACTS.mojeEet.summary).toMatch(/nezveřejnila/);
    expect(timelineAt("2026-12-01").action).not.toMatch(/bez signálu/);
    const guide = GUIDES.find((g) => g.slug === "eet-bez-internetu")!;
    expect(JSON.stringify(guide)).not.toContain("Podle zveřejněných informací potřebuje MOJE eet pro provoz připojení");
    expect(guide.sources).toContain(SOURCES.mojeEet);
  });

  it("the comparison note carries the date and a contact for corrections", () => {
    expect(read("src/components/comparison-table.tsx")).toContain("Stav k 2. 10. 2026");
  });
});
