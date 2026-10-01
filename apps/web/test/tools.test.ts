import { describe, expect, it } from "vitest";
import { mapRzp, mapSubject } from "@ez/cz";
import { calculateEetOff, DEFAULT_INPUT } from "@/lib/eet-off";
import { assess } from "@/lib/eet-assessment";
import { ARES_FIXTURES } from "@/lib/server/ares-fixtures";

describe("EET OFF calculator", () => {
  it("rejects band 2/3, non-paušál and income over 1M", () => {
    expect(calculateEetOff({ ...DEFAULT_INPUT, band: 2 }).eligible).toBe(false);
    expect(calculateEetOff({ ...DEFAULT_INPUT, band: 0 }).eligible).toBe(false);
    expect(calculateEetOff({ ...DEFAULT_INPUT, income: 1_000_001 }).eligible).toBe(false);
  });
  it("compares yearly surcharge with evidence cost", () => {
    const cheap = calculateEetOff({ ...DEFAULT_INPUT, minutesPerDay: 2, hourlyRate: 200 });
    expect(cheap.eligible && cheap.surchargeYearly).toBe(16_800);
    expect(cheap.eligible && cheap.verdict).toBe("evidence");
    const expensive = calculateEetOff({ ...DEFAULT_INPUT, minutesPerDay: 30, hourlyRate: 500 });
    expect(expensive.eligible && expensive.verdict).toBe("eet-off");
    expect(expensive.eligible && expensive.pausalWithSurchargeMonthly).toBe(11_062);
  });
});

describe("IČO assessment", () => {
  const f = (ico: string) => {
    const x = ARES_FIXTURES[ico]!;
    return [mapSubject(x.subject), x.rzp ? mapRzp(x.rzp) : null] as const;
  };
  it("hairdresser OSVČ is likely, EET OFF to check", () => {
    const [s, r] = f("12345679");
    const a = assess(s, r, undefined, new Date("2026-10-01"));
    expect(a.verdict).toBe("likely");
    expect(a.eetOff).toBe("check");
    expect(a.activeEstablishments).toBe(1);
    expect(a.checklist.length).toBeGreaterThan(3);
  });
  it("EET OFF possible with band 1 and income under 1M", () => {
    const [s, r] = f("12345679");
    expect(assess(s, r, { inPerson: "yes", pausal: "band1", incomeUnder1M: "yes" }).eetOff).toBe("possible");
  });
  it("company cannot use EET OFF; software firm unlikely", () => {
    const [s, r] = f("22222227");
    const a = assess(s, r);
    expect(a.eetOff).toBe("not_available");
    expect(a.verdict).toBe("unlikely");
  });
  it("answers override heuristics", () => {
    const [s, r] = f("22222227");
    expect(assess(s, r, { inPerson: "yes", pausal: "unknown", incomeUnder1M: "unknown" }).verdict).toBe("likely");
    const [s2, r2] = f("11111119");
    expect(assess(s2, r2, { inPerson: "no", pausal: "unknown", incomeUnder1M: "unknown" }).verdict).toBe("unlikely");
  });
});
