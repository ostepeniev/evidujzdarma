/**
 * R5.9 – prostředí pokladního certifikátu podle Policy OID (produkce 3.1.2: 1.2.203.19122063.10.1.102.x.y,
 * Playground 3.1.5: 1.2.203.19122063.10.4.102.x.y), ne podle slova „playground“ ve vydavateli. Neznámý OID → odmítnout.
 * Produkce přijímá tržby od 1. 11. 2026 (přechodný režim, produkce v1.1, 4.1): dřívější produkční tržba → karanténa.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/server/auth";
import { importCertificate } from "@/lib/server/certificates";
import { storeCertificate } from "@/lib/server/fiscal";
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
afterEach(() => vi.useRealTimers());

const PROD_OID = "1.2.203.19122063.10.1.102.1.1";
const PG_OID = "1.2.203.19122063.10.4.102.1.1";
const status = (p: Promise<unknown>) => p.then(() => 200).catch((e: unknown) => (e instanceof HttpError ? e.status : 500));

describe("R5.9 – certificate environment by policy OID", () => {
  it("gate: the policy OID decides, not the issuer name", async () => {
    const s = await seedAccount();
    const prod = await importCertificate(s.account.id, { file: testCert({ issuer: "EETv2 NCA SubCA Playground-like name", policyOid: PROD_OID }).p12, password: "x" });
    expect(prod.environment).toBe("production");
    const pg = await importCertificate(s.account.id, { file: testCert({ issuer: "EETv2 NCA SubCA RSA 2026", policyOid: PG_OID }).p12, password: "x" });
    expect(pg.environment).toBe("playground");
  });

  it("a certificate without a known EET 2.0 policy OID is refused", async () => {
    const s = await seedAccount();
    expect(await status(importCertificate(s.account.id, { file: testCert({ issuer: "EETv2 NCA SubCA RSA 2026", policyOid: null }).p12, password: "x" }))).toBe(400);
    expect(await status(importCertificate(s.account.id, { file: testCert({ issuer: "EETv2 NCA SubCA RSA 2026", policyOid: "1.2.203.19122063.10.9.999.1" }).p12, password: "x" }))).toBe(400);
  });
});

describe("R5.9 – production accepts sales from 1. 11. 2026", () => {
  const saved = process.env.EET_PRODUCTION_ACCEPTS_FROM;
  beforeEach(() => {
    delete process.env.EET_PRODUCTION_ACCEPTS_FROM; // skutečné datum FS, ne testovací výchozí
  });
  afterEach(() => {
    process.env.EET_PRODUCTION_ACCEPTS_FROM = saved;
  });

  it("a production sale dated before 1. 11. 2026 goes to quarantine with an explanation", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T23:30:00+01:00"));
    const s = await seedAccount({ mode: "production" });
    await storeCertificate(s.account.id, testCert().cert, "production");
    const sale = deviceSale(s.unit.id, { mode: "production", soldAt: new Date("2026-10-31T23:20:00+01:00").toISOString() });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "PRODUCTION_NOT_OPEN" });
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) })).toBeUndefined();
  });

  it("from 1. 11. 2026 (transitional regime) production sales are accepted", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T00:40:00+01:00"));
    const s = await seedAccount({ mode: "production" });
    await storeCertificate(s.account.id, testCert().cert, "production");
    const sale = deviceSale(s.unit.id, { mode: "production", soldAt: new Date("2026-11-01T00:30:00+01:00").toISOString() });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r!.ok).toBe(true);
  });
});
