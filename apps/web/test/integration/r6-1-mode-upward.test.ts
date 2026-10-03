/**
 * R6.1 (рецензія №3, A В-1) – „Odeslat v aktuálním režimu“ jen směrem nahoru: mock → playground/production,
 * playground → production. Tržba prodaná v ostrém režimu nesmí skončit v simulaci s falešným POK (Р3).
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/server/auth";
import { __setTransportFactoryForTests, processPending } from "@/lib/server/fiscal";
import { canSendInMode, resolveQuarantine } from "@/lib/server/quarantine";
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
const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString();

async function mismatch(soldMode: "mock" | "playground" | "production", accountNow: "mock" | "playground" | "production") {
  const s = await seedAccount({ mode: soldMode });
  if (soldMode !== "mock") await storeVerifiedCertificate(s.account.id, testCert(soldMode === "playground" ? { issuer: "EETv2 Playground CA" } : {}).cert, soldMode);
  const t0 = Date.now() - 5 * MIN;
  await getDb().update(schema.accounts).set({ eetMode: accountNow, eetModeChangedAt: new Date(t0) }).where(eq(schema.accounts.id, s.account.id));
  const sale = deviceSale(s.unit.id, { mode: soldMode, soldAt: iso(t0 + MIN) });
  const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
  expect(r).toMatchObject({ quarantined: true, code: "MODE_MISMATCH" });
  return { s, sale };
}

describe("R6.1 – send in the current mode only upward", () => {
  it("gate S2: production sale, account switched to mock → 400, no mock call, no mock row", async () => {
    const { s, sale } = await mismatch("production", "mock");
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const err = await resolveQuarantine(s.account.id, sale.id, { action: "send_current_mode" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    expect((err as Error).message).toBe("Tržbu prodanou v ostrém režimu nelze odeslat v testovacím. Přepněte účet zpět, nebo ji vyřiďte ručně.");
    await processPending();
    expect(fake.calls.filter((c) => c.mode === "mock")).toHaveLength(0);
    expect(await getDb().select().from(schema.sales).where(eq(schema.sales.mode, "mock"))).toHaveLength(0);
    // karanténa zůstává otevřená – tržba se neztratí
    expect((await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, sale.id) }))!.resolvedAt).toBeNull();
  });

  it("production → playground is refused too", async () => {
    const { s, sale } = await mismatch("production", "playground");
    const err = (await resolveQuarantine(s.account.id, sale.id, { action: "send_current_mode" }).catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(400);
  });

  it("upward (mock sale, account now production) still works", async () => {
    const { s, sale } = await mismatch("mock", "production");
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const r = await resolveQuarantine(s.account.id, sale.id, { action: "send_current_mode" });
    expect(r.ok).toBe(true);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) }))!.mode).toBe("production");
  });

  it("the rule itself: only up", () => {
    expect(canSendInMode("mock", "playground")).toBe(true);
    expect(canSendInMode("mock", "production")).toBe(true);
    expect(canSendInMode("playground", "production")).toBe(true);
    expect(canSendInMode("playground", "mock")).toBe(false);
    expect(canSendInMode("production", "playground")).toBe(false);
    expect(canSendInMode("production", "mock")).toBe(false);
  });
});
