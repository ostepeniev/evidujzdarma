/**
 * R6.2 (рецензія №3, B В3-1) – zrušený účet nepřijímá prodeje po zrušení. „Jen dovézt uložené tržby“ drží server,
 * ne jen pokladna: tržba prodaná po zrušení jde do karantény ACCOUNT_CLOSED (nezahazuje se), dřívější se přijímá.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAccount } from "@/lib/server/lifecycle";
import { ingestSales } from "@/lib/server/sales";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString();

describe("R6.2 – closed account does not accept sales sold after closing", () => {
  it("gate: soldAt = closedAt + 1 min → quarantine ACCOUNT_CLOSED, no row in sales; closedAt − 1 min → ok", async () => {
    const s = await seedAccount({ mode: "mock" });
    await closeAccount(s.account.id);
    const closedAt = (await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) }))!.closedAt!.getTime();
    const ctx = await deviceContext(s.device.id);
    const after = deviceSale(s.unit.id, { soldAt: iso(closedAt + 60_000) });
    const before = deviceSale(s.unit.id, { soldAt: iso(closedAt - 60_000) });
    const [ra, rb] = await ingestSales(ctx, [after as never, before as never]);
    expect(ra).toMatchObject({ ok: false, quarantined: true, code: "ACCOUNT_CLOSED" });
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, after.id) })).toBeUndefined();
    expect((await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, after.id) }))!.reasonCode).toBe("ACCOUNT_CLOSED");
    expect(rb).toMatchObject({ ok: true });
  });
});
