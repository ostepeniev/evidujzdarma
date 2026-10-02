/**
 * R2.1 / Р1 – datum povinnosti. Gate: žádný text nespojuje leden 2027 se slovy
 * „dobrovolný“, „nanečisto“, „zkušební“, „bez sankcí / pokut“. Leden i 1. 2. mají zdroj FS dotaz č. 4968.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FACTS, SOURCES, TIMELINE, timelineAt } from "@/content/facts";

const ROOT = join(__dirname, "..");
const SCAN = ["src/content", "src/lib/emails.ts", "src/lib/llms.ts", "src/lib/eet-assessment.ts", "src/app", "src/components"];
const FORBIDDEN = /dobrovoln|nane[čc]isto|zku[šs]ebn|bez\s+sankc|bez\s+pokut/gi;
const CONTEXT = /led(en|nu|na|nov)|pilot/i;
const WINDOW = 160;

function files(path: string): string[] {
  const abs = join(ROOT, path);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((f) => files(join(path, f)));
}

describe("R2.1 – obligation date (Р1)", () => {
  it("gate: no text ties January / pilot to voluntary, trial or no-penalty wording", () => {
    const hits: string[] = [];
    for (const file of SCAN.flatMap(files).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(FORBIDDEN)) {
        const around = text.slice(Math.max(0, m.index! - WINDOW), m.index! + WINDOW);
        if (CONTEXT.test(around)) {
          const line = text.slice(0, m.index).split("\n").length;
          hits.push(`${relative(ROOT, file)}:${line} „${m[0]}“`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("January and 1. 2. cite FS dotaz č. 4968", () => {
    expect(SOURCES.fsDotazPilot.url).toContain("app.fs.gov.cz/dotazy-verejnosti/dotaz/");
    expect(SOURCES.fsDotazPilot.url).toContain("4968");
    expect(FACTS.pilot.sources).toContain(SOURCES.fsDotazPilot);
    expect(timelineAt("2027-01-01").source).toBe(SOURCES.fsDotazPilot);
    expect(timelineAt("2027-02-01").source).toBe(SOURCES.fsDotazPilot);
    expect(timelineAt("2027-02-01").action).toMatch(/1\. 1\. 2027/);
  });

  it("TIMELINE is looked up by date, never by index", () => {
    const offenders = SCAN.flatMap(files)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /TIMELINE\[/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
    expect(() => timelineAt("2030-01-01")).toThrow();
    expect(TIMELINE.map((t) => t.date)).toEqual([...TIMELINE.map((t) => t.date)].sort());
  });
});
