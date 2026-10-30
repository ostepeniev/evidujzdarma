/**
 * S8 rozd. 9.1–9.2 – izolace: cizí jednotka, cizí tržba, cizí externalRef → 404; jednotka mimo oprávnění → 404;
 * token integrace nevidí certifikát, personál, PIN, katalog, tržby pokladny ani jiných integrací.
 */
import { getDb, schema } from "@ez/db";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as accountGET } from "@/app/api/v1/account/route";
import { GET as unitsGET } from "@/app/api/v1/units/route";
import { GET as salesGET, POST as salesPOST } from "@/app/api/v1/sales/route";
import { GET as saleGET } from "@/app/api/v1/sales/[id]/route";
import { POST as refundPOST } from "@/app/api/v1/sales/[id]/refund/route";
import { GET as closingsGET } from "@/app/api/v1/closings/route";
import { __setTransportFactoryForTests } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { addUnit, apiSale, call, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  __setTransportFactoryForTests(fakeTransports().factory);
});
afterEach(() => __setTransportFactoryForTests(null));

describe("S8 – account isolation (9.2)", () => {
  it("gate: a foreign unitId, a foreign sale id and a foreign externalRef → 404, nothing stored", async () => {
    const a = await seedApi();
    const b = await seedApi();
    const bSale = apiSale(b.unit.id, { externalRef: "B-1" });
    expect((await call(salesPOST, { path: "/api/v1/sales", token: b.token, body: { sales: [bSale] } })).json.results[0].status).toBe("confirmed");

    const foreignUnit = await call(salesPOST, { path: "/api/v1/sales", token: a.token, body: { sales: [apiSale(a.unit.id), apiSale(b.unit.id)] } });
    expect(foreignUnit.status).toBe(404);
    expect(foreignUnit.json.error).toMatchObject({ code: "unit_not_found", field: "sales[1].unitId" });
    expect(await getDb().select().from(schema.sales)).toHaveLength(1);

    const foreignSale = await call(saleGET, { path: `/api/v1/sales/${bSale.id}`, token: a.token, params: { id: bSale.id } });
    expect(foreignSale.status).toBe(404);
    expect(foreignSale.json.error.code).toBe("sale_not_found");
    const foreignRefund = await call(refundPOST, { path: `/api/v1/sales/${bSale.id}/refund`, token: a.token, params: { id: bSale.id }, body: { id: crypto.randomUUID() } });
    expect(foreignRefund.status).toBe(404);
    const byRef = await call(salesGET, { path: "/api/v1/sales?externalRef=B-1", token: a.token });
    expect(byRef.status).toBe(200);
    expect(byRef.json.sales).toEqual([]);
    const byIds = await call(salesGET, { path: `/api/v1/sales?ids=${bSale.id}`, token: a.token });
    expect(byIds.json.sales).toEqual([]);
    // stejné id tržby z cizího účtu: konflikt identifikátoru, ne přepis
    const sameId = await call(salesPOST, { path: "/api/v1/sales", token: a.token, body: { sales: [{ ...bSale, unitId: a.unit.id }] } });
    expect([404, 409]).toContain(sameId.status);
    expect((await getDb().query.sales.findFirst({ where: (s, { eq }) => eq(s.id, bSale.id) }))!.accountId).toBe(b.account.id);
  });

  it("gate: a unit of the same account outside unitIds is 404 unit_not_found – not 403", async () => {
    const s = await seedApi();
    const other = await addUnit(s.account.id);
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(other.id)] } });
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe("unit_not_found");
    const units = await call(unitsGET, { path: "/api/v1/units", token: s.token });
    expect(units.json.units.map((u: { id: string }) => u.id)).toEqual([s.unit.id]);
    const cl = await call(closingsGET, { path: `/api/v1/closings?unitId=${other.id}`, token: s.token });
    expect(cl.status).toBe(404);
  });

  it("gate: an empty unitIds means no unit, not all", async () => {
    const s = await seedApi({ unitIds: [] });
    expect((await call(unitsGET, { path: "/api/v1/units", token: s.token })).json.units).toEqual([]);
    expect((await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } })).status).toBe(404);
  });
});

describe("S8 – what an integration token never sees (9.1)", () => {
  it("gate: no certificate, password, staff, PIN, catalog; no PWA sales and no sales of another integration", async () => {
    const s = await seedApi();
    await getDb().insert(schema.catalogItems).values({ accountId: s.account.id, name: "Tajná položka katalogu", price: 100 });
    // tržba z pokladny téhož účtu
    const pos = deviceSale(s.unit.id);
    await ingestSales(await deviceContext(s.device.id), [pos as never]);
    // druhá integrace téhož účtu
    const { createIntegration } = await import("@/lib/server/integrations");
    const other = await createIntegration(s.account.id, s.user.id, { name: "Jiný systém", environment: "test", scopes: ["sales:write", "sales:read"], unitIds: [s.unit.id] });
    const otherSale = apiSale(s.unit.id);
    await call(salesPOST, { path: "/api/v1/sales", token: other.token, body: { sales: [otherSale] } });
    const mine = apiSale(s.unit.id);
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [mine] } });

    const list = await call(salesGET, { path: "/api/v1/sales", token: s.token });
    expect(list.json.sales.map((x: { id: string }) => x.id)).toEqual([mine.id]);
    expect((await call(saleGET, { path: `/api/v1/sales/${pos.id}`, token: s.token, params: { id: pos.id } })).status).toBe(404);
    expect((await call(saleGET, { path: `/api/v1/sales/${otherSale.id}`, token: s.token, params: { id: otherSale.id } })).status).toBe(404);
    // vratka tržby z pokladny přes API nejde
    expect((await call(refundPOST, { path: `/api/v1/sales/${pos.id}/refund`, token: s.token, params: { id: pos.id }, body: { id: crypto.randomUUID() } })).status).toBe(404);

    const everything = JSON.stringify([
      (await call(accountGET, { path: "/api/v1/account", token: s.token })).json,
      (await call(unitsGET, { path: "/api/v1/units", token: s.token })).json,
      list.json,
      (await call(closingsGET, { path: "/api/v1/closings", token: s.token })).json,
    ]);
    for (const secret of ["BEGIN", "PRIVATE", "Jana", "Petra", "pinHash", "pin_hash", "Tajná položka", "tokenHash", "token_hash", "CZ12345679", "subject", "serialNumber"]) {
      expect(everything, secret).not.toContain(secret);
    }
  });
});
