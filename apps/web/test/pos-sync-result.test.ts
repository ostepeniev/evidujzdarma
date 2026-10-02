import { describe, expect, it } from "vitest";
import { accountModeChanged, applyPolledStatuses, applyServerResult, clockOffsetFrom, correctedNow, planSync } from "@/lib/pos/sync-result";

describe("POS handling of server results (R1.1)", () => {
  it("keeps a sale in the queue on a temporary server error", () => {
    expect(applyServerResult({ id: "a", ok: false, retryable: true, code: "TEMPORARY" }).status).toBe("local");
  });
  it("marks a quarantined sale rejected but says it is stored on the server", () => {
    const p = applyServerResult({ id: "a", ok: false, retryable: false, quarantined: true, code: "FUTURE_DATE", error: "Datum v budoucnosti" });
    expect(p.status).toBe("rejected");
    expect(p.quarantined).toBe(true);
    expect(p.error).toContain("uložená na serveru");
  });
  it("accepts an ok result with the server status", () => {
    const p = applyServerResult({ id: "a", ok: true, status: "confirmed", confirmationCode: "x" }, new Date("2027-01-01T00:00:00Z"));
    expect(p).toMatchObject({ status: "confirmed", confirmationCode: "x", syncedAt: "2027-01-01T00:00:00.000Z" });
  });
  it("derives the clock offset from the Date header and corrects only real skews", () => {
    const now = Date.parse("2027-01-01T10:00:00Z");
    const off = clockOffsetFrom(new Date(now + 11 * 60_000).toUTCString(), now - 100, now + 100)!;
    expect(Math.round(off / 60_000)).toBe(11);
    expect(correctedNow({ ms: off, at: now }, now) - now).toBeCloseTo(off, -2);
    expect(correctedNow({ ms: 10_000, at: now }, now)).toBe(now);
    expect(correctedNow({ ms: off, at: now - 2 * 86_400_000 }, now)).toBe(now);
  });
});

describe("POS sync plan (R1.8)", () => {
  it("posts only sales the server does not have yet and polls the accepted ones", () => {
    const plan = planSync([
      { id: "l", status: "local" },
      { id: "q", status: "queued" },
      { id: "s", status: "sending" },
      { id: "f", status: "failed" },
      { id: "c", status: "confirmed" },
      { id: "r", status: "rejected" },
    ]);
    expect(plan).toEqual({ post: ["l"], poll: ["q", "s", "f"] });
  });
  it("applies polled statuses and re-posts a sale the server does not know", () => {
    const out = new Map(applyPolledStatuses(["a", "b"], [{ id: "a", status: "confirmed", confirmationCode: "POK", lastError: null }]));
    expect(out.get("a")).toMatchObject({ status: "confirmed", confirmationCode: "POK" });
    expect(out.get("b")).toEqual({ status: "local" });
  });
});

describe("R5.1 – POS notices the account switched mode", () => {
  it("a different mode reported by the server means stale configuration", () => {
    expect(accountModeChanged("production", "mock")).toBe(true);
    expect(accountModeChanged("production", "production")).toBe(false);
    // starší server bez pole nebo chybějící konfigurace nevyvolá falešný poplach
    expect(accountModeChanged(undefined, "mock")).toBe(false);
    expect(accountModeChanged("mock", undefined)).toBe(true);
  });
});
