/**
 * R1.3 / R1.4 / R1.5 – fronta odesílání. Gate: T3 (souběh zabrání), T4 (prošlý certifikát →
 * nový certifikát → potvrzeno) a opakování ze snímku po změně EIČ.
 */
import { getDb, schema } from "@ez/db";
import type { SendResult } from "@ez/fiscal-core";
import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, processPending, processSale, requeueSales, salesNeedingAttention, storeCertificate } from "@/lib/server/fiscal";
import { AccountInput, upsertAccount } from "@/lib/server/account";
import { runReminders } from "@/lib/server/reminders";
import { ingestSales } from "@/lib/server/sales";
import { SITE } from "@/lib/site";
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

const POK = "11111111-2222-4333-8444-555555555555-0a";
const ok = (uuid?: string): SendResult => ({ ok: true, confirmationCode: POK, test: false, receivedAt: new Date().toISOString(), messageUuid: uuid ?? crypto.randomUUID(), warnings: [] });
const getSale = (id: string) => getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) });

async function productionSale(accountMode: "production" | "playground" = "production") {
  const s = await seedAccount({ mode: accountMode });
  await storeCertificate(s.account.id, testCert().cert, accountMode);
  const sale = deviceSale(s.unit.id, { mode: accountMode });
  const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
  expect(r!.ok).toBe(true);
  return { s, sale };
}

describe("R1.3 – blocked sales stay queued and recover", () => {
  it("T4: an expired certificate blocks (not rejects) the sale; a new certificate gets it confirmed", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeCertificate(s.account.id, testCert({ notBefore: new Date(Date.now() - 400 * 86_400_000), notAfter: new Date(Date.now() - 86_400_000) }).cert, "production");
    const fake = fakeTransports(() => ok());
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);

    await processSale(sale.id);
    const blocked = await getSale(sale.id);
    expect(blocked!.status).toBe("queued");
    expect(blocked!.blockedReason).toBe("CERT_EXPIRED");
    expect(fake.calls).toHaveLength(0);

    await storeCertificate(s.account.id, testCert().cert, "production");
    const { processed } = await processPending();
    expect(processed).toBe(1);
    const done = await getSale(sale.id);
    expect(done!.status).toBe("confirmed");
    expect(done!.blockedReason).toBeNull();
  });

  it("an undecryptable key (wrong MASTER_KEY) blocks with PREPARE and nothing reaches the network", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert().cert, "playground");
    const sale = deviceSale(s.unit.id, { mode: "playground" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    const original = process.env.MASTER_KEY;
    process.env.MASTER_KEY = Buffer.alloc(32, 9).toString("base64");
    try {
      await processSale(sale.id); // skutečný Eet2Transport – klíč nejde dešifrovat dřív, než by šel požadavek ven
    } finally {
      process.env.MASTER_KEY = original;
    }
    const row = await getSale(sale.id);
    expect(row!.status).toBe("queued");
    expect(row!.blockedReason).toBe("PREPARE");
    const [a] = await getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, sale.id));
    expect(a!.result).toBe("blocked");
    expect(a!.messageUuid).toBeNull();
  });

  it("a permanently rejected sale is visible and the owner can requeue it", async () => {
    const { s, sale } = await productionSale();
    let n = 0;
    const fake = fakeTransports(() => (++n === 1 ? { ok: false, retryable: false, code: "EET_3", message: "Chybná struktura" } : ok()));
    __setTransportFactoryForTests(fake.factory);
    await processSale(sale.id);
    expect((await getSale(sale.id))!.status).toBe("rejected");
    expect(await requeueSales(s.account.id, [sale.id])).toBe(1);
    await processPending();
    expect((await getSale(sale.id))!.status).toBe("confirmed");
  });
});

