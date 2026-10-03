/**
 * R6.10 (рецензія №3, A Д-1) – „Odeslat s opravenými údaji“ (rebuild snímku) jen tehdy, když žádný pokus
 * aktuálního snímku neskončil nejistě (NETWORK, HTTP_*, INVALID_RESPONSE, in_flight, stale, Chyba 8).
 * Takový pokus mohla FS zapsat – nová identita tržby (jiné id_jednotky / eic_popl) by pak znamenala druhou tržbu ve FS.
 * prvni_zaslani po rebuildu zůstává false (konzervativně).
 */
import type { SendResult } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, correctableSales, processSale, rebuildSnapshots } from "@/lib/server/fiscal";
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

const uuid = () => crypto.randomUUID();
const ok = (): SendResult => ({ ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-0a", test: false, receivedAt: new Date().toISOString(), messageUuid: uuid(), warnings: [] });
const chyba4 = (): SendResult => ({ ok: false, retryable: false, errorClass: "permanent", code: "EET_4", message: "Chybný podpis", messageUuid: uuid() });

/** Tržba s danými odpověďmi FS; poslední je určité odmítnutí. Pak vlastník změní číslo jednotky. */
async function rejectedAfter(answers: SendResult[], before?: (saleId: string) => Promise<void>) {
  const s = await seedAccount({ mode: "production" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  const script = [...answers, chyba4()];
  const fake = fakeTransports((_c, n) => script[n - 1] ?? ok());
  __setTransportFactoryForTests(fake.factory);
  const sale = deviceSale(s.unit.id, { mode: "production" });
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  if (before) await before(sale.id);
  for (let i = 0; i < script.length; i++) {
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 1000), blockedReason: null }).where(eq(schema.sales.id, sale.id));
    await processSale(sale.id);
  }
  expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) }))!.status).toBe("rejected");
  await getDb().update(schema.evidenceUnits).set({ fsUnitId: 304 }).where(eq(schema.evidenceUnits.id, s.unit.id));
  return { s, sale, fake };
}

describe("R6.10 – rebuild only without an indeterminate attempt of the current snapshot", () => {
  it("gate S4: NETWORK timeout, then Chyba 4 → rebuild refused", async () => {
    const { s, sale } = await rejectedAfter([{ ok: false, retryable: true, code: "NETWORK", message: "timeout", messageUuid: uuid() }]);
    const r = await rebuildSnapshots(s.account.id, [sale.id]);
    expect(r.rebuilt).toEqual([]);
    expect(r.skipped[0]!.reason).toMatch(/nejist|mohla zapsat/i);
  });

  it.each([
    ["HTTP_503", { ok: false, retryable: true, code: "HTTP_503", message: "Service Unavailable", messageUuid: uuid() }],
    ["INVALID_RESPONSE", { ok: false, retryable: true, code: "INVALID_RESPONSE", message: "Podpis nesedí", messageUuid: uuid() }],
    ["EET_8", { ok: false, retryable: true, errorClass: "ambiguous", code: "EET_8", message: "Chyba 8", messageUuid: uuid() }],
  ] as [string, SendResult][])("%s earlier in the same snapshot → refused", async (_name, answer) => {
    const { s, sale } = await rejectedAfter([answer]);
    expect((await rebuildSnapshots(s.account.id, [sale.id])).rebuilt).toEqual([]);
  });

  it.each(["in_flight", "stale"])("a %s attempt row → refused", async (result) => {
    const { s, sale } = await rejectedAfter([], async (saleId) => {
      await getDb().insert(schema.saleAttempts).values({ saleId, attempt: 0, environment: "production", firstAttempt: true, startedAt: new Date(Date.now() - 60_000), result, messageUuid: uuid() });
    });
    expect((await rebuildSnapshots(s.account.id, [sale.id])).rebuilt).toEqual([]);
  });

  it("control: only a definite refusal → rebuilt; the next send keeps prvni_zaslani = false", async () => {
    const { s, sale, fake } = await rejectedAfter([]);
    expect((await rebuildSnapshots(s.account.id, [sale.id])).rebuilt).toEqual([sale.id]);
    await processSale(sale.id);
    const last = fake.calls.at(-1)!;
    expect(last.ctx.firstAttempt).toBe(false);
    expect(last.ctx.snapshot?.id_jednotky).toBe(304);
  });

  it("attempts of an earlier snapshot (before a previous rebuild) do not count", async () => {
    const { s, sale } = await rejectedAfter([]);
    // starší snímek měl nejistý pokus, ale ten patří před předchozí rebuild
    await getDb().insert(schema.saleAttempts).values({ saleId: sale.id, attempt: 0, environment: "production", firstAttempt: true, startedAt: new Date(Date.now() - 3_600_000), result: "retry", code: "NETWORK" });
    await getDb().insert(schema.saleAttempts).values({ saleId: sale.id, attempt: 0, environment: "production", firstAttempt: false, startedAt: new Date(Date.now() - 1_800_000), result: "rebuilt", code: "SNAPSHOT_REBUILT" });
    expect((await rebuildSnapshots(s.account.id, [sale.id])).rebuilt).toEqual([sale.id]);
  });

  it("the 'Odeslat s opravenými údaji' button is offered only where rebuild is allowed", async () => {
    const a = await rejectedAfter([{ ok: false, retryable: true, code: "NETWORK", message: "timeout", messageUuid: uuid() }]);
    const b = await rejectedAfter([]);
    const set = await correctableSales([a.sale.id, b.sale.id]);
    expect([...set]).toEqual([b.sale.id]);
  });
});
