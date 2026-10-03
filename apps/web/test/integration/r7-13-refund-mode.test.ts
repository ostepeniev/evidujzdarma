/**
 * R7.13 (рецензія №4, A N2; invariant 2) – vratka jen v režimu původní tržby.
 *  - server: vratka v jiném režimu, než byla prodána původní tržba → karanténa REFUND_MODE_MISMATCH (rozhodne vlastník),
 *    do sales se neuloží; ve stejném režimu projde;
 *  - pokladna: u tržby jiného režimu vratku nenabízí a řekne proč.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPin } from "@/lib/pos/pin";
import { refundBlockedReason } from "@/lib/pos/sale-factory";
import type { LocalSale } from "@/lib/pos/types";
import { QUARANTINE_REASON_TEXT } from "@/lib/server/quarantine";
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

async function refundAcrossModes(soldIn: "playground" | "production", refundIn: "playground" | "production") {
  const s = await seedAccount({ mode: soldIn });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  await storeVerifiedCertificate(s.account.id, testCert().cert, "playground");
  await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
  const orig = deviceSale(s.unit.id, { mode: soldIn, soldAt: new Date(Date.now() - 3_600_000).toISOString() });
  const [r0] = await ingestSales(await deviceContext(s.device.id), [orig as never]);
  expect(r0!.ok).toBe(true);
  if (refundIn !== soldIn) {
    await getDb().update(schema.accounts).set({ eetMode: refundIn, eetModeChangedAt: new Date(Date.now() - 60_000) }).where(eq(schema.accounts.id, s.account.id));
  }
  const ctx = await deviceContext(s.device.id);
  const approval = (await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: orig.id, amount: 35000 })).approval!;
  const x = deviceSale(s.unit.id, {
    mode: refundIn,
    lines: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }],
    payments: [{ method: "cash", amount: -35000 }],
    refundOf: orig.id,
    staffId: s.owner.id,
    approval,
  });
  const [r] = await ingestSales(ctx, [x as never]);
  return { r, x };
}

describe("R7.13 – a refund only in the mode of the original sale", () => {
  it("gate N2: a production refund of a Playground original → quarantine REFUND_MODE_MISMATCH, not in sales", async () => {
    const { r, x } = await refundAcrossModes("playground", "production");
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "REFUND_MODE_MISMATCH" });
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, x.id) })).toBeUndefined();
    const q = await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, x.id) });
    expect(q).toMatchObject({ reasonCode: "REFUND_MODE_MISMATCH" });
    expect(QUARANTINE_REASON_TEXT.REFUND_MODE_MISMATCH).toBeTruthy();
  });

  it("control: a refund in the same mode as the original is accepted", async () => {
    const { r, x } = await refundAcrossModes("playground", "playground");
    expect(r).toMatchObject({ ok: true });
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, x.id) }))!.mode).toBe("playground");
  });

  it("gate: the register does not offer a refund of a sale sold in another mode and says why", () => {
    const sale = { mode: "playground" } as LocalSale;
    // text R8.3 (рецензія №5): tržba se neprodává – „původní prodej proběhl…“
    expect(refundBlockedReason(sale, "production")).toBe("Původní prodej proběhl v režimu Playground. Vratku k němu pokladna neodešle.");
    expect(refundBlockedReason({ mode: "mock" } as LocalSale, "playground")).toBe("Původní prodej proběhl v ukázkovém režimu. Vratku k němu pokladna neodešle.");
    expect(refundBlockedReason({ mode: "production" } as LocalSale, "production")).toBeNull();
    const view = readFileSync(new URL("../../src/components/pos/receipt-view.tsx", import.meta.url), "utf8");
    expect(view).toMatch(/refundBlockedReason\(sale, config\.account\.mode\)/);
    const app = readFileSync(new URL("../../src/components/pos/pos-app.tsx", import.meta.url), "utf8");
    expect(app).toMatch(/refundBlockedReason\(refund, config\.account\.mode\)/);
  });
});
