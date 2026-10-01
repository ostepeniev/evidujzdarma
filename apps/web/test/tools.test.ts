import { describe, expect, it } from "vitest";
import { mapRzp, mapSubject } from "@ez/cz";
import { calculateEetOff, DEFAULT_INPUT } from "@/lib/eet-off";
import { assess } from "@/lib/eet-assessment";
import { ARES_FIXTURES } from "@/lib/server/ares-fixtures";
import { pragueDayRange, pragueDayStart, pragueToday } from "@/lib/prague-time";

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

describe("EET OFF calculator – mid-year start", () => {
  it("charges the surcharge only from the start month", () => {
    const r = calculateEetOff({ ...DEFAULT_INPUT, startMonth: 7 });
    expect(r.eligible && r.months).toBe(6);
    expect(r.eligible && r.surchargeYearly).toBe(1400 * 6);
  });
  it("clamps invalid months to a full year / December", () => {
    const full = calculateEetOff({ ...DEFAULT_INPUT, startMonth: 0 });
    expect(full.eligible && full.months).toBe(12);
    const dec = calculateEetOff({ ...DEFAULT_INPUT, startMonth: 40 });
    expect(dec.eligible && dec.months).toBe(1);
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

describe("Prague calendar days", () => {
  it("handles summer and winter time", () => {
    expect(pragueDayStart("2026-10-02").toISOString()).toBe("2026-10-01T22:00:00.000Z");
    expect(pragueDayStart("2027-01-15").toISOString()).toBe("2027-01-14T23:00:00.000Z");
    // den přechodu na zimní čas: půlnoc je ještě letní
    expect(pragueDayStart("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(pragueDayStart("2027-03-28").toISOString()).toBe("2027-03-27T23:00:00.000Z");
    const r = pragueDayRange("2026-10-01", "2026-10-31");
    expect(r.start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });
  it("knows today's Prague date after UTC midnight shift", () => {
    expect(pragueToday(new Date("2026-10-01T23:30:00Z"))).toBe("2026-10-02");
    expect(pragueToday(new Date("2027-01-15T22:30:00Z"))).toBe("2027-01-15");
  });
});
