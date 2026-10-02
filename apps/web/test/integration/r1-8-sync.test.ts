/**
 * R1.8 – synchronizace pokladny neobchází backoff. Gate: dvě karty + 500 tržeb ve frontě:
 * počet požadavků na FS = počet tržeb × počet pokusů podle backoffu.
 */
import { randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/pokladna/sales/route";
import { __setTransportFactoryForTests, processPending, storeCertificate } from "@/lib/server/fiscal";
import { sha256 } from "@/lib/server/tokens";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

describe("R1.8 – POS sync never bypasses backoff", () => {
  it("two tabs re-posting 500 queued sales: FS requests = sales × backoff attempts", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert().cert, "playground");
    const token = randomBytes(32).toString("base64url");
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    const fake = fakeTransports(() => ({ ok: false, retryable: true, code: "NETWORK", message: "FS nedostupná" }));
    __setTransportFactoryForTests(fake.factory);

    const sales = Array.from({ length: 500 }, () => deviceSale(s.unit.id, { mode: "playground" }));
    const post = (batch: unknown[]) =>
      POST(new Request("http://localhost/api/pokladna/sales", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ sales: batch }) }));
    const tab = async () => {
      for (let i = 0; i < sales.length; i += 100) {
        const res = await post(sales.slice(i, i + 100));
        expect(res.status).toBe(200);
      }
    };
    const perSale = () => {
      const m = new Map<string, number>();
      for (const c of fake.calls) m.set(c.sale.id, (m.get(c.sale.id) ?? 0) + 1);
      return m;
    };
    // obě karty synchronizují zároveň a pak znovu (tik každých 20 s): každá tržba nejvýš jeden pokus
    await Promise.all([tab(), tab()]);
    const afterFirst = fake.calls.length;
    expect(afterFirst).toBeLessThanOrEqual(500);
    expect(Math.max(...perSale().values())).toBe(1);
    await Promise.all([tab(), tab()]);
    await tab();
    expect(fake.calls.length).toBe(afterFirst);

    // cron dořeší zbytek prvního kola a pošle znovu jen tržby s uplynulým backoffem
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() + 3_600_000) }).where(eq(schema.sales.accountId, s.account.id));
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date() }).where(eq(schema.sales.attempts, 0));
    await processPending(1000);
    expect(fake.calls.length).toBe(500);
    await processPending(1000); // backoff neuplynul → nic
    expect(fake.calls.length).toBe(500);
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date() }).where(eq(schema.sales.accountId, s.account.id));
    await processPending(1000);
    await Promise.all([tab(), tab()]);
    expect(fake.calls.length).toBe(1000);
    const attempts = await getDb().select({ id: schema.sales.id, attempts: schema.sales.attempts }).from(schema.sales).where(eq(schema.sales.accountId, s.account.id));
    const m = perSale();
    for (const a of attempts) expect(m.get(a.id)).toBe(a.attempts);
  }, 120_000);
});
