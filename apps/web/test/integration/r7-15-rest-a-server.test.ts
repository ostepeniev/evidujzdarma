/**
 * R7.15 (рецензія №4, A Дрібне) – server:
 *  - N4: tržba bez refundOf se zápornou platbou → karanténa INVALID_SALE (FS by dostala zápornou celk_trzba za prodej);
 *  - N7: otevřená karanténa MODE_MISMATCH na účtu v ostrém provozu drží zrušený účet (může to být skutečná ostrá tržba);
 *  - N8: zrušený účet nedostává e-maily quarantine:* („dokud ji nevyřídíte, Finanční správě se neodešle“ neplatí);
 *  - N10: opakované odeslání už přijaté tržby (hodiny pokladny napřed) po zrušení není karanténa ACCOUNT_CLOSED.
 */
import { getDb, schema } from "@ez/db";
import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAccount, runRetention, unsentProductionOf } from "@/lib/server/lifecycle";
import { ingestSales } from "@/lib/server/sales";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const DAY = 86_400_000;
const mails = (to: string, prefix: string) =>
  getDb()
    .select()
    .from(schema.emailOutbox)
    .where(and(eq(schema.emailOutbox.to, to), like(schema.emailOutbox.dedupeKey, `${prefix}%`)));

describe("R7.15 – rest of A (server)", () => {
  it("gate N4: a regular sale with a negative payment → quarantine INVALID_SALE", async () => {
    const s = await seedAccount({ mode: "mock" });
    const sale = deviceSale(s.unit.id, {
      lines: [{ name: "Střih", qty: 1, unitPrice: 100000, vatRate: 21 }],
      payments: [
        { method: "cash", amount: -50000 },
        { method: "gift_voucher", amount: 150000 },
      ],
    });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "INVALID_SALE" });
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) })).toBeUndefined();
  });

  it("control N4: a regular sale with positive split payments is accepted", async () => {
    const s = await seedAccount({ mode: "mock" });
    const sale = deviceSale(s.unit.id, {
      lines: [{ name: "Střih", qty: 1, unitPrice: 100000, vatRate: 21 }],
      payments: [
        { method: "gift_voucher", amount: 50000 },
        { method: "cash", amount: 50000 },
      ],
    });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r).toMatchObject({ ok: true });
  });

  it("gate N7: an open MODE_MISMATCH (mock sale on a production account) holds the closed account; day-0 mail lists it", async () => {
    const s = await seedAccount({ mode: "production" });
    const sale = deviceSale(s.unit.id, { mode: "mock", soldAt: new Date(Date.now() + 1000).toISOString() });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r).toMatchObject({ quarantined: true, code: "MODE_MISMATCH" });
    expect((await unsentProductionOf(s.account.id)).quarantine).toHaveLength(1);
    await closeAccount(s.account.id, { confirm: true });
    const [day0] = await mails(s.user.email, "closed-summary:");
    const text = String((day0!.payload as { text: string }).text);
    expect(text).toMatch(/1× tržba v karanténě/);
    expect(text).not.toMatch(/Neodeslané ostré tržby nemá/);
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 1 });
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toBeTruthy();
  });

  it("control N7: MODE_MISMATCH on an account that is not in production does not hold it", async () => {
    const s = await seedAccount({ mode: "playground" });
    const sale = deviceSale(s.unit.id, { mode: "mock", soldAt: new Date(Date.now() + 1000).toISOString() });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r).toMatchObject({ quarantined: true, code: "MODE_MISMATCH" });
    expect((await unsentProductionOf(s.account.id)).quarantine).toHaveLength(0);
  });

  it("gate N8: a closed account gets no quarantine:* mails for a sale sold after closing", async () => {
    const s = await seedAccount({ mode: "mock" });
    await closeAccount(s.account.id, { confirm: true });
    const sale = deviceSale(s.unit.id, { soldAt: new Date(Date.now() + 2000).toISOString() });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r).toMatchObject({ quarantined: true, code: "ACCOUNT_CLOSED" });
    expect(await mails(s.user.email, "quarantine:")).toHaveLength(0);
  });

  it("control N8: a live account still gets the quarantine mail", async () => {
    const s = await seedAccount({ mode: "mock" });
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { unitId: crypto.randomUUID() }) as never]);
    expect(await mails(s.user.email, "quarantine:")).toHaveLength(1);
  });

  it("gate N10: re-sending an already accepted sale (clock ahead) after closing is ok, not a new quarantine", async () => {
    const s = await seedAccount({ mode: "mock" });
    const sale = deviceSale(s.unit.id, { soldAt: new Date(Math.floor((Date.now() + 5 * 60_000) / 1000) * 1000).toISOString() });
    const [r0] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r0).toMatchObject({ ok: true, inserted: true });
    await closeAccount(s.account.id, { confirm: true });
    const [r1] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r1).toMatchObject({ ok: true, inserted: false });
    expect(await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, sale.id) })).toBeUndefined();
  });

  it("control N10: a new sale sold after closing is still quarantined ACCOUNT_CLOSED", async () => {
    const s = await seedAccount({ mode: "mock" });
    await closeAccount(s.account.id, { confirm: true });
    const [r] = await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { soldAt: new Date(Date.now() + 3000).toISOString() }) as never]);
    expect(r).toMatchObject({ quarantined: true, code: "ACCOUNT_CLOSED" });
  });
});
