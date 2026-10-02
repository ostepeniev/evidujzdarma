/**
 * R4 – výměna pokladního certifikátu (A r2 Д-4, Д-6; A r1 Дрібне 3).
 *  - Д-4: nejvýš jeden aktivní certifikát na účet a prostředí (částečný unikátní index); tržba, která se
 *    zablokovala kvůli certifikátu právě během jeho výměny, nečeká hodinu.
 *  - Д-6: výměna certifikátu v už zapnutém ostrém provozu vyžaduje nové ověření (overeni), než obslouží ostré tržby.
 *  - Дрібне 3: šifrovaný klíč je vázaný i na prostředí – nejde ho přesunout do řádku jiného prostředí.
 */
import type { SendResult } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyEnvironment } from "@/lib/server/certificates";
import { __setTransportFactoryForTests, forgetCredential, loadCredential, processSale, storeCertificate } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const row = (id: string) => getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) });
const activeCerts = (accountId: string, env: string) =>
  getDb().select().from(schema.certificates).where(and(eq(schema.certificates.accountId, accountId), eq(schema.certificates.environment, env), isNull(schema.certificates.revokedAt)));

describe("Д-4 – one active certificate per account and environment", () => {
  it("gate: the database refuses a second active certificate of the same environment", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert({ issuer: "EETv2 Playground CA" }).cert, "playground");
    const [a] = await activeCerts(s.account.id, "playground");
    const { id: _id, createdAt: _c, ...copy } = a!;
    await expect(getDb().insert(schema.certificates).values({ ...copy, serialNumber: "02" })).rejects.toThrow();
    // revokovaný řádek index neomezuje
    await expect(getDb().insert(schema.certificates).values({ ...copy, serialNumber: "03", revokedAt: new Date() })).resolves.toBeTruthy();
  });

  it("two imports at the same time leave exactly one active certificate", async () => {
    const s = await seedAccount({ mode: "playground" });
    const cert = () => testCert({ issuer: "EETv2 Playground CA" }).cert;
    await Promise.all([storeCertificate(s.account.id, cert(), "playground"), storeCertificate(s.account.id, cert(), "playground")]);
    expect(await activeCerts(s.account.id, "playground")).toHaveLength(1);
  });

  it("gate: a sale blocked by the certificate while it was being replaced is sent again at once, not in an hour", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert({ issuer: "EETv2 Playground CA" }).cert, "playground");
    const sale = deviceSale(s.unit.id, { mode: "playground" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    __setTransportFactoryForTests(() => ({
      name: "fake-playground",
      async send() {
        // vlastník právě nahrává nový certifikát; tento pokus ještě narazil na starý klíč
        await storeCertificate(s.account.id, testCert({ issuer: "EETv2 Playground CA" }).cert, "playground");
        return { ok: false, retryable: true, blocked: "PREPARE", code: "PREPARE", message: "klíč nejde použít" } as SendResult;
      },
    }));
    await processSale(sale.id);
    const r = (await row(sale.id))!;
    expect(r.status).toBe("queued");
    expect(r.blockedReason).toBeNull();
    expect(r.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("Д-6 – a replaced production certificate must be verified again", () => {
  it("gate: until overeni succeeds, production sales wait (blocked), then they go out", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeCertificate(s.account.id, testCert().cert, "production");
    await getDb().update(schema.certificates).set({ verifiedAt: new Date() }).where(eq(schema.certificates.accountId, s.account.id));
    // výměna certifikátu v ostrém provozu (nový, zatím neověřený)
    await storeCertificate(s.account.id, testCert().cert, "production");
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    await processSale(sale.id);
    expect(await row(sale.id)).toMatchObject({ status: "queued", blockedReason: "CERT_NOT_VERIFIED" });
    expect(fake.calls).toHaveLength(0);

    const v = await verifyEnvironment(s.account.id, s.unit.id, "production");
    expect(v.ok).toBe(true);
    expect((await row(sale.id))!.blockedReason).toBeNull();
    await processSale(sale.id);
    expect((await row(sale.id))!.status).toBe("confirmed");
    expect(fake.calls.filter((c) => !c.ctx.verifyOnly)).toHaveLength(1);
  });

  it("Playground does not require the verification", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert({ issuer: "EETv2 Playground CA" }).cert, "playground");
    __setTransportFactoryForTests(fakeTransports().factory);
    const sale = deviceSale(s.unit.id, { mode: "playground" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    await processSale(sale.id);
    expect((await row(sale.id))!.status).toBe("confirmed");
  });
});

describe("Дрібне 3 – the sealed key is bound to its environment", () => {
  it("gate: a ciphertext moved from the Playground row into the production row does not decrypt", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert({ issuer: "EETv2 Playground CA" }).cert, "playground");
    await storeCertificate(s.account.id, testCert().cert, "production");
    const [pg] = await activeCerts(s.account.id, "playground");
    const [prod] = await activeCerts(s.account.id, "production");
    await getDb().update(schema.certificates).set({ encryptedKey: pg!.encryptedKey, encryptedDek: pg!.encryptedDek, keyVersion: pg!.keyVersion }).where(eq(schema.certificates.id, prod!.id));
    forgetCredential(s.account.id);
    await expect(loadCredential(s.account.id, "production")).rejects.toThrow();
    await expect(loadCredential(s.account.id, "playground")).resolves.toBeTruthy();
  });
});
