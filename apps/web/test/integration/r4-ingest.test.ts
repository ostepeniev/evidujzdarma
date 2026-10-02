/**
 * R4 (A r1 Дрібне 6) – částka nad limit XSD (celk_trzba < 100 000 000 Kč) se zachytí už při příjmu
 * (karanténa s vysvětlením), ne až při sestavení zprávy, kdy by tržba visela ve frontě jako MESSAGE_INVALID.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ingestSales } from "@/lib/server/sales";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

describe("Дрібне 6 – EET amount limit on ingest", () => {
  it("gate: 100 000 000 Kč is refused at ingest into quarantine; 99 999 999.99 Kč is accepted", async () => {
    const s = await seedAccount();
    const ctx = await deviceContext(s.device.id);
    const big = deviceSale(s.unit.id, { lines: [{ name: "Dům", qty: 1, unitPrice: 10_000_000_000, vatRate: 0 }], payments: [{ method: "card", amount: 10_000_000_000 }] });
    const [r] = await ingestSales(ctx, [big as never]);
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "INVALID_SALE" });
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, big.id) })).toBeUndefined();

    const max = deviceSale(s.unit.id, { lines: [{ name: "Dům", qty: 1, unitPrice: 9_999_999_999, vatRate: 0 }], payments: [{ method: "card", amount: 9_999_999_999 }] });
    expect((await ingestSales(ctx, [max as never]))[0]!.ok).toBe(true);
  });
});
