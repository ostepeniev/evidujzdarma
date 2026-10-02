/**
 * R5.4 – neověřitelné odpovědi (INVALID_RESPONSE) nezastaví tržbu na 365 dní. Místo toho backoff do 6 h
 * a pojistka na celé prostředí: ≥ 3 INVALID od ≥ 3 účtů za 10 min → odesílání v prostředí stojí, jeden alert;
 * provozovatel vrátí tržby do fronty přes requeueInvalid(env) (internal endpoint pod CRON_SECRET).
 * Opakování je bezpečné: FS tržbu ztotožní podle šesti polí (Popis v1.2, kap. 4).
 */
import type { SendResult } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { and, eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as requeueRoute } from "@/app/api/internal/fs-requeue/route";
import { __setTransportFactoryForTests, processPending, storeCertificate } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { SITE } from "@/lib/site";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  process.env.CRON_SECRET = "c".repeat(32);
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const invalid = (): SendResult => ({ ok: false, retryable: true, code: "INVALID_RESPONSE", message: "Podpis nesedí", messageUuid: crypto.randomUUID() });
const ok = (): SendResult => ({ ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-0a", test: false, receivedAt: new Date().toISOString(), messageUuid: crypto.randomUUID(), warnings: [] });

async function saleIn(mode: "production" | "playground") {
  const s = await seedAccount({ mode });
  await storeCertificate(s.account.id, testCert(mode === "playground" ? { issuer: "EET CA 1 Playground" } : {}).cert, mode);
  const sale = deviceSale(s.unit.id, { mode });
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  return sale.id;
}
const allDue = () => getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(schema.sales.status, "queued"));
const breakerAlerts = () => getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, SITE.email), like(schema.emailOutbox.dedupeKey, "fs-breaker:%")));
const requeue = (environment: string, secret = process.env.CRON_SECRET) =>
  requeueRoute(new Request("http://localhost/api/internal/fs-requeue", { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ environment }) }));

describe("R5.4 – environment circuit breaker", () => {
  it("gate: INVALID from 3 accounts pauses production; the transport is no longer called, one alert", async () => {
    let answer: (mode: string) => SendResult = () => invalid();
    const fake = fakeTransports((c) => answer(c.mode));
    __setTransportFactoryForTests(fake.factory);
    for (let i = 0; i < 3; i++) await saleIn("production");
    await processPending();
    expect(fake.calls).toHaveLength(3);

    await saleIn("production"); // nová tržba po vypnutí
    await allDue();
    await processPending();
    expect(fake.calls).toHaveLength(3);
    expect(await breakerAlerts()).toHaveLength(1);

    // jiné prostředí běží dál
    answer = (mode) => (mode === "playground" ? ok() : invalid());
    const pg = await saleIn("playground");
    await processPending();
    expect(fake.calls.map((c) => c.sale.id)).toContain(pg);
    expect(fake.calls.filter((c) => c.mode === "production")).toHaveLength(3);
  });

  it("requeueInvalid('production') resumes sending and each sale goes out exactly once", async () => {
    let answer = invalid;
    const fake = fakeTransports(() => answer());
    __setTransportFactoryForTests(fake.factory);
    const ids = [await saleIn("production"), await saleIn("production"), await saleIn("production")];
    await processPending();
    ids.push(await saleIn("production"));
    expect((await requeue("production", "wrong")).status).toBe(401);

    answer = ok;
    const before = fake.calls.length;
    const res = await requeue("production");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ environment: "production", resumed: true });
    await processPending();
    await allDue();
    await processPending();
    const after = fake.calls.slice(before).map((c) => c.sale.id);
    expect(after.sort()).toEqual([...ids].sort());
    for (const id of ids) expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) }))!.status).toBe("confirmed");
  });

  it("a single sale with INVALID is backed off at most 6 h, never parked for a year", async () => {
    const fake = fakeTransports(() => invalid());
    __setTransportFactoryForTests(fake.factory);
    const id = await saleIn("production");
    for (let i = 0; i < 6; i++) {
      await allDue();
      await processPending();
    }
    const row = (await getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) }))!;
    expect(row.status).toBe("queued");
    expect(row.blockedReason).toBe("INVALID_RESPONSE");
    expect(row.nextAttemptAt.getTime() - Date.now()).toBeLessThanOrEqual(6 * 3_600_000 + 5_000);
    expect(fake.calls).toHaveLength(6); // jeden účet pojistku nespustí
  });

  it("after the probe interval exactly one sale probes; a confirmed probe closes the breaker", async () => {
    let answer = invalid;
    const fake = fakeTransports(() => answer());
    __setTransportFactoryForTests(fake.factory);
    for (let i = 0; i < 3; i++) await saleIn("production");
    await processPending();
    await saleIn("production");
    await allDue();
    await getDb().update(schema.fsBreaker).set({ probeAt: new Date(Date.now() - 1000) });
    answer = ok;
    const before = fake.calls.length;
    await processPending();
    expect(fake.calls.length - before).toBe(1);
    expect(await getDb().select().from(schema.fsBreaker)).toHaveLength(0);
    await allDue();
    await processPending();
    expect(fake.calls.length - before).toBe(4);
  });
});
