/**
 * R1.2 / Р3 – režim patří tržbě. Gate: T8 (production → mock před synchronizací)
 * a T9 (mock → production před synchronizací).
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, processPending, processSale } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

describe("R1.2 – sale owns its mode", () => {
  // prodáno 10 min před přepnutím účtu (od R5.1 záleží na pořadí: tržba prodaná po přepnutí jde do karantény)
  const soldBeforeSwitch = async (accountId: string) => {
    await getDb().update(schema.accounts).set({ eetModeChangedAt: new Date() }).where(eq(schema.accounts.id, accountId));
    return new Date(Math.floor((Date.now() - 10 * 60_000) / 1000) * 1000).toISOString();
  };

  it("T8: production sale synced after the account switched to mock goes to production FS, never to mock", async () => {
    const s = await seedAccount({ mode: "mock" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production", soldAt: await soldBeforeSwitch(s.account.id) });
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
    const sale = deviceSale(s.unit.id, { mode: "mock", soldAt: await soldBeforeSwitch(s.account.id) });
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
