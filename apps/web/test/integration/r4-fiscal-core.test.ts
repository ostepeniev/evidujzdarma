/**
 * R4 (A r2 Д-1) – tělo odpovědi FS se nedočte (timeout / reset po odeslání POST). FS zprávu nejspíš dostala:
 * pokus je síťová chyba s uuid zprávy v auditu, first_sent_at je nastavené a další pokus jde s prvni_zaslani=false.
 */
import { Eet2Transport } from "@ez/fiscal-core/server";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, processSale, storeCertificate } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

describe("Д-1 – the response body cannot be read after the POST", () => {
  it("gate: first_sent_at is set, the audit has the message uuid and the next attempt is prvni_zaslani=false", async () => {
    const s = await seedAccount({ mode: "playground" });
    const { cert } = testCert({ issuer: "EETv2 Playground CA" });
    await storeCertificate(s.account.id, cert, "playground");
    const firstFlags: string[] = [];
    const fetchBroken = (async (_url: string, init: RequestInit) => {
      firstFlags.push(/prvni_zaslani="(true|false)"/.exec(String(init.body))![1]!);
      return { status: 200, text: async () => Promise.reject(new Error("socket hang up")) } as unknown as Response;
    }) as unknown as typeof fetch;
    __setTransportFactoryForTests((_acc, mode) => new Eet2Transport({ environment: mode as "playground", credential: async () => cert, fetch: fetchBroken }));

    const sale = deviceSale(s.unit.id, { mode: "playground" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    await processSale(sale.id);

    let row = (await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) }))!;
    expect(row.status).toBe("queued");
    expect(row.firstSentAt).not.toBeNull();
    expect(row.lastError).toMatch(/^NETWORK/);
    const [a] = await getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, sale.id));
    expect(a).toMatchObject({ code: "NETWORK", httpStatus: 200, messageUuid: expect.stringMatching(/^[0-9a-f-]{36}$/) });

    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(schema.sales.id, sale.id));
    await processSale(sale.id);
    row = (await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) }))!;
    expect(firstFlags).toEqual(["true", "false"]);
  });
});
