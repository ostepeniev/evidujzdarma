/**
 * R1.1 / R1.6 / Р2 – tržba nikdy nezmizí. Gate: T10 (soldAt = now + 11 min) a dočasná chyba
 * databáze při insertu: tržba se neztratí a po nápravě dojde do FS.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, processSale } from "@/lib/server/fiscal";
import { resolveQuarantine } from "@/lib/server/quarantine";
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

type R = { id: string; ok: boolean; retryable?: boolean; quarantined?: boolean; code?: string };

describe("R1.1 – a sale is never silently dropped", () => {
  it("T10: a sale dated 11 min in the future is quarantined with its payload and can be released to FS", async () => {
    const s = await seedAccount({ mode: "playground" });
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "playground", soldAt: new Date(Date.now() + 11 * 60_000).toISOString() });
    const [r] = (await ingestSales(await deviceContext(s.device.id), [sale as never])) as R[];
    expect(r!.ok).toBe(false);
    expect(r!.retryable).toBe(false);
    expect(r!.quarantined).toBe(true);
    const q = await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, sale.id) });
    expect(q?.reasonCode).toBe("FUTURE_DATE");
    expect((q?.payload as { id: string }).id).toBe(sale.id);

    // vlastník rozhodne: použít čas přijetí serverem
    const out = await resolveQuarantine(s.account.id, sale.id, { action: "retry_with_received_time" });
    expect(out.ok).toBe(true);
    await processSale(sale.id);
    const row = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
    expect(row?.status).toBe("confirmed");
    expect(fake.calls).toHaveLength(1);
  });

  it("a temporary DB error on insert is retryable; after the fix the sale reaches FS", async () => {
    const s = await seedAccount({ mode: "playground" });
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    await t.pg.exec(`
      CREATE FUNCTION fail_insert() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'disk full'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER sales_fail BEFORE INSERT ON sales FOR EACH ROW EXECUTE FUNCTION fail_insert();`);
    const sale = deviceSale(s.unit.id, { mode: "playground" });
    const [r1] = (await ingestSales(await deviceContext(s.device.id), [sale as never])) as R[];
    expect(r1!.ok).toBe(false);
    expect(r1!.retryable).toBe(true);
    expect(r1!.quarantined).toBeFalsy();

    await t.pg.exec("DROP TRIGGER sales_fail ON sales; DROP FUNCTION fail_insert();");
    const [r2] = (await ingestSales(await deviceContext(s.device.id), [sale as never])) as R[];
    expect(r2!.ok).toBe(true);
    await processSale(sale.id);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) }))?.status).toBe("confirmed");
  });

  it("an unknown unit goes to quarantine instead of being dropped", async () => {
    const s = await seedAccount({ mode: "mock" });
    const sale = deviceSale(crypto.randomUUID(), { mode: "mock" });
    const [r] = (await ingestSales(await deviceContext(s.device.id), [sale as never])) as R[];
    expect(r!.quarantined).toBe(true);
    expect((await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, sale.id) }))?.reasonCode).toBe("UNKNOWN_UNIT");
  });

  it("R1.6: the same id with different content is a conflict, not ok, and the original stays", async () => {
    const s = await seedAccount({ mode: "mock" });
    const ctx = await deviceContext(s.device.id);
    const sale = deviceSale(s.unit.id, { mode: "mock" });
    expect(((await ingestSales(ctx, [sale as never])) as R[])[0]!.ok).toBe(true);
    // stejné id znovu, beze změny → idempotentní ok
    expect(((await ingestSales(ctx, [sale as never])) as R[])[0]!.ok).toBe(true);
    const changed = { ...sale, payments: [{ method: "cash", amount: 99900 }], lines: [{ name: "Jiné", qty: 1, unitPrice: 99900, vatRate: 21 }] };
    const [r] = (await ingestSales(ctx, [changed as never])) as R[];
    expect(r!.ok).toBe(false);
    expect(r!.code).toBe("CONTENT_CONFLICT");
    expect(r!.quarantined).toBe(true);
    const row = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
    expect(row!.total).toBe(35000);
  });
});
