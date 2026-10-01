import { describe, expect, it } from "vitest";
import { classifyProbe, hourlyLatency, incidents, transition, uptimePercent, type Probe } from "@/lib/fs-status";

const t0 = new Date("2027-01-05T10:00:00Z").getTime();
const p = (min: number, status: Probe["status"], latencyMs: number | null = 120): Probe => ({
  checkedAt: new Date(t0 + min * 60_000),
  status,
  latencyMs: status === "down" ? null : latencyMs,
  httpStatus: status === "down" ? null : 200,
});

describe("FS monitor", () => {
  it("classifies probes", () => {
    expect(classifyProbe({ httpStatus: 200, latencyMs: 150 })).toBe("up");
    expect(classifyProbe({ httpStatus: 405, latencyMs: 150 })).toBe("up");
    expect(classifyProbe({ httpStatus: 200, latencyMs: 2500 })).toBe("slow");
    expect(classifyProbe({ httpStatus: 503, latencyMs: 40 })).toBe("down");
    expect(classifyProbe({ httpStatus: 407, latencyMs: 40 })).toBe("down");
    expect(classifyProbe({ httpStatus: null, latencyMs: null, error: "timeout" })).toBe("down");
  });

  it("computes uptime and ignores single blips as incidents", () => {
    const probes = [p(0, "up"), p(5, "down"), p(10, "up"), p(15, "down"), p(20, "down"), p(25, "down"), p(30, "slow")];
    expect(uptimePercent(probes, new Date(t0))).toBe(42.9);
    const inc = incidents(probes);
    expect(inc).toHaveLength(1);
    expect(inc[0]!.probes).toBe(3);
    expect(inc[0]!.end?.getTime()).toBe(t0 + 30 * 60_000);
    expect(uptimePercent([], new Date(t0))).toBeNull();
  });

  it("reports an ongoing incident", () => {
    const inc = incidents([p(0, "up"), p(5, "down"), p(10, "down")]);
    expect(inc[0]!.end).toBeNull();
  });

  it("detects transitions for operator alerts (latest first)", () => {
    expect(transition([p(10, "down"), p(5, "down"), p(0, "up")])).toBe("down");
    expect(transition([p(15, "up"), p(10, "down"), p(5, "down")])).toBe("recovered");
    expect(transition([p(15, "down"), p(10, "down"), p(5, "down")])).toBeNull();
    expect(transition([p(10, "down"), p(5, "up"), p(0, "up")])).toBeNull();
    expect(transition([p(0, "down")])).toBeNull();
  });

  it("buckets latency per hour and marks outages", () => {
    const now = new Date(t0 + 2 * 3_600_000);
    const h = hourlyLatency([p(0, "up", 100), p(5, "up", 200), p(65, "down")], now, 3);
    expect(h).toHaveLength(3);
    expect(h[0]!.avgMs).toBe(150);
    expect(h[1]!.down).toBe(true);
    expect(h[2]!.avgMs).toBeNull();
  });
});
