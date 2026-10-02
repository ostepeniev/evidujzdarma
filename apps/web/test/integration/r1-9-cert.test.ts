/**
 * R1.9 – import certifikátu je fail-closed. Gate: testovací certifikát jako „Ostrý“ → 400.
 */
import { getDb, schema } from "@ez/db";
import type { SendResult } from "@ez/fiscal-core";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setEetMode } from "@/lib/server/account";
import { HttpError } from "@/lib/server/auth";
import { importCertificate, verifyEnvironment } from "@/lib/server/certificates";
import { __setTransportFactoryForTests } from "@/lib/server/fiscal";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const PLAYGROUND_CA = "EET CA 1 Playground";
const PROD_CA = "EET CA 1";

async function status(p: Promise<unknown>): Promise<number | "ok"> {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
}
const activeCerts = (accountId: string) =>
  getDb().select().from(schema.certificates).where(and(eq(schema.certificates.accountId, accountId), isNull(schema.certificates.revokedAt)));

describe("R1.9 – certificate import", () => {
  it("gate: a Playground certificate uploaded as 'Ostrý' is a 400 and nothing is stored", async () => {
    const s = await seedAccount();
    const { p12 } = testCert({ issuer: PLAYGROUND_CA });
    expect(await status(importCertificate(s.account.id, { file: p12, password: "x", expected: "production" }))).toBe(400);
    expect(await activeCerts(s.account.id)).toHaveLength(0);
  });

  it("the environment comes from the issuer, not from the form", async () => {
    const s = await seedAccount();
    const pg = await importCertificate(s.account.id, { file: testCert({ issuer: PLAYGROUND_CA }).p12, password: "x" });
    expect(pg.environment).toBe("playground");
    const prod = await importCertificate(s.account.id, { file: testCert({ issuer: PROD_CA }).p12, password: "x" });
    expect(prod.environment).toBe("production");
    expect(await status(importCertificate(s.account.id, { file: testCert({ issuer: PROD_CA }).p12, password: "x", expected: "playground" }))).toBe(400);
  });

  it("fails closed without an EIČ in the certificate, and on a not-yet-valid certificate", async () => {
    const s = await seedAccount();
    expect(await status(importCertificate(s.account.id, { file: testCert({ eic: "Pokladna bez DIC", issuer: PROD_CA }).p12, password: "x" }))).toBe(400);
    const future = testCert({ issuer: PROD_CA, notBefore: new Date(Date.now() + 2 * 3_600_000), notAfter: new Date(Date.now() + 400 * 86_400_000) });
    expect(await status(importCertificate(s.account.id, { file: future.p12, password: "x" }))).toBe(400);
    expect(await activeCerts(s.account.id)).toHaveLength(0);
  });

  it("an account without EIČ takes it from the certificate in the same transaction", async () => {
    const s = await seedAccount({ eic: null });
    await getDb().update(schema.accounts).set({ dic: null }).where(eq(schema.accounts.id, s.account.id));
    await importCertificate(s.account.id, { file: testCert({ eic: "CZ87654321", issuer: PROD_CA }).p12, password: "x" });
    expect((await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) }))!.eic).toBe("CZ87654321");
  });

  it("switching to production requires a successful verification (overeni) of the production certificate", async () => {
    const s = await seedAccount();
    await importCertificate(s.account.id, { file: testCert({ issuer: PROD_CA }).p12, password: "x" });
    expect(await status(setEetMode(s.account.id, "production"))).toBe(400);

    const fail = fakeTransports(() => ({ ok: false, retryable: false, code: "EET_6", message: "Neplatný podpis" }));
    __setTransportFactoryForTests(fail.factory);
    expect((await verifyEnvironment(s.account.id, s.unit.id, "production")).ok).toBe(false);
    expect(await status(setEetMode(s.account.id, "production"))).toBe(400);

    const ok = fakeTransports((): SendResult => ({ ok: true, confirmationCode: null, test: false, receivedAt: new Date().toISOString(), messageUuid: crypto.randomUUID(), warnings: [] }));
    __setTransportFactoryForTests(ok.factory);
    expect((await verifyEnvironment(s.account.id, s.unit.id, "production")).ok).toBe(true);
    expect(ok.calls[0]!.ctx.verifyOnly).toBe(true);
    expect(ok.calls[0]!.mode).toBe("production");
    expect(await status(setEetMode(s.account.id, "production"))).toBe("ok");

    // nový certifikát = nové ověření
    await importCertificate(s.account.id, { file: testCert({ issuer: PROD_CA }).p12, password: "x" });
    await setEetMode(s.account.id, "mock", { confirm: true });
    expect(await status(setEetMode(s.account.id, "production", { confirm: true }))).toBe(400);
  });
});
