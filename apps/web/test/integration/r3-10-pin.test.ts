/**
 * R3.10 – PIN: otisk PINu vlastníka se do pokladny neposílá, PIN vlastníka se ověřuje na serveru
 * s rostoucí prodlevou po chybách, vlastník musí mít PIN ≥ 6 číslic a vratka se přijme jen se
 * schválením, které vydal server (zařízení samo nemůže tvrdit, že prodává vlastník).
 */
import { randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as config } from "@/app/api/pokladna/config/route";
import { POST as pinRoute } from "@/app/api/pokladna/pin/route";
import { hashPin } from "@/lib/pos/pin";
import { HttpError } from "@/lib/server/auth";
import { ingestSales } from "@/lib/server/sales";
import { resetPinAttempts, validatePinForRole } from "@/lib/server/staff-pin";
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

async function setup() {
  const s = await seedAccount();
  const token = randomBytes(32).toString("base64url");
  await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
  await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
  await getDb().update(schema.staff).set({ pinHash: await hashPin("1234") }).where(eq(schema.staff.id, s.cashier.id));
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const pin = (staffId: string, value: string, purpose = "refund") => pinRoute(new Request("http://localhost/api/pokladna/pin", { method: "POST", headers: auth, body: JSON.stringify({ staffId, pin: value, purpose }) }));
  return { s, auth, pin };
}

describe("R3.10 – PIN", () => {
  it("gate: the POS config never contains the owner's PIN hash", async () => {
    const { s, auth } = await setup();
    const cfg = (await (await config(new Request("http://localhost/api/pokladna/config", { headers: auth }))).json()) as { staff: { id: string; pinHash: string | null; onlinePin?: boolean }[] };
    const owner = cfg.staff.find((x) => x.id === s.owner.id)!;
    expect(owner.pinHash).toBeNull();
    expect(owner.onlinePin).toBe(true);
    expect(cfg.staff.find((x) => x.id === s.cashier.id)!.pinHash).toBeTruthy();
  });

  it("the owner's PIN must have at least 6 digits; a cashier's 4–8", () => {
    expect(() => validatePinForRole("owner", "1234")).toThrow(HttpError);
    expect(() => validatePinForRole("owner", "123456")).not.toThrow();
    expect(() => validatePinForRole("cashier", "1234")).not.toThrow();
  });

  it("wrong PINs lock the owner out with a growing delay", async () => {
    const { s, pin } = await setup();
    expect((await pin(s.owner.id, "000000")).status).toBe(401);
    expect((await pin(s.owner.id, "000001")).status).toBe(401);
    const third = await pin(s.owner.id, "000002");
    expect(third.status).toBe(401);
    const locked = await pin(s.owner.id, "246813"); // i správný PIN počká
    expect(locked.status).toBe(429);
    expect(Number((await locked.json()).retryAfter)).toBeGreaterThan(0);
  });

  it("a refund is accepted only with a server-issued owner approval", async () => {
    const { s, pin } = await setup();
    const ctx = await deviceContext(s.device.id);
    const original = deviceSale(s.unit.id, { staffId: s.cashier.id });
    await ingestSales(ctx, [original as never]);
    const refund = (over: Record<string, unknown>) =>
      deviceSale(s.unit.id, { lines: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "cash", amount: -35000 }], refundOf: original.id, ...over });

    // zařízení tvrdí, že prodává vlastník – bez schválení serveru to nestačí
    const [claimed] = await ingestSales(ctx, [refund({ staffId: s.owner.id }) as never]);
    expect(claimed).toMatchObject({ ok: false, code: "REFUND_NOT_AUTHORIZED" });

    const res = await pin(s.owner.id, "246813");
    expect(res.status).toBe(200);
    const { approval } = (await res.json()) as { approval: string };
    const forged = approval.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    const [bad] = await ingestSales(ctx, [refund({ staffId: s.cashier.id, approval: forged }) as never]);
    expect(bad).toMatchObject({ ok: false, code: "REFUND_NOT_AUTHORIZED" });
    const ok = refund({ staffId: s.cashier.id, approval });
    const [good] = await ingestSales(ctx, [ok as never]);
    expect(good!.ok).toBe(true);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, ok.id) }))!.approvedBy).toBe(s.owner.id);
  });
});
