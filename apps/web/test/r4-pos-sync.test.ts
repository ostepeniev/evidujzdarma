/**
 * R4 (A r2 Д-10) – synchronizace pokladny:
 *  - tržby se posílají v dávkách omezených i velikostí těla (limit reverse proxy), 413 dávku rozpůlí;
 *  - jedna neúspěšná dávka nezastaví ostatní ani dotaz na stavy;
 *  - posun hodin jen z rozumných hodnot (nejvýš 45 dní – víc server stejně nepřijme).
 */
import { describe, expect, it } from "vitest";
import * as sync from "@/lib/pos/sync-result";

type BatchFns = {
  batchByBytes: <T>(items: T[], size: (t: T) => number, opts?: { maxItems: number; maxBytes: number }) => T[][];
  postBatches: <T, R>(batches: T[][], post: (b: T[]) => Promise<{ ok: true; value: R } | { ok: false; status: number; error: string }>, onOk: (b: T[], v: R) => Promise<void>) => Promise<string | null>;
};
const fns = sync as unknown as Partial<BatchFns>;

describe("Д-10 – batches by size", () => {
  it("gate: a batch never exceeds the byte limit, nor the item limit", () => {
    expect(typeof fns.batchByBytes).toBe("function");
    const items = Array.from({ length: 120 }, (_, i) => ({ i, size: i % 3 === 0 ? 90_000 : 1_000 }));
    const batches = fns.batchByBytes!(items, (x) => x.size, { maxItems: 50, maxBytes: 256 * 1024 });
    expect(batches.flat()).toEqual(items);
    for (const b of batches) {
      expect(b.length).toBeLessThanOrEqual(50);
      expect(b.length === 1 || b.reduce((s, x) => s + x.size, 0) <= 256 * 1024).toBe(true);
    }
  });

  it("gate: 413 splits the batch; another failing batch does not stop the others", async () => {
    expect(typeof fns.postBatches).toBe("function");
    const posted: number[][] = [];
    const err = await fns.postBatches!(
      [[1, 2, 3, 4], [5], [6, 7]],
      async (b) => {
        if (b.length > 2) return { ok: false, status: 413, error: "Request Entity Too Large" };
        if (b.includes(5)) return { ok: false, status: 500, error: "Server odpověděl 500" };
        return { ok: true, value: b.length };
      },
      async (b) => void posted.push(b),
    );
    expect(posted).toEqual([[1, 2], [3, 4], [6, 7]]);
    expect(err).toBe("Server odpověděl 500");
  });
});

describe("Д-10 – clock offset bounds", () => {
  it("gate: an absurd Date header (more than 45 days away) is ignored", () => {
    const now = Date.now();
    expect(sync.clockOffsetFrom(new Date(now + 60 * 86_400_000).toUTCString(), now, now)).toBeNull();
    expect(sync.clockOffsetFrom("Thu, 01 Jan 1970 00:00:00 GMT", now, now)).toBeNull();
    expect(sync.clockOffsetFrom(new Date(now + 2 * 86_400_000).toUTCString(), now, now)).toBeGreaterThan(86_400_000);
  });
});
