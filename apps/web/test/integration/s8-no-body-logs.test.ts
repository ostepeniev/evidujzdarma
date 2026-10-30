/**
 * S8 rozd. 9.3 (R3.6) – v logu nejsou těla požadavků ani odpovědí, tokeny ani EIČ. Test zachytí console.* při průchodu
 * všemi routami /api/v1 včetně chybových cest (neplatné JSON, chyba transportu, odmítnutí FS, karanténa).
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as accountGET } from "@/app/api/v1/account/route";
import { GET as unitsGET } from "@/app/api/v1/units/route";
import { GET as salesGET, POST as salesPOST } from "@/app/api/v1/sales/route";
import { GET as saleGET } from "@/app/api/v1/sales/[id]/route";
import { POST as refundPOST } from "@/app/api/v1/sales/[id]/refund/route";
import { GET as closingsGET } from "@/app/api/v1/closings/route";
import { __setTransportFactoryForTests } from "@/lib/server/fiscal";
import { apiSale, call, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => {
  __setTransportFactoryForTests(null);
  vi.restoreAllMocks();
});

describe("S8 – no bodies, tokens or EIČ in logs (9.3)", () => {
  it("gate: console.* during all /api/v1 routes contains no token, EIČ, line names, externalRef or response bodies", async () => {
    const s = await seedApi();
    const logged: string[] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        logged.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message} ${a.stack}` : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      });
    }
    let n = 0;
    __setTransportFactoryForTests(
      fakeTransports((c) => {
        n++;
        if (n === 1) throw new Error(`transport selhal pro ${c.sale.lines[0]!.name}`);
        if (n === 2) return { ok: false, retryable: false, code: "EET_4", message: "Neplatný podpis", errorClass: "permanent" } as never;
        return { ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-ff", test: true, receivedAt: new Date().toISOString(), messageUuid: crypto.randomUUID(), warnings: [] };
      }).factory,
    );
    const secretLine = "Tajný host Novák pokoj 12";
    const sales = [
      apiSale(s.unit.id, { externalRef: "REF-SECRET-1", lines: [{ name: secretLine, qty: 1, unitPrice: 1000, vatRate: 12 }], payments: [{ method: "cash", amount: 1000 }] }),
      apiSale(s.unit.id, { externalRef: "REF-SECRET-2", lines: [{ name: secretLine, qty: 1, unitPrice: 1000, vatRate: 12 }], payments: [{ method: "cash", amount: 1000 }] }),
      apiSale(s.unit.id, { externalRef: "REF-SECRET-3", lines: [{ name: secretLine, qty: 1, unitPrice: 1000, vatRate: 12 }], payments: [{ method: "cash", amount: 1000 }] }),
      apiSale(s.unit.id, { externalRef: "REF-SECRET-4", lines: [] }),
    ];
    const responses: string[] = [];
    const keep = (r: { json: unknown }) => responses.push(JSON.stringify(r.json));
    keep(await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales } }));
    keep(await call(salesPOST, { path: "/api/v1/sales", token: s.token, rawBody: `{"sales": [${JSON.stringify(sales[0])}` }));
    keep(await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [{ ...sales[2], tip: 5 }] } }));
    keep(await call(salesGET, { path: "/api/v1/sales", token: s.token }));
    keep(await call(saleGET, { path: `/api/v1/sales/${sales[2]!.id}`, token: s.token, params: { id: sales[2]!.id } }));
    keep(await call(refundPOST, { path: `/api/v1/sales/${sales[2]!.id}/refund`, token: s.token, params: { id: sales[2]!.id }, body: { id: crypto.randomUUID(), externalRef: "REF-SECRET-5" } }));
    keep(await call(accountGET, { path: "/api/v1/account", token: s.token }));
    keep(await call(unitsGET, { path: "/api/v1/units", token: s.token }));
    keep(await call(closingsGET, { path: "/api/v1/closings", token: s.token }));
    keep(await call(accountGET, { path: "/api/v1/account", token: s.token.slice(0, -1) + "Z" }));
    // DB výpadek uprostřed požadavku
    const spy = vi.spyOn(getDb(), "select").mockImplementationOnce(() => {
      throw Object.assign(new Error(`select … params: ${s.token} ${secretLine}`), { cause: { code: "57P01" } });
    });
    keep(await call(salesGET, { path: "/api/v1/sales", token: s.token }));
    spy.mockRestore();

    const out = logged.join("\n");
    for (const secret of [s.token, s.token.slice(9), "CZ12345679", "12345679", secretLine, "REF-SECRET", "Ubytování", ...responses.filter((r) => r.length > 40).map((r) => r.slice(0, 60))]) {
      expect(out, `log contains ${secret.slice(0, 20)}`).not.toContain(secret);
    }
    // sanity: chyby se logují (jen druh), takže test opravdu něco zachytil
    expect(logged.length).toBeGreaterThan(0);
    expect(await getDb().select().from(schema.apiRequests).where(eq(schema.apiRequests.integrationId, s.integration.id))).not.toHaveLength(0);
  });
});
