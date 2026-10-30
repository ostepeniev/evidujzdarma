/**
 * S8 rozd. 3.3–3.4, 9.5 – POST/GET /v1/sales: dávka 100, částečná platnost, idempotence (opakování, souběh, konflikt),
 * externalRef, automatické pořadové číslo bez mezer, credit_topup → urceno_cerp_zuct, transfer → not_evidenced,
 * rozpočet 2,5 s na synchronní odeslání. Evidence, fronta a podpis jsou tytéž jako u pokladny (invariant S8).
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as salesGET, POST as salesPOST } from "@/app/api/v1/sales/route";
import { GET as saleGET } from "@/app/api/v1/sales/[id]/route";
import { __setTransportFactoryForTests, processPending } from "@/lib/server/fiscal";
import { apiSale, call, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const post = (token: string, sales: unknown[]) => call(salesPOST, { path: "/api/v1/sales", token, body: { sales } });

describe("S8 – POST /v1/sales", () => {
  it("gate: a batch of 100 → 200 with results in request order, each a normal sales row of this integration", async () => {
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const s = await seedApi();
    const batch = Array.from({ length: 100 }, () => apiSale(s.unit.id));
    const r = await post(s.token, batch);
    expect(r.status).toBe(200);
    expect(r.json.results.map((x: { id: string }) => x.id)).toEqual(batch.map((b) => b.id));
    const rows = await getDb().select().from(schema.sales);
    expect(rows).toHaveLength(100);
    for (const row of rows) expect(row).toMatchObject({ integrationId: s.integration.id, deviceId: s.integration.deviceId, mode: "playground" });
    const first = r.json.results[0];
    expect(first).toMatchObject({ status: "confirmed", externalRef: batch[0]!.externalRef, evidencedAmount: 320000, notEvidencedAmount: 0, attempts: 1, error: null });
    expect(first.pok).toMatch(/ff$/);
    expect(first.receiptUrl).toMatch(new RegExp(`/u/${batch[0]!.id}$`));
    expect(Date.parse(first.deadlineAt) - Date.parse(batch[0]!.soldAt)).toBe(48 * 3_600_000);
  }, 60_000);

  it("gate: partial validity – an invalid sale with a uuid goes to the quarantine (owner sees it), the rest is stored", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const good = apiSale(s.unit.id);
    const invalid = apiSale(s.unit.id, { lines: [] });
    const future = apiSale(s.unit.id, { soldAt: new Date(Date.now() + 3_600_000).toISOString() });
    const tooBig = apiSale(s.unit.id, { lines: [{ name: "X", qty: 1, unitPrice: 10_000_000_000, vatRate: 21 }], payments: [{ method: "cash", amount: 10_000_000_000 }] });
    const r = await post(s.token, [good, invalid, future]);
    expect(r.status).toBe(200);
    expect(r.json.results[0].status).toBe("confirmed");
    expect(r.json.results[1]).toMatchObject({ id: invalid.id, status: "quarantined", error: { code: "invalid_request", retryable: false } });
    expect(r.json.results[1].error.field).toMatch(/^sales\[1\]\.lines/);
    expect(r.json.results[2]).toMatchObject({ status: "quarantined", error: { code: "sale_in_future" } });
    const q = await getDb().select().from(schema.saleQuarantine);
    expect(q.map((x) => x.id).sort()).toEqual([invalid.id, future.id].sort());
    expect(q.every((x) => x.deviceId === s.integration.deviceId)).toBe(true);
    const big = await post(s.token, [tooBig]);
    expect(big.json.results[0]).toMatchObject({ status: "quarantined", error: { code: "amount_out_of_range" } });
    // a stav je k dohledání
    const again = await call(saleGET, { path: `/api/v1/sales/${future.id}`, token: s.token, params: { id: future.id } });
    expect(again.json).toMatchObject({ id: future.id, status: "quarantined" });
  });

  it("gate: without a uuid id the whole request is 400 invalid_request with the field, nothing stored", async () => {
    const s = await seedApi();
    const r = await post(s.token, [apiSale(s.unit.id), apiSale(s.unit.id, { id: "abc" })]);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatchObject({ code: "invalid_request", field: "sales[1].id" });
    expect(await getDb().select().from(schema.sales)).toHaveLength(0);
    expect(await getDb().select().from(schema.saleQuarantine)).toHaveLength(0);
  });

  it("gate: refundOf and approval are not accepted on POST /v1/sales; the word prepayment is not part of the API", async () => {
    const s = await seedApi();
    const a = await post(s.token, [apiSale(s.unit.id, { refundOf: crypto.randomUUID() })]);
    expect(a.status).toBe(200);
    expect(a.json.results[0]).toMatchObject({ status: "quarantined", error: { code: "invalid_request" } });
    const b = await post(s.token, [apiSale(s.unit.id, { lines: [{ name: "Kredit", qty: 1, unitPrice: 100000, vatRate: 0, kind: "prepayment" }], payments: [{ method: "cash", amount: 100000 }] })]);
    expect(b.json.results[0]).toMatchObject({ status: "quarantined", error: { code: "invalid_request" } });
  });
});

describe("S8 – idempotency (9.5)", () => {
  it("gate: the same id with the same body → the same result, no second FS call", async () => {
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const s = await seedApi();
    const sale = apiSale(s.unit.id);
    const one = await post(s.token, [sale]);
    const two = await post(s.token, [sale]);
    expect(two.json.results[0]).toEqual(one.json.results[0]);
    expect(fake.calls).toHaveLength(1);
  });

  it("gate: 10 parallel requests with the same id → exactly one sales row and one FS call", async () => {
    const fake = fakeTransports(async (c) => {
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-ff", test: true, receivedAt: new Date().toISOString(), messageUuid: c.ctx.messageUuid ?? crypto.randomUUID(), warnings: [] };
    });
    __setTransportFactoryForTests(fake.factory);
    const s = await seedApi();
    const sale = apiSale(s.unit.id);
    const all = await Promise.all(Array.from({ length: 10 }, () => post(s.token, [sale])));
    expect(all.every((r) => r.status === 200)).toBe(true);
    expect(await getDb().select().from(schema.sales)).toHaveLength(1);
    expect(fake.calls).toHaveLength(1);
    expect(new Set(all.map((r) => r.json.results[0].id)).size).toBe(1);
  });

  it("gate: the same id with a different body → 409 idempotency_conflict; another id with a used externalRef → 409 external_ref_conflict", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const sale = apiSale(s.unit.id);
    await post(s.token, [sale]);
    const changed = await post(s.token, [{ ...sale, payments: [{ method: "cash", amount: 320000 }] }]);
    expect(changed.status).toBe(409);
    expect(changed.json.error).toMatchObject({ code: "idempotency_conflict", field: "sales[0].id" });
    const ref = await post(s.token, [apiSale(s.unit.id, { externalRef: sale.externalRef })]);
    expect(ref.status).toBe(409);
    expect(ref.json.error.code).toBe("external_ref_conflict");
    expect(await getDb().select().from(schema.sales)).toHaveLength(1);
    // externalRef se dá najít
    const found = await call(salesGET, { path: `/api/v1/sales?externalRef=${encodeURIComponent(sale.externalRef)}`, token: s.token });
    expect(found.json.sales.map((x: { id: string }) => x.id)).toEqual([sale.id]);
  });
});

describe("S8 – automatic sequence", () => {
  it("gate: without a sequence the server assigns prefix + nextSequence, without gaps under parallel requests; the full number ≤ 25", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const sales = Array.from({ length: 20 }, () => apiSale(s.unit.id));
    await Promise.all(sales.map((x) => post(s.token, [x])));
    // opakování nepřidělí nové číslo
    await post(s.token, [sales[0]]);
    const device = (await getDb().query.devices.findFirst({ where: eq(schema.devices.id, s.integration.deviceId) }))!;
    const rows = await getDb().select().from(schema.sales);
    const numbers = rows.map((r) => {
      expect(r.sequence.startsWith(device.sequencePrefix)).toBe(true);
      expect(r.sequence.length).toBeLessThanOrEqual(25);
      return Number(r.sequence.slice(device.sequencePrefix.length));
    });
    expect(numbers.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect((await getDb().query.integrations.findFirst())!.nextSequence).toBe(21);
  });

  it("gate: a client sequence is used as is; longer than 25 → invalid", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const own = apiSale(s.unit.id, { sequence: "R-000123" });
    await post(s.token, [own]);
    expect((await getDb().query.sales.findFirst())!.sequence).toBe("R-000123");
    const long = await post(s.token, [apiSale(s.unit.id, { sequence: "R".repeat(26) })]);
    expect(long.json.results[0]).toMatchObject({ status: "quarantined", error: { code: "invalid_request" } });
  });
});

describe("S8 – what is evidenced", () => {
  it("gate: credit_topup → internal prepayment → urceno_cerp_zuct in the message", async () => {
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const s = await seedApi();
    const sale = apiSale(s.unit.id, { lines: [{ name: "Dobití hotelové karty", qty: 1, unitPrice: 100000, vatRate: 0, kind: "credit_topup" }], payments: [{ method: "cash", amount: 100000 }] });
    const r = await post(s.token, [sale]);
    expect(r.json.results[0].status).toBe("confirmed");
    const row = (await getDb().query.sales.findFirst())!;
    expect(row.items![0]!.kind).toBe("prepayment");
    expect(row.prepaymentAmount).toBe(100000);
    expect((row.eetData as Record<string, string>).urceno_cerp_zuct).toBe("1000.00");
    expect(fake.calls[0]!.ctx.snapshot!.urceno_cerp_zuct).toBe("1000.00");
  });

  it("gate: a transfer-only sale → not_evidenced, stored for reconciliation, never sent to FS", async () => {
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const s = await seedApi();
    const sale = apiSale(s.unit.id, { payments: [{ method: "transfer", amount: 320000 }] });
    const r = await post(s.token, [sale]);
    expect(r.json.results[0]).toMatchObject({ status: "not_evidenced", evidencedAmount: 0, notEvidencedAmount: 320000, pok: null });
    await processPending();
    expect(fake.calls).toHaveLength(0);
  });
});

describe("S8 – synchronous send budget 2.5 s", () => {
  it("gate: a slow FS → the request returns within the budget; the next sale stays queued for the cron", async () => {
    const fake = fakeTransports(async (c) => {
      await new Promise((r) => setTimeout(r, 3_000));
      return { ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-ff", test: true, receivedAt: new Date().toISOString(), messageUuid: c.ctx.messageUuid ?? crypto.randomUUID(), warnings: [] };
    });
    __setTransportFactoryForTests(fake.factory);
    const s = await seedApi();
    const a = apiSale(s.unit.id);
    const b = apiSale(s.unit.id);
    const started = Date.now();
    const r = await post(s.token, [a, b]);
    const took = Date.now() - started;
    expect(took).toBeLessThan(2_900);
    expect(took).toBeGreaterThanOrEqual(2_400);
    expect(r.json.results[0].status).toBe("sending");
    expect(r.json.results[1].status).toBe("queued");
    expect(fake.calls).toHaveLength(1);
    // první dojede na pozadí, druhou pošle cron
    await new Promise((res) => setTimeout(res, 800));
    await processPending();
    const later = await call(salesGET, { path: `/api/v1/sales?ids=${a.id},${b.id}`, token: s.token });
    expect(later.json.sales.map((x: { status: string }) => x.status)).toEqual(["confirmed", "confirmed"]);
  }, 20_000);
});

describe("S8 – GET /v1/sales", () => {
  it("gate: filters (status, unitId, since/until) and an opaque cursor; order soldAt desc, id", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const base = Math.floor(Date.now() / 1000) * 1000;
    const sales = Array.from({ length: 5 }, (_, i) => apiSale(s.unit.id, { soldAt: new Date(base - i * 60_000).toISOString() }));
    await post(s.token, sales);
    const p1 = await call(salesGET, { path: "/api/v1/sales?limit=2", token: s.token });
    expect(p1.json.sales.map((x: { id: string }) => x.id)).toEqual([sales[0]!.id, sales[1]!.id]);
    expect(typeof p1.json.nextCursor).toBe("string");
    const p2 = await call(salesGET, { path: `/api/v1/sales?limit=2&cursor=${p1.json.nextCursor}`, token: s.token });
    expect(p2.json.sales.map((x: { id: string }) => x.id)).toEqual([sales[2]!.id, sales[3]!.id]);
    const p3 = await call(salesGET, { path: `/api/v1/sales?limit=2&cursor=${p2.json.nextCursor}`, token: s.token });
    expect(p3.json.sales).toHaveLength(1);
    expect(p3.json.nextCursor).toBeNull();
    const since = await call(salesGET, { path: `/api/v1/sales?since=${encodeURIComponent(new Date(base - 90_000).toISOString())}`, token: s.token });
    expect(since.json.sales).toHaveLength(2);
    expect((await call(salesGET, { path: "/api/v1/sales?status=queued", token: s.token })).json.sales).toHaveLength(0);
    expect((await call(salesGET, { path: `/api/v1/sales?unitId=${s.unit.id}&status=confirmed`, token: s.token })).json.sales).toHaveLength(5);
    expect((await call(salesGET, { path: "/api/v1/sales?cursor=garbage", token: s.token })).status).toBe(400);
    expect((await call(salesGET, { path: "/api/v1/sales?limit=500", token: s.token })).status).toBe(400);
  });
});
