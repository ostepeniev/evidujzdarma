/**
 * R5.1 – pokladna se starou konfigurací po přepnutí účtu do production nesmí tiše prodávat „mock“.
 * Tržba v jiném režimu, než má účet, prodaná PO přepnutí → karanténa MODE_MISMATCH, nic do FS.
 * Tržby prodané PŘED přepnutím zůstávají ve svém režimu (T8/T9).
 */
import { randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as salesGet, POST as salesPost } from "@/app/api/pokladna/sales/route";
import { __setTransportFactoryForTests, processPending } from "@/lib/server/fiscal";
import { resolveQuarantine } from "@/lib/server/quarantine";
import { ingestSales } from "@/lib/server/sales";
import { sha256 } from "@/lib/server/tokens";
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

/** Účet přepnutý z mock do production v čase t0 (5 min zpět). */
async function switchedToProduction() {
  const s = await seedAccount({ mode: "mock" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  const t0 = Date.now() - 5 * MIN;
  await getDb().update(schema.accounts).set({ eetMode: "production", eetModeChangedAt: new Date(t0) }).where(eq(schema.accounts.id, s.account.id));
  return { s, t0 };
}

describe("R5.1 – MODE_MISMATCH", () => {
  it("gate: switched to production at t0, a 'mock' sale sold at t0+1 min is quarantined and never reaches any transport", async () => {
    const { s, t0 } = await switchedToProduction();
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "mock", soldAt: iso(t0 + MIN) });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "MODE_MISMATCH", retryable: false });
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) })).toBeUndefined();
    await processPending();
    expect(fake.calls).toHaveLength(0);
  });

  it("a sale sold before the switch keeps its own mode (T9 stays intact)", async () => {
    const { s, t0 } = await switchedToProduction();
    const sale = deviceSale(s.unit.id, { mode: "mock", soldAt: iso(t0 - MIN) });
    const [r] = await ingestSales(await deviceContext(s.device.id), [sale as never]);
    expect(r!.ok).toBe(true);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) }))!.mode).toBe("mock");
  });

  it("setEetMode records the moment of the switch", async () => {
    const s = await seedAccount({ mode: "production" });
    const before = Date.now();
    const { setEetMode } = await import("@/lib/server/account");
    await setEetMode(s.account.id, "mock", { confirm: true });
    const acc = await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) });
    expect(acc!.eetMode).toBe("mock");
    expect(acc!.eetModeChangedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("owner: 'odeslat v aktuálním režimu' sends it as production; 'byla to zkouška' keeps it out of FS", async () => {
    const { s, t0 } = await switchedToProduction();
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const ctx = await deviceContext(s.device.id);
    const real = deviceSale(s.unit.id, { mode: "mock", soldAt: iso(t0 + MIN) });
    const test = deviceSale(s.unit.id, { mode: "mock", soldAt: iso(t0 + 2 * MIN) });
    await ingestSales(ctx, [real, test] as never);

    expect((await resolveQuarantine(s.account.id, real.id, { action: "send_current_mode" })).ok).toBe(true);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, real.id) }))!.mode).toBe("production");
    await processPending();
    expect(fake.calls.map((c) => [c.sale.id, c.mode])).toEqual([[real.id, "production"]]);

    expect((await resolveQuarantine(s.account.id, test.id, { action: "was_test" })).ok).toBe(true);
    const q = await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, test.id) });
    expect(q).toMatchObject({ resolution: "dismissed" });
    expect(q!.note).toMatch(/zkouš/i);
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, test.id) })).toBeUndefined();
  });

  it("POST and GET /api/pokladna/sales tell the device the account's current mode", async () => {
    const { s } = await switchedToProduction();
    const token = randomBytes(32).toString("base64url");
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    __setTransportFactoryForTests(fakeTransports().factory);
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const sale = deviceSale(s.unit.id, { mode: "production" });
    const post = (await (await salesPost(new Request("http://localhost/api/pokladna/sales", { method: "POST", headers, body: JSON.stringify({ sales: [sale] }) }))).json()) as { accountMode?: string };
    expect(post.accountMode).toBe("production");
    const get = (await (await salesGet(new Request(`http://localhost/api/pokladna/sales?ids=${sale.id}`, { headers }))).json()) as { accountMode?: string };
    expect(get.accountMode).toBe("production");
  });
});
