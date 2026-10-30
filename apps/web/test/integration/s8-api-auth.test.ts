/**
 * S8 rozd. 2, 9.1, 9.4, 9.6, 9.9 (docs/tasks/2026-10-30-S8-partner-api.md) – token integrace:
 * PWA ↔ API nezaměnitelné, oprávnění, odvolání, zrušený účet, limit 120/min, X-Request-Id, prostředí z tokenu.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as accountGET } from "@/app/api/v1/account/route";
import { GET as unitsGET } from "@/app/api/v1/units/route";
import { GET as salesGET, POST as salesPOST } from "@/app/api/v1/sales/route";
import { POST as posSalesPOST } from "@/app/api/pokladna/sales/route";
import { GET as posConfigGET } from "@/app/api/pokladna/config/route";
import { __setTransportFactoryForTests, processPending } from "@/lib/server/fiscal";
import { apiSale, call, posToken, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceSale } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

describe("S8 – token format and storage", () => {
  it("gate: ezk_test_/ezk_live_ + 40 base62; only sha256 and a 12-char prefix are stored", async () => {
    const s = await seedApi();
    expect(s.token).toMatch(/^ezk_test_[0-9A-Za-z]{40}$/);
    const { sha256 } = await import("@/lib/server/tokens");
    const device = await getDb().query.devices.findFirst({ where: eq(schema.devices.id, s.integration.deviceId) });
    expect(device).toMatchObject({ kind: "integration", tokenHash: sha256(s.token), unitId: null });
    expect(s.integration.tokenPrefix).toBe(s.token.slice(0, 12));
    const rows = JSON.stringify(await getDb().select().from(schema.integrations));
    expect(rows).not.toContain(s.token);
  });

  it("gate: a live token needs a production account with a valid production certificate", async () => {
    const s = await seedApi();
    const { createIntegration } = await import("@/lib/server/integrations");
    await expect(createIntegration(s.account.id, s.user.id, { name: "Ostrá", environment: "live", scopes: ["sales:write"], unitIds: [s.unit.id] })).rejects.toThrow(/produkční certifikát/);
    const live = await seedApi({ environment: "live" });
    expect(live.token).toMatch(/^ezk_live_[0-9A-Za-z]{40}$/);
  });
});

describe("S8 – PWA and API tokens are not interchangeable", () => {
  it("gate: a PWA token on /api/v1 → 401; an integration token on /api/pokladna → 401", async () => {
    const s = await seedApi();
    const pos = await posToken(s.device.id);
    const r1 = await call(accountGET, { path: "/api/v1/account", token: pos });
    expect(r1.status).toBe(401);
    expect(r1.json.error.code).toBe("invalid_token");
    const r2 = await posSalesPOST(new Request("http://localhost/api/pokladna/sales", { method: "POST", headers: { authorization: `Bearer ${s.token}`, "content-type": "application/json" }, body: JSON.stringify({ sales: [deviceSale(s.unit.id)] }) }));
    expect(r2.status).toBe(401);
    const r3 = await posConfigGET(new Request("http://localhost/api/pokladna/config", { headers: { authorization: `Bearer ${s.token}` } }));
    expect(r3.status).toBe(401);
    // a pokladna funguje dál
    const ok = await posSalesPOST(new Request("http://localhost/api/pokladna/sales", { method: "POST", headers: { authorization: `Bearer ${pos}`, "content-type": "application/json" }, body: JSON.stringify({ sales: [deviceSale(s.unit.id)] }) }));
    expect(ok.status).toBe(200);
  });

  it("gate: no token / a wrong token → 401 invalid_token with the shared error format and X-Request-Id", async () => {
    const r = await call(accountGET, { path: "/api/v1/account", token: "ezk_test_" + "x".repeat(40) });
    expect(r.status).toBe(401);
    expect(r.json.error).toMatchObject({ code: "invalid_token" });
    expect(r.json.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.headers.get("x-request-id")).toBe(r.json.error.requestId);
    expect((await call(accountGET, { path: "/api/v1/account" })).status).toBe(401);
  });
});

describe("S8 – scopes", () => {
  it("gate: every route checks its scope (403 insufficient_scope); /v1/account works with any scope", async () => {
    const s = await seedApi({ scopes: ["sales:read"] });
    const units = await call(unitsGET, { path: "/api/v1/units", token: s.token });
    expect(units.status).toBe(403);
    expect(units.json.error.code).toBe("insufficient_scope");
    const post = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    expect(post.status).toBe(403);
    expect((await call(salesGET, { path: "/api/v1/sales", token: s.token })).status).toBe(200);
    const acc = await call(accountGET, { path: "/api/v1/account", token: s.token });
    expect(acc.status).toBe(200);
    expect(acc.json).toMatchObject({ environment: "test", eetMode: "playground", eicMasked: "CZ••••5679", integration: { name: "ALiSiO", scopes: ["sales:read"], unitIds: [s.unit.id] } });
    expect(acc.json.certificate).toMatchObject({ status: "valid" });
    expect(JSON.stringify(acc.json)).not.toContain("12345679");
  });
});

describe("S8 – the environment comes from the token", () => {
  it("gate: test → playground sale, live → production sale; mode in the body is ignored", async () => {
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const test = await seedApi();
    const r = await call(salesPOST, { path: "/api/v1/sales", token: test.token, body: { sales: [apiSale(test.unit.id, { mode: "production" })] } });
    expect(r.status).toBe(200);
    const row = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, r.json.results[0].id) });
    expect(row).toMatchObject({ mode: "playground", integrationId: test.integration.id });
    const live = await seedApi({ environment: "live" });
    const r2 = await call(salesPOST, { path: "/api/v1/sales", token: live.token, body: { sales: [apiSale(live.unit.id)] } });
    const row2 = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, r2.json.results[0].id) });
    expect(row2!.mode).toBe("production");
    expect(fake.calls.map((c) => c.mode).sort()).toEqual(["playground", "production"]);
  });

  it("gate: a test token keeps working when the account switches to production (no MODE_MISMATCH quarantine)", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    await getDb().update(schema.accounts).set({ eetMode: "production", eetModeChangedAt: new Date(Date.now() - 60_000) }).where(eq(schema.accounts.id, s.account.id));
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    expect(r.json.results[0]).toMatchObject({ status: "confirmed" });
    expect(await getDb().select().from(schema.saleQuarantine)).toHaveLength(0);
  });
});

describe("S8 – revocation (9.4)", () => {
  it("gate: revoked → 401 token_revoked on the next request; sales already accepted are still sent by the cron", async () => {
    const fake = fakeTransports(() => ({ ok: false, retryable: true, code: "NETWORK", message: "FS nedostupná" }));
    __setTransportFactoryForTests(fake.factory);
    const s = await seedApi();
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    expect(r.json.results[0].status).toBe("queued");
    const { revokeIntegration } = await import("@/lib/server/integrations");
    await revokeIntegration(s.account.id, s.integration.id);
    const after = await call(accountGET, { path: "/api/v1/account", token: s.token });
    expect(after.status).toBe(401);
    expect(after.json.error.code).toBe("token_revoked");
    __setTransportFactoryForTests(fakeTransports().factory);
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date() });
    await processPending();
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, r.json.results[0].id) }))!.status).toBe("confirmed");
  });
});

describe("S8 – closed account (9.9, R5.8)", () => {
  it("gate: new sales → 403 account_closed; reading works for 30 days, then 401", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const first = apiSale(s.unit.id);
    expect((await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [first] } })).status).toBe(200);
    await getDb().update(schema.accounts).set({ closedAt: new Date(Date.now() - 86_400_000) }).where(eq(schema.accounts.id, s.account.id));
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("account_closed");
    // opakované odeslání už přijaté tržby je dovezení, ne nová tržba
    expect((await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [first] } })).status).toBe(200);
    expect((await call(salesGET, { path: "/api/v1/sales", token: s.token })).status).toBe(200);
    await getDb().update(schema.accounts).set({ closedAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(schema.accounts.id, s.account.id));
    expect((await call(salesGET, { path: "/api/v1/sales", token: s.token })).status).toBe(401);
  });
});

describe("S8 – limits (9.6)", () => {
  it("gate: 120 requests/min per token, then 429 rate_limited with Retry-After and RateLimit-* headers", async () => {
    const s = await seedApi();
    // okno limitu je minutové (pevné): 120 požadavků nesmí přejít přes hranici minuty (R-S8.1)
    const sec = new Date().getSeconds();
    if (sec > 45) await new Promise((r) => setTimeout(r, (61 - sec) * 1000));
    let last;
    for (let i = 0; i < 120; i++) {
      last = await call(accountGET, { path: "/api/v1/account", token: s.token });
      expect(last.status, `request ${i + 1}`).toBe(200);
    }
    expect(last!.headers.get("ratelimit-limit")).toBe("120");
    expect(last!.headers.get("ratelimit-remaining")).toBe("0");
    const over = await call(accountGET, { path: "/api/v1/account", token: s.token });
    expect(over.status).toBe(429);
    expect(over.json.error.code).toBe("rate_limited");
    expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(over.headers.get("retry-after"))).toBeLessThanOrEqual(60);
    expect(over.headers.get("ratelimit-reset")).toBeTruthy();
  }, 60_000);

  it("gate: more than 100 sales → 400 invalid_request; a body over 1 MB → 413 payload_too_large", async () => {
    const s = await seedApi();
    const many = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: Array.from({ length: 101 }, () => apiSale(s.unit.id)) } });
    expect(many.status).toBe(400);
    expect(many.json.error).toMatchObject({ code: "invalid_request", field: "sales" });
    const big = await call(salesPOST, { path: "/api/v1/sales", token: s.token, rawBody: JSON.stringify({ sales: [apiSale(s.unit.id)], pad: "x".repeat(1_100_000) }) });
    expect(big.status).toBe(413);
    expect(big.json.error.code).toBe("payload_too_large");
    const bad = await call(salesPOST, { path: "/api/v1/sales", token: s.token, rawBody: "{not json" });
    expect(bad.status).toBe(400);
  });

  it("gate: every request is logged in api_requests without bodies (route template, status, request id) and counted per day", async () => {
    const s = await seedApi();
    const r = await call(accountGET, { path: "/api/v1/account", token: s.token });
    const logs = await getDb().select().from(schema.apiRequests);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ integrationId: s.integration.id, method: "GET", route: "/v1/account", status: 200, requestId: r.headers.get("x-request-id") });
    const usage = await getDb().select().from(schema.apiUsageDaily);
    expect(usage[0]).toMatchObject({ integrationId: s.integration.id, requests: 1 });
  });
});

describe("S8 – retention of the request log", () => {
  it("gate: runRetention deletes api_requests older than 30 days and rate windows older than an hour", async () => {
    const s = await seedApi();
    await call(accountGET, { path: "/api/v1/account", token: s.token });
    const db = getDb();
    await db.insert(schema.apiRequests).values({ integrationId: s.integration.id, at: new Date(Date.now() - 31 * 86_400_000), method: "GET", route: "/v1/account", status: 200, durationMs: 1, requestId: crypto.randomUUID() });
    await db.insert(schema.apiRateWindows).values({ integrationId: s.integration.id, windowStart: new Date(Date.now() - 2 * 3_600_000), count: 5 });
    const { runRetention } = await import("@/lib/server/lifecycle");
    const out = await runRetention();
    expect(out).toMatchObject({ apiRequests: 1, apiRateWindows: 1 });
    expect(await db.select().from(schema.apiRequests)).toHaveLength(1);
    expect(await db.select().from(schema.apiRateWindows)).toHaveLength(1);
  });
});
