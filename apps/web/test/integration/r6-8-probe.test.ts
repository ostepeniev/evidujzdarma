/**
 * R6.8 (рецензія №3, A В-2) – zkušební tržba pojistky prostředí jen z tržeb, které můžou do FS opravdu odejít.
 *  - Probe nebere tržby s blokací (CERT_*, EIC_CERT_MISMATCH, PRODUCTION_NOT_OPEN …), jen bez ní nebo INVALID_RESPONSE.
 *  - Slot se bere až po úspěšném zabrání tržby; skončí-li pokus blokací (bez volání FS), slot se vrací.
 *  - Scénář S1: po obnově FS se pauza zruší na první tržbě, která do FS opravdu dojde.
 */
import type { SendResult } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, processPending, processSale } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const MIN = 60_000;
const HOUR = 3_600_000;
const invalid = (): SendResult => ({ ok: false, retryable: true, code: "INVALID_RESPONSE", message: "Podpis nesedí", messageUuid: crypto.randomUUID() });
const ok = (): SendResult => ({ ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-0a", test: false, receivedAt: new Date().toISOString(), messageUuid: crypto.randomUUID(), warnings: [] });
const breaker = () => getDb().select().from(schema.fsBreaker);
const sale = (id: string) => getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) });

/** Tři účty dostanou neověřitelnou odpověď → pojistka production zapnutá. */
async function tripBreaker(answer: { fn: () => SendResult }) {
  const fake = fakeTransports((call) => {
    void call;
    return answer.fn();
  });
  __setTransportFactoryForTests(fake.factory);
  const healthy: string[] = [];
  for (let i = 0; i < 3; i++) {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const x = deviceSale(s.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(s.device.id), [x as never]);
    healthy.push(x.id);
  }
  await processPending();
  expect(await breaker()).toHaveLength(1);
  return { fake, healthy };
}

/** Účet bez certifikátu (vypršel / vyměněný) – jeho tržba skončí blokací bez volání FS. */
async function certlessSale() {
  const b = await seedAccount({ mode: "production" });
  const x = deviceSale(b.unit.id, { mode: "production" });
  await ingestSales(await deviceContext(b.device.id), [x as never]);
  return x.id;
}

describe("R6.8 – the breaker probe only takes a sale that can reach FS", () => {
  it("gate S1: blocked sale oldest in the queue → exactly 1 transport call with a healthy sale, breaker cleared", async () => {
    const answer = { fn: invalid };
    const { fake, healthy } = await tripBreaker(answer);
    const blocked = await certlessSale();
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 2 * HOUR) }).where(eq(schema.sales.id, blocked));
    for (const id of healthy) await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - MIN) }).where(eq(schema.sales.id, id));
    await getDb().update(schema.fsBreaker).set({ probeAt: new Date(Date.now() - 1000) });
    answer.fn = ok; // FS je zase v pořádku
    const before = fake.calls.length;
    await processPending();
    const calls = fake.calls.slice(before);
    expect(calls).toHaveLength(1);
    expect(healthy).toContain(calls[0]!.sale.id);
    expect(await breaker()).toHaveLength(0);
    expect(await sale(blocked)).toMatchObject({ status: "queued", blockedReason: "CERT_MISSING" });
  });

  it("a sale already blocked (CERT_*, EIC_CERT_MISMATCH, PRODUCTION_NOT_OPEN) is never picked as the probe", async () => {
    const answer = { fn: invalid };
    const { fake, healthy } = await tripBreaker(answer);
    // zdravé tržby čekají na backoff; ve frontě je jen zablokovaná tržba
    for (const id of healthy) await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() + HOUR) }).where(eq(schema.sales.id, id));
    const blocked = await certlessSale();
    for (const code of ["CERT_EXPIRED", "EIC_CERT_MISMATCH", "PRODUCTION_NOT_OPEN"]) {
      await getDb().update(schema.sales).set({ blockedReason: code, nextAttemptAt: new Date(Date.now() - HOUR) }).where(eq(schema.sales.id, blocked));
      await getDb().update(schema.fsBreaker).set({ probeAt: new Date(Date.now() - 1000) });
      const attempts = (await sale(blocked))!.attempts;
      const before = fake.calls.length;
      await processPending();
      expect(fake.calls.length - before).toBe(0);
      expect((await sale(blocked))!.attempts, code).toBe(attempts);
      // slot zůstal volný pro první tržbu, která odejít může
      expect((await breaker())[0]!.probeAt.getTime(), code).toBeLessThanOrEqual(Date.now());
    }
  });

  it("an INVALID_RESPONSE-marked sale is still a valid probe", async () => {
    const answer = { fn: invalid };
    const { fake, healthy } = await tripBreaker(answer);
    await getDb().update(schema.sales).set({ blockedReason: "INVALID_RESPONSE", nextAttemptAt: new Date(Date.now() - MIN) }).where(eq(schema.sales.id, healthy[0]!));
    await getDb().update(schema.fsBreaker).set({ probeAt: new Date(Date.now() - 1000) });
    answer.fn = ok;
    const before = fake.calls.length;
    await processPending();
    expect(fake.calls.slice(before).map((c) => c.sale.id)).toEqual([healthy[0]]);
    expect(await breaker()).toHaveLength(0);
  });

  it("the slot is not spent when the claim fails (backoff still running)", async () => {
    const answer = { fn: invalid };
    const { healthy } = await tripBreaker(answer);
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() + HOUR) }).where(eq(schema.sales.id, healthy[0]!));
    const due = new Date(Date.now() - 1000);
    await getDb().update(schema.fsBreaker).set({ probeAt: due });
    await processSale(healthy[0]!);
    expect((await breaker())[0]!.probeAt.getTime()).toBe(due.getTime());
    expect(await sale(healthy[0]!)).toMatchObject({ status: "queued" });
  });

  it("a probe that ends blocked returns the slot; a probe that reached FS keeps it for an hour", async () => {
    const answer = { fn: invalid };
    const { healthy } = await tripBreaker(answer);
    const blocked = await certlessSale();
    await getDb().update(schema.fsBreaker).set({ probeAt: new Date(Date.now() - 1000) });
    await processSale(blocked);
    expect(await sale(blocked)).toMatchObject({ blockedReason: "CERT_MISSING" });
    expect((await breaker())[0]!.probeAt.getTime()).toBeLessThanOrEqual(Date.now());
    // skutečný pokus (FS pořád neověřitelná) slot spotřebuje
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - MIN) }).where(eq(schema.sales.id, healthy[0]!));
    await processSale(healthy[0]!);
    expect((await breaker())[0]!.probeAt.getTime()).toBeGreaterThan(Date.now() + 50 * MIN);
  });
});
