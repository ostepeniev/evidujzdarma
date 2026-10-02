import { getDb, schema } from "@ez/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingestSales } from "@/lib/server/sales";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());

describe("PGlite harness", () => {
  it("runs production migrations and the ingest path", async () => {
    const s = await seedAccount();
    const ctx = await deviceContext(s.device.id);
    const sale = deviceSale(s.unit.id);
    const [r] = await ingestSales(ctx, [sale as never]);
    expect(r!.ok).toBe(true);
    const rows = await getDb().select().from(schema.sales);
    expect(rows).toHaveLength(1);
  });
});