describe("R1.3 – blocked by account data", () => {
  it("a sale without EIČ is blocked; fixing EIČ requeues it and the owner gets one reminder a day", async () => {
    const s = await seedAccount({ mode: "production", eic: null });
    await getDb().update(schema.accounts).set({ dic: null }).where(eq(schema.accounts.id, s.account.id));
    await storeCertificate(s.account.id, testCert().cert, "production");
    const fake = fakeTransports(() => ok());
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    await processSale(sale.id);
    expect((await getSale(sale.id))!.blockedReason).toBe("EIC_MISSING");
    expect(fake.calls).toHaveLength(0);
    expect((await salesNeedingAttention(s.account.id)).map((r) => r.id)).toEqual([sale.id]);

    expect(await runReminders()).toBeGreaterThan(0);
    await runReminders();
    const mails = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, s.user.email));
    expect(mails.filter((m) => m.dedupeKey?.startsWith("attention:"))).toHaveLength(1);

    const user = { id: s.user.id, email: s.user.email, name: null, memberships: [{ accountId: s.account.id, role: "owner" as const, accountName: "x", accountKind: "business" }] };
    await upsertAccount(user, AccountInput.parse({ name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345679" }));
    expect((await getSale(sale.id))!.blockedReason).toBeNull();
    await processPending();
    expect((await getSale(sale.id))!.status).toBe("confirmed");
  });
});

describe("R1.8 – unverifiable responses", () => {
  it("three INVALID_RESPONSE in a row stop the sale and alert the operator", async () => {
    const { sale } = await productionSale();
    const fake = fakeTransports(() => ({ ok: false, retryable: true, code: "INVALID_RESPONSE", message: "Podpis nesedí" }));
    __setTransportFactoryForTests(fake.factory);
    for (let i = 0; i < 3; i++) {
      await getDb().update(schema.sales).set({ nextAttemptAt: new Date() }).where(eq(schema.sales.id, sale.id));
      await processPending();
    }
    const row = await getSale(sale.id);
    expect(row!.status).toBe("queued");
    expect(row!.blockedReason).toBe("INVALID_RESPONSE");
    const attempts = await getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, sale.id));
    expect(attempts.map((a) => a.result)).toEqual(["invalid", "invalid", "invalid"]);
    const alerts = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, SITE.email));
    expect(alerts.some((m) => m.dedupeKey?.startsWith("invalid-response:"))).toBe(true);
    // zastavená tržba se dál neodesílá
    await processPending();
    expect(fake.calls).toHaveLength(3);
  });
});

describe("R1.4 – claim token", () => {
  it("T3: a stalled worker cannot overwrite a sale another worker confirmed", async () => {
    const { sale } = await productionSale();
    let releaseA!: (r: SendResult) => void;
    const fake = fakeTransports((_call, n) => (n === 1 ? new Promise<SendResult>((res) => (releaseA = res)) : ok()));
    __setTransportFactoryForTests(fake.factory);

    const a = processSale(sale.id); // worker A zabere tržbu a „zamrzne“
    for (let i = 0; i < 50 && !releaseA; i++) await new Promise((r) => setTimeout(r, 10));
    // A visí déle než 2 minuty
    await getDb().update(schema.sales).set({ sentAt: new Date(Date.now() - 3 * 60_000) }).where(eq(schema.sales.id, sale.id));
    await processPending(); // worker B tržbu převezme a potvrdí
    expect((await getSale(sale.id))!.status).toBe("confirmed");

    releaseA({ ok: false, retryable: true, code: "NETWORK", message: "timeout" });
    await a;
    const after = await getSale(sale.id);
    expect(after!.status).toBe("confirmed");
    expect(after!.confirmationCode).toBe(POK);
  });
});

describe("R1.5 – snapshot and audit", () => {
  it("a retry after an EIČ change sends the same data and every attempt is audited", async () => {
    const { s, sale } = await productionSale();
    let n = 0;
    const fake = fakeTransports(() => (++n === 1 ? { ok: false, retryable: true, code: "NETWORK", message: "timeout" } : ok()));
    __setTransportFactoryForTests(fake.factory);
    await processSale(sale.id);
    await getDb().update(schema.accounts).set({ eic: "CZ87654321", dic: "CZ87654321" }).where(eq(schema.accounts.id, s.account.id));
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date() }).where(eq(schema.sales.id, sale.id));
    await processPending();

    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]!.ctx.snapshot).toBeDefined();
    expect(fake.calls[1]!.ctx.snapshot).toEqual(fake.calls[0]!.ctx.snapshot);
    expect(fake.calls[1]!.ctx.snapshot!.eic_popl).toBe("CZ12345679");
    expect(fake.calls[1]!.ctx.firstAttempt).toBe(false);

    const attempts = await getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, sale.id)).orderBy(asc(schema.saleAttempts.attempt));
    expect(attempts.map((a) => a.result)).toEqual(["retry", "confirmed"]);
    expect(attempts[1]!.pok).toBe(POK);
  });
});
