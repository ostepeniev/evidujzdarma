/**
 * R5.10 – server přijme nové způsoby platby a eviduje je podle semináře FS: stravenka v celk_trzba,
 * kredit s cerp_zuct, uplatnění dárkového poukazu se neeviduje (tržba jen z poukazu → „neeviduje se“).
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

describe("R5.10 – voucher kinds on ingest", () => {
  it("stores evidenced amounts per payment kind", async () => {
    const s = await seedAccount();
    const ctx = await deviceContext(s.device.id);
    const meal = deviceSale(s.unit.id, { lines: [{ name: "Menu", qty: 1, unitPrice: 100000, vatRate: 12 }], payments: [{ method: "meal_voucher", amount: 20000 }, { method: "card", amount: 80000 }] });
    const credit = deviceSale(s.unit.id, { payments: [{ method: "credit", amount: 35000 }] });
    const gift = deviceSale(s.unit.id, { payments: [{ method: "gift_voucher", amount: 35000 }] });
    const out = await ingestSales(ctx, [meal, credit, gift] as never);
    expect(out.every((r) => r.ok)).toBe(true);
    const row = (id: string) => getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) });
    expect(await row(meal.id)).toMatchObject({ evidencedTotal: 100000, redeemedAmount: 0 });
    expect(await row(credit.id)).toMatchObject({ evidencedTotal: 35000, redeemedAmount: 35000 });
    expect(await row(gift.id)).toMatchObject({ evidencedTotal: 0, status: "not_required" });
  });
});
