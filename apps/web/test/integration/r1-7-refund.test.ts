/**
 * R1.7 – vratky ověřuje server. Gate: druhá vratka na stejnou tržbu → 409.
 */
import { randomUUID } from "node:crypto";
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

type R = { id: string; ok: boolean; quarantined?: boolean; code?: string; httpStatus?: number };

const refundOf = (unitId: string, original: { id: string }, over: Record<string, unknown> = {}) =>
  deviceSale(unitId, { lines: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "cash", amount: -35000 }], refundOf: original.id, ...over });

async function setup() {
  const s = await seedAccount();
  await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
  const ctx = await deviceContext(s.device.id);
  const original = deviceSale(s.unit.id, { staffId: s.cashier.id });
  const [r] = (await ingestSales(ctx, [original as never])) as R[];
  expect(r!.ok).toBe(true);
  // schválení vratky vydává server po ověření PINu vlastníka (R3.10)
  // od R5.5 je schválení vázané na tržbu a částku (haléře, kladně)
  const approve = async (of: string = original.id, amount = 35000) => (await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: of, amount })).approval!;
  return { s, ctx, original, approve };
}

describe("R1.7 – refunds are validated on the server", () => {
  it("gate: a second refund of the same sale is a 409 conflict (quarantined, not dropped)", async () => {
    const { s, ctx, original, approve } = await setup();
    const [first] = (await ingestSales(ctx, [refundOf(s.unit.id, original, { staffId: s.owner.id, approval: await approve() }) as never])) as R[];
    expect(first!.ok).toBe(true);
    const second = refundOf(s.unit.id, original, { staffId: s.owner.id, approval: await approve() });
    const [r] = (await ingestSales(ctx, [second as never])) as R[];
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "REFUND_DUPLICATE", httpStatus: 409 });
    expect(await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, second.id) })).toBeTruthy();
  });

  it("two refunds racing for the same sale: exactly one is stored", async () => {
    const { s, ctx, original, approve } = await setup();
    const a = refundOf(s.unit.id, original, { staffId: s.owner.id, approval: await approve() });
    const b = refundOf(s.unit.id, original, { staffId: s.owner.id, approval: await approve() });
    const out = (await Promise.all([ingestSales(ctx, [a as never]), ingestSales(ctx, [b as never])])).flat() as R[];
    expect(out.filter((r) => r.ok)).toHaveLength(1);
    const stored = await getDb().select().from(schema.sales).where(eq(schema.sales.refundOf, original.id));
    expect(stored).toHaveLength(1);
  });

  it("a refund larger than the original is rejected", async () => {
    const { s, ctx, original, approve } = await setup();
    const big = refundOf(s.unit.id, original, { staffId: s.owner.id, approval: await approve(original.id, 70000), lines: [{ name: "Střih", qty: -2, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "cash", amount: -70000 }] });
    const [r] = (await ingestSales(ctx, [big as never])) as R[];
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "REFUND_EXCEEDS" });
  });

  it("a cashier needs the owner's approval; with a server-issued approval the refund is accepted", async () => {
    const { s, ctx, original, approve } = await setup();
    const [denied] = (await ingestSales(ctx, [refundOf(s.unit.id, original, { staffId: s.cashier.id }) as never])) as R[];
    expect(denied).toMatchObject({ ok: false, quarantined: true, code: "REFUND_NOT_AUTHORIZED", httpStatus: 403 });
    const approved = refundOf(s.unit.id, original, { staffId: s.cashier.id, approval: await approve() });
    const [ok] = (await ingestSales(ctx, [approved as never])) as R[];
    expect(ok!.ok).toBe(true);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, approved.id) }))!.approvedBy).toBe(s.owner.id);
  });

  it("staffId and refundOf must belong to the account", async () => {
    const { s, ctx, original, approve } = await setup();
    const other = await seedAccount();
    const [foreignStaff] = (await ingestSales(ctx, [deviceSale(s.unit.id, { staffId: other.owner.id }) as never])) as R[];
    expect(foreignStaff).toMatchObject({ ok: false, quarantined: true, code: "UNKNOWN_STAFF" });
    const unknownId = randomUUID();
    const [unknownOriginal] = (await ingestSales(ctx, [refundOf(s.unit.id, { id: unknownId }, { staffId: s.owner.id, approval: await approve(unknownId) }) as never])) as R[];
    expect(unknownOriginal).toMatchObject({ ok: false, quarantined: true, code: "REFUND_UNKNOWN_ORIGINAL" });
    const [refundOfRefund] = (await ingestSales(ctx, [refundOf(s.unit.id, original, { staffId: s.owner.id, approval: await approve() }) as never])) as R[];
    expect(refundOfRefund!.ok).toBe(true);
  });
});
