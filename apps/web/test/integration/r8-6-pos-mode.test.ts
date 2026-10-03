/**
 * R8.6 (рецензія №5, A N11; invariant 2) – režim patří tržbě tak, jak ji přijal server. Po „Odeslat v aktuálním režimu“
 * (send_current_mode) server tržbu eviduje v ostrém provozu – pokladna si to musí převzít, jinak blokuje vratku, kterou
 * server přijme, a na dotisku píše „TESTOVACÍ REŽIM“ bez POK.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { receiptTextFor } from "@/components/pos/receipt-view";
import { hashPin } from "@/lib/pos/pin";
import { refundBlockedReason } from "@/lib/pos/sale-factory";
import { applyPolledStatuses, applyServerResult, type ServerSaleStatus } from "@/lib/pos/sync-result";
import type { LocalSale, PosConfig } from "@/lib/pos/types";
import { salesStatus } from "@/lib/server/fiscal";
import { resolveQuarantine } from "@/lib/server/quarantine";
import { ingestSales } from "@/lib/server/sales";
import { verifyStaffPinOnline } from "@/lib/server/staff-pin";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const config = {
  account: { name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345679", vatPayer: false, iban: null, receiptHeader: null, receiptFooter: null, receiptShowPok: true, mode: "production", plan: "free" },
  units: [{ id: "u1", label: "Salon", type: "stala_provozovna", fsUnitId: 303, active: true, address: null }],
  device: { deviceId: "d", registerId: "P1", sequencePrefix: "P1-", unitId: "u1" },
  staff: [],
  catalog: [],
} as unknown as PosConfig;

describe("R8.6 – the register takes the sale's mode from the server", () => {
  it("gate S5: after send_current_mode the polled patch carries mode 'production' and the refund is no longer blocked", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
    const orig = deviceSale(s.unit.id, { mode: "mock", soldAt: new Date(Math.floor((Date.now() - 600_000) / 1000) * 1000).toISOString() });
    await getDb().update(schema.accounts).set({ eetModeChangedAt: new Date(Date.now() - 3_600_000) }).where(eq(schema.accounts.id, s.account.id));
    const [r0] = await ingestSales(await deviceContext(s.device.id), [orig as never]);
    expect(r0).toMatchObject({ quarantined: true, code: "MODE_MISMATCH" });
    expect((await resolveQuarantine(s.account.id, orig.id, { action: "send_current_mode" })).ok).toBe(true);

    const statuses = (await salesStatus([orig.id], s.account.id)) as unknown as ServerSaleStatus[];
    const [[, patch]] = applyPolledStatuses([orig.id], statuses);
    expect(patch).toMatchObject({ mode: "production" });
    const local = { ...(orig as object), unitId: "u1", unitLabel: "Salon", subtotal: 35000, total: 35000, vat: null, cashReceived: null, status: "rejected", confirmationCode: null, error: null, ...patch } as unknown as LocalSale;
    expect(refundBlockedReason(local, "production")).toBeNull();

    // dotisk: ostrý doklad, ne „TESTOVACÍ REŽIM“; s POK, jakmile ho tržba má
    const printed = receiptTextFor({ ...local, status: "confirmed", confirmationCode: "a1b2c3d4-e5f6a7b8-c9d0e1f2-a3b4c5d6-e7" }, config, 42, "https://evidujzdarma.cz");
    expect(printed).not.toMatch(/TESTOVACÍ REŽIM/);
    expect(printed).toMatch(/a1b2c3d4-e5f6a7b8-c9d0e1f2-a3b4c5d6-e7/);

    // …a server ostrou vratku k této tržbě opravdu přijme
    const ctx = await deviceContext(s.device.id);
    const approval = (await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: orig.id, amount: 35000 })).approval!;
    const x = deviceSale(s.unit.id, { mode: "production", lines: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "cash", amount: -35000 }], refundOf: orig.id, staffId: s.owner.id, approval });
    expect((await ingestSales(ctx, [x as never]))[0]).toMatchObject({ ok: true });
  });

  it("gate: the POST result (status merged into it) carries the mode too; unknown values are ignored", () => {
    expect(applyServerResult({ id: "x", ok: true, status: "queued", mode: "production" })).toMatchObject({ mode: "production" });
    expect(applyServerResult({ id: "x", ok: true, status: "queued", mode: "bogus" as never })).not.toHaveProperty("mode");
    expect(applyServerResult({ id: "x", ok: true, status: "queued" })).not.toHaveProperty("mode");
    // odmítnutá tržba (karanténa) režim nemění – server ji v evidenci nemá
    expect(applyServerResult({ id: "x", ok: false, quarantined: true, code: "MODE_MISMATCH" })).not.toHaveProperty("mode");
  });
});
