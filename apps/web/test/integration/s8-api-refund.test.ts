/**
 * S8 rozd. 3.5 – POST /v1/sales/{id}/refund: celá vratka, částečná, překročení, jednotka originálu, idempotence.
 * Logika vratek je táž jako u pokladny (Т11, FOR UPDATE, refundCapacity); PIN vlastníka nahrazuje oprávnění refunds:write.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as salesPOST } from "@/app/api/v1/sales/route";
import { POST as refundPOST } from "@/app/api/v1/sales/[id]/refund/route";
import { __setTransportFactoryForTests } from "@/lib/server/fiscal";
import { addUnit, apiSale, call, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const refund = (token: string, id: string, body: Record<string, unknown>) => call(refundPOST, { path: `/api/v1/sales/${id}/refund`, token, params: { id }, body });

async function setup(opts: Parameters<typeof seedApi>[0] = {}) {
  const fake = fakeTransports();
  __setTransportFactoryForTests(fake.factory);
  const s = await seedApi(opts);
  const original = apiSale(s.unit.id, {
    lines: [
      { name: "Ubytování 2 noci", qty: 1, unitPrice: 320000, vatRate: 12, kind: "goods" },
      { name: "Minibar", qty: 2, unitPrice: 5000, vatRate: 21, kind: "goods" },
    ],
    payments: [{ method: "card", amount: 330000 }],
  });
  const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [original] } });
  expect(r.json.results[0].status).toBe("confirmed");
  return { s, original, fake };
}

describe("S8 – refunds via API", () => {
  it("gate: full refund without lines → a negative sale on the original's unit, refundOf set, POK", async () => {
    const { s, original, fake } = await setup();
    const id = crypto.randomUUID();
    const r = await refund(s.token, original.id, { id, externalRef: "ALI-STORNO-1", reason: "Storno pobytu" });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ id, externalRef: "ALI-STORNO-1", status: "confirmed", evidencedAmount: -330000 });
    const row = (await getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) }))!;
    expect(row).toMatchObject({ refundOf: original.id, unitId: s.unit.id, total: -330000, integrationId: s.integration.id, mode: "playground", approvedBy: null });
    expect(row.payments).toEqual([{ method: "card", amount: -330000 }]);
    expect(Math.abs(row.soldAt.getTime() - Date.now())).toBeLessThan(5_000);
    expect(fake.calls).toHaveLength(2);
    // opakování se stejným tělem → stejný výsledek, nic nového
    const again = await refund(s.token, original.id, { id, externalRef: "ALI-STORNO-1", reason: "Storno pobytu" });
    expect(again.json).toEqual(r.json);
    expect(fake.calls).toHaveLength(2);
  });

  it("gate: partial refund – only lines of the original; two partials up to the original, then refund_exceeds_original", async () => {
    const { s, original } = await setup();
    const one = await refund(s.token, original.id, { id: crypto.randomUUID(), lines: [{ name: "Minibar", qty: 1, unitPrice: 5000, vatRate: 21 }] });
    expect(one.json).toMatchObject({ status: "confirmed", evidencedAmount: -5000 });
    const two = await refund(s.token, original.id, { id: crypto.randomUUID(), lines: [{ name: "Minibar", qty: 1, unitPrice: 5000, vatRate: 21 }] });
    expect(two.json.status).toBe("confirmed");
    const three = await refund(s.token, original.id, { id: crypto.randomUUID(), lines: [{ name: "Minibar", qty: 1, unitPrice: 5000, vatRate: 21 }] });
    expect(three.status).toBe(422);
    expect(three.json.error.code).toBe("refund_exceeds_original");
    const unknownLine = await refund(s.token, original.id, { id: crypto.randomUUID(), lines: [{ name: "Wellness", qty: 1, unitPrice: 5000, vatRate: 21 }] });
    expect(unknownLine.status).toBe(422);
    expect(unknownLine.json.error.code).toBe("refund_exceeds_original");
    const rest = await refund(s.token, original.id, { id: crypto.randomUUID() });
    expect(rest.json).toMatchObject({ status: "confirmed", evidencedAmount: -320000 });
    const full = await refund(s.token, original.id, { id: crypto.randomUUID() });
    expect(full.status).toBe(422);
    expect(full.json.error.code).toBe("refund_exceeds_original");
  });

  it("gate: the refund stays on the original's unit even if the token later loses that unit", async () => {
    const { s, original } = await setup();
    const other = await addUnit(s.account.id);
    await getDb().update(schema.integrations).set({ unitIds: [other.id] }).where(eq(schema.integrations.id, s.integration.id));
    const r = await refund(s.token, original.id, { id: crypto.randomUUID() });
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe("unit_not_found");
  });

  it("gate: refunds:write is required; a refund of a refund and an unknown original are refused", async () => {
    const { s, original } = await setup({ scopes: ["sales:write", "sales:read"] });
    const denied = await refund(s.token, original.id, { id: crypto.randomUUID() });
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("insufficient_scope");
    const { s: s2, original: o2 } = await setup();
    const first = await refund(s2.token, o2.id, { id: crypto.randomUUID(), lines: [{ name: "Minibar", qty: 1, unitPrice: 5000, vatRate: 21 }] });
    const ofRefund = await refund(s2.token, first.json.id, { id: crypto.randomUUID() });
    expect(ofRefund.status).toBe(422);
    const unknown = await refund(s2.token, crypto.randomUUID(), { id: crypto.randomUUID() });
    expect(unknown.status).toBe(404);
    expect(unknown.json.error.code).toBe("original_not_found");
  });

  it("gate: a refund of a not yet confirmed original is accepted and queued (same as the PWA)", async () => {
    __setTransportFactoryForTests(fakeTransports(() => ({ ok: false, retryable: true, code: "NETWORK", message: "FS nedostupná" })).factory);
    const s = await seedApi();
    const original = apiSale(s.unit.id);
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [original] } });
    expect(r.json.results[0].status).toBe("queued");
    const ref = await refund(s.token, original.id, { id: crypto.randomUUID() });
    expect(ref.status).toBe(200);
    expect(ref.json.status).toBe("queued");
  });
});
