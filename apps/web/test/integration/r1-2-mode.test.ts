/**
 * R1.2 / Р3 – režim patří tržbě. Gate: T8 (production → mock před synchronizací)
 * a T9 (mock → production před synchronizací).
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, processPending, processSale } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

describe("R1.2 – sale owns its mode", () => {
  it("T8: production sale synced after the account switched to mock goes to production FS, never to mock", async () => {
    const s = await seedAccount({ mode: "mock" });
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production" });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r!.ok).toBe(true);
    const row = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
    expect(row!.mode).toBe("production");
    await processSale(sale.id);
    expect(fake.calls.map((c) => c.mode)).toEqual(["production"]);
  });

  it("T9: mock sale synced after the account switched to production is never sent to production FS", async () => {
    const s = await seedAccount({ mode: "production" });
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "mock" });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r!.ok).toBe(true);
    const row = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
    expect(row!.mode).toBe("mock");
    await processSale(sale.id);
    await processPending();
    expect(fake.calls.some((c) => c.mode === "production")).toBe(false);
  });

  it("rejects a sale without its own mode instead of guessing from the account", async () => {
    const s = await seedAccount({ mode: "production" });
    const { mode: _m, ...noMode } = deviceSale(s.unit.id);
    const { DeviceSaleSchema } = await import("@/lib/server/sales");
    expect(DeviceSaleSchema.safeParse(noMode).success).toBe(false);
  });
});
