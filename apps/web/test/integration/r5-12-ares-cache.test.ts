/**
 * R5.12 (B Н2-1) – paměťová cache ARES je omezená i s databází. Dřív se ořezávala jen bez DB, takže na produkci
 * (sdílený server 4 GB, Т7) rostla s každým novým IČO. DB zůstává úplnou cache, paměť je jen omezená vrstva před ní.
 */
import { getDb, schema } from "@ez/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { __aresCacheForTests } from "@/lib/server/ares";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  process.env.ARES_MEMORY_MAX = "50";
}, 60_000);
afterAll(async () => {
  delete process.env.ARES_MEMORY_MAX;
  await t?.close();
});

describe("R5.12 – bounded ARES memory cache", () => {
  it("gate: with the database, the memory cache stays within its limit while the DB keeps everything", async () => {
    const { cached, size, clear } = __aresCacheForTests;
    clear();
    for (let i = 0; i < 120; i++) await cached(`subject:test${i}`, async () => ({ i }));
    expect(size()).toBeLessThanOrEqual(50);
    expect((await getDb().select().from(schema.aresCache)).length).toBe(120);
    // nejstarší klíč z paměti vypadl, ale DB ho vrátí bez dotazu do ARES
    let loaded = false;
    const hit = await cached("subject:test0", async () => ((loaded = true), { i: -1 }));
    expect(hit).toMatchObject({ value: { i: 0 }, hit: true });
    expect(loaded).toBe(false);
  });

  it("recently used entries survive eviction (LRU), expired ones are not served from memory", async () => {
    const { cached, clear, peek } = __aresCacheForTests;
    clear();
    await cached("subject:keep", async () => ({ keep: true }));
    for (let i = 0; i < 60; i++) {
      await cached(`subject:fill${i}`, async () => ({ i }));
      await cached("subject:keep", async () => ({ keep: false })); // čtení posune klíč na konec
    }
    expect(peek("subject:keep")).toBe(true);
    expect(peek("subject:fill0")).toBe(false);

    // po 24 h se záznam z paměti (ani z DB) nevrátí – načte se znovu
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(Date.now() + 25 * 3_600_000));
      let loaded = false;
      await cached("subject:keep", async () => ((loaded = true), { keep: "fresh" }));
      expect(loaded).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
