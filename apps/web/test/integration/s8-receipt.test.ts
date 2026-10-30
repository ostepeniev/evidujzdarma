/**
 * S8 rozd. 4 – ReceiptFiscalV1: data pro doklad v cizím systému ze stejné funkce jako online účtenka (loadReceipt).
 * receiptUrl tržby z API nese klíč: id tržby volí PMS (nemusí být náhodné UUID v4), takže samo id není tajemství.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as salesPOST } from "@/app/api/v1/sales/route";
import { __setTransportFactoryForTests } from "@/lib/server/fiscal";
import { loadReceipt } from "@/lib/server/receipts";
import { ingestSales } from "@/lib/server/sales";
import { apiSale, call, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

describe("S8 – receipt data for a foreign system (4)", () => {
  it("gate: a confirmed sale carries ReceiptFiscalV1 – seller, unit, register, sequence, amounts, VAT, POK, mode", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    await getDb().update(schema.accounts).set({ vatPayer: true }).where(eq(schema.accounts.id, s.account.id));
    await getDb().update(schema.evidenceUnits).set({ address: "Lázeňská 1, Karlovy Vary" }).where(eq(schema.evidenceUnits.id, s.unit.id));
    const sale = apiSale(s.unit.id, { sequence: "R-000123" });
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [sale] } });
    const receipt = r.json.results[0].receipt;
    // odpověď odpovídá schématu z OpenAPI
    const { SaleStatusV1Schema } = await import("@/lib/server/api/openapi");
    expect(SaleStatusV1Schema.safeParse(r.json.results[0]).success).toBe(true);
    expect(receipt).toEqual({
      seller: { name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345679", address: "Lázeňská 1, Karlovy Vary" },
      unit: { fsUnitId: 303, label: "Salon" },
      registerId: "API-ALISIO",
      sequence: "R-000123",
      soldAt: new Date(sale.soldAt).toISOString(),
      total: 320000,
      evidencedAmount: 320000,
      vatBreakdown: { "12": { base: 285714, vat: 34286 } },
      pok: "11111111-2222-4333-8444-555555555555-ff",
      mode: "playground",
      offline: false,
    });
  });

  it("gate: without POK yet → offline: true and the note verbatim; a transfer-only sale is not 'offline'", async () => {
    __setTransportFactoryForTests(fakeTransports(() => ({ ok: false, retryable: true, code: "NETWORK", message: "FS nedostupná" })).factory);
    const s = await seedApi();
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id), apiSale(s.unit.id, { payments: [{ method: "transfer", amount: 320000 }] })] } });
    expect(r.json.results[0].receipt).toMatchObject({ pok: null, offline: true, note: "Tržba bude odeslána nejpozději do 48 hodin." });
    expect(r.json.results[0].receipt.vatBreakdown).toBeNull();
    expect(r.json.results[1].receipt.offline).toBe(false);
    expect(r.json.results[1].receipt.note).toBeUndefined();
  });

  it("gate: receiptUrl of an API sale needs its key; the public page without it is 404; PWA receipts are unchanged", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const sale = apiSale(s.unit.id);
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [sale] } });
    const url = new URL(r.json.results[0].receiptUrl);
    expect(url.pathname).toBe(`/u/${sale.id}`);
    const k = url.searchParams.get("k");
    expect(k).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(await loadReceipt(sale.id)).toBeNull();
    expect(await loadReceipt(sale.id, "wrong")).toBeNull();
    expect((await loadReceipt(sale.id, k!))!.sale.id).toBe(sale.id);
    const pos = deviceSale(s.unit.id, { mode: "playground" });
    await ingestSales(await deviceContext(s.device.id), [pos as never]);
    expect((await loadReceipt(pos.id))!.sale.id).toBe(pos.id);
    // stránka účtenky předá klíč z adresy
    const src = (await import("node:fs")).readFileSync(new URL("../../src/app/(app)/u/[id]/page.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/loadReceipt\(id, typeof k === "string" \? k : undefined\)/);
  });
});
