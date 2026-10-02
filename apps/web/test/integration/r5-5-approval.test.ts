/**
 * R5.5 – schválení vratky vlastníkem je vázané na konkrétní tržbu a částku a dá se použít jednou.
 * Dřív jedno schválení otevřelo libovolné vratky na libovolné tržby po dobu 15 min (A В-1).
 */
import { randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as pinRoute } from "@/app/api/pokladna/pin/route";
import { hashPin } from "@/lib/pos/pin";
import { ingestSales } from "@/lib/server/sales";
import { resetPinAttempts } from "@/lib/server/staff-pin";
import { sha256 } from "@/lib/server/tokens";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  resetPinAttempts();
});

type R = { ok: boolean; code?: string };

async function setup() {
  const s = await seedAccount();
  const token = randomBytes(32).toString("base64url");
  await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
  await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
  const ctx = await deviceContext(s.device.id);
  const originals = [deviceSale(s.unit.id), deviceSale(s.unit.id), deviceSale(s.unit.id)];
  await ingestSales(ctx, originals as never);
  const approve = async (body: Record<string, unknown>) => {
    const res = await pinRoute(
      new Request("http://localhost/api/pokladna/pin", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ staffId: s.owner.id, pin: "246813", purpose: "refund", ...body }),
      }),
    );
    return { status: res.status, approval: ((await res.json()) as { approval?: string }).approval };
  };
  const refund = (of: string, approval: string | undefined, amount = 35000) =>
    deviceSale(s.unit.id, { staffId: s.cashier.id, approval, refundOf: of, lines: [{ name: "Střih", qty: -1, unitPrice: amount, vatRate: 21 }], payments: [{ method: "cash", amount: -amount }] });
  return { s, ctx, originals, approve, refund };
}

describe("R5.5 – refund approval bound to one sale and amount, single use", () => {
  it("gate: one approval, refunds of three different sales → only the approved one passes", async () => {
    const { ctx, originals, approve, refund } = await setup();
    const { approval } = await approve({ refundOf: originals[0]!.id, amount: 35000 });
    const out = (await ingestSales(ctx, originals.map((o) => refund(o.id, approval)) as never)) as R[];
    expect(out.map((r) => r.ok)).toEqual([true, false, false]);
    expect(out.slice(1).map((r) => r.code)).toEqual(["REFUND_NOT_AUTHORIZED", "REFUND_NOT_AUTHORIZED"]);
  });

  it("an approval for another sale or another amount is refused", async () => {
    const { ctx, originals, approve, refund } = await setup();
    const { approval } = await approve({ refundOf: originals[1]!.id, amount: 35000 });
    const [foreign] = (await ingestSales(ctx, [refund(originals[0]!.id, approval)] as never)) as R[];
    expect(foreign).toMatchObject({ ok: false, code: "REFUND_NOT_AUTHORIZED" });
    const { approval: small } = await approve({ refundOf: originals[2]!.id, amount: 10000 });
    const [otherAmount] = (await ingestSales(ctx, [refund(originals[2]!.id, small, 35000)] as never)) as R[];
    expect(otherAmount).toMatchObject({ ok: false, code: "REFUND_NOT_AUTHORIZED" });
  });

  it("the same approval cannot be used by a second refund; re-syncing the same refund stays fine", async () => {
    const { ctx, originals, approve, refund } = await setup();
    const { approval } = await approve({ refundOf: originals[0]!.id, amount: 35000 });
    const first = refund(originals[0]!.id, approval);
    expect(((await ingestSales(ctx, [first] as never)) as R[])[0]!.ok).toBe(true);
    expect(((await ingestSales(ctx, [first] as never)) as R[])[0]!.ok).toBe(true); // stejná vratka znovu – idempotentní
    const [second] = (await ingestSales(ctx, [refund(originals[0]!.id, approval)] as never)) as R[];
    expect(second).toMatchObject({ ok: false, code: "REFUND_NOT_AUTHORIZED" });
  });

  it("a refund approval must name the sale and the amount", async () => {
    const { approve } = await setup();
    expect((await approve({})).status).toBe(400);
  });
});
