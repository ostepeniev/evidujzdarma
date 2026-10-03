/**
 * R6.9 (рецензія №3, A В-3) – server nepřijme vratku, jejíž evidovaná částka (nebo čerpání) je v absolutní hodnotě
 * vyšší než u původní tržby. Taková vratka jde do karantény, neztratí se.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPin } from "@/lib/pos/pin";
import { ingestSales } from "@/lib/server/sales";
import { verifyStaffPinOnline } from "@/lib/server/staff-pin";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

type R = { id: string; ok: boolean; quarantined?: boolean; code?: string };
type P = { method: string; amount: number };

async function original(payments: P[]) {
  const s = await seedAccount();
  await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
  const ctx = await deviceContext(s.device.id);
  const total = payments.reduce((a, p) => a + p.amount, 0);
  const sale = deviceSale(s.unit.id, { lines: [{ name: "Masáž", qty: 1, unitPrice: total, vatRate: 21 }], payments });
  const [r] = (await ingestSales(ctx, [sale as never])) as R[];
  expect(r!.ok).toBe(true);
  const refund = async (rp: P[]) => {
    const amount = -rp.reduce((a, p) => a + p.amount, 0);
    const approval = (await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: sale.id, amount })).approval!;
    const x = deviceSale(s.unit.id, { lines: [{ name: "Masáž", qty: -1, unitPrice: amount, vatRate: 21 }], payments: rp, refundOf: sale.id, staffId: s.owner.id, approval });
    const [res] = (await ingestSales(ctx, [x as never])) as R[];
    return { res: res!, id: x.id };
  };
  return { refund };
}

describe("R6.9 – refund evidenced amount is bounded by the original", () => {
  it("gate: refund [cash −1 000] of an original evidenced 700 (300 voucher + 700 cash) → quarantine REFUND_EXCEEDS", async () => {
    const { refund } = await original([{ method: "gift_voucher", amount: 30000 }, { method: "cash", amount: 70000 }]);
    const { res, id } = await refund([{ method: "cash", amount: -100000 }]);
    expect(res).toMatchObject({ ok: false, quarantined: true, code: "REFUND_EXCEEDS" });
    expect(await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, id) })).toBeTruthy();
  });

  it("the mirrored refund [voucher −300, cash −700] is accepted with evidenced −700", async () => {
    const { refund } = await original([{ method: "gift_voucher", amount: 30000 }, { method: "cash", amount: 70000 }]);
    const { res, id } = await refund([{ method: "gift_voucher", amount: -30000 }, { method: "cash", amount: -70000 }]);
    expect(res.ok).toBe(true);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) }))!.evidencedTotal).toBe(-70000);
  });

  it("čerpání (cerp_zuct) of the refund is bounded too", async () => {
    const { refund } = await original([{ method: "credit", amount: 50000 }, { method: "cash", amount: 50000 }]);
    const { res } = await refund([{ method: "credit", amount: -100000 }]);
    expect(res).toMatchObject({ ok: false, quarantined: true, code: "REFUND_EXCEEDS" });
  });

  it("a refund cannot carry a positive payment row", async () => {
    const { refund } = await original([{ method: "cash", amount: 100000 }]);
    const { res } = await refund([{ method: "gift_voucher", amount: 50000 }, { method: "cash", amount: -150000 }].reverse());
    expect(res).toMatchObject({ ok: false, quarantined: true, code: "INVALID_SALE" });
  });
});
