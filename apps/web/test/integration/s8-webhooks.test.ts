/**
 * S8 rozd. 8, 9.7 – webhooky: outbox (webhook_deliveries), podpis EZ-Signature, opakování 1 min … 24 h, vypnutí po 3 dnech
 * neúspěchů + e-mail vlastníkovi, SSRF (jen https, žádné privátní adresy ani po DNS, bez přesměrování), deadline_soon
 * jednou na tržbu, certificate.expiring 31/14/3 dní, integration.revoked, CRUD /v1/webhooks a testovací událost.
 */
import { createHmac } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as salesPOST } from "@/app/api/v1/sales/route";
import { GET as hooksGET, POST as hooksPOST } from "@/app/api/v1/webhooks/route";
import { DELETE as hookDELETE } from "@/app/api/v1/webhooks/[id]/route";
import { POST as hookTestPOST } from "@/app/api/v1/webhooks/[id]/test/route";
import { __setTransportFactoryForTests } from "@/lib/server/fiscal";
import { __setWebhookNetForTests, deliverWebhooks, scanWebhookEvents } from "@/lib/server/webhooks";
import { verifyWebhookSignature } from "@/lib/webhook-signature";
import { apiSale, call, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());

type Sent = { url: string; headers: Record<string, string>; body: string };
let sent: Sent[] = [];
let reply: (s: Sent) => number = () => 200;
let dns: Record<string, string[]> = {};
beforeEach(async () => {
  await t.reset();
  sent = [];
  reply = () => 200;
  dns = { "hooks.alisio.example": ["203.0.113.10"], "evil.example": ["10.0.0.5"], "rebind.example": ["203.0.113.11"] };
  __setWebhookNetForTests({
    resolve: async (host) => dns[host] ?? [],
    send: async (req) => {
      sent.push(req);
      return { status: reply(req) };
    },
  });
});
afterEach(() => {
  __setTransportFactoryForTests(null);
  __setWebhookNetForTests(null);
});

const URL_OK = "https://hooks.alisio.example/eet";
const register = (token: string, body: unknown) => call(hooksPOST, { path: "/api/v1/webhooks", token, body });
const deliveries = () => getDb().select().from(schema.webhookDeliveries);

describe("S8 – webhook endpoints (CRUD, 9.7 SSRF)", () => {
  it("gate: webhooks:manage creates an https endpoint and gets the secret once; list without secret; delete", async () => {
    const s = await seedApi();
    const r = await register(s.token, { url: URL_OK, events: ["sale.confirmed", "sale.rejected"] });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ url: URL_OK, events: ["sale.confirmed", "sale.rejected"], active: true });
    expect(r.json.secret).toMatch(/^whsec_[0-9A-Za-z]{32,}$/);
    const row = (await getDb().select().from(schema.webhookEndpoints))[0]!;
    expect(JSON.stringify(row)).not.toContain(r.json.secret);
    const list = await call(hooksGET, { path: "/api/v1/webhooks", token: s.token });
    expect(list.json.webhooks).toHaveLength(1);
    expect(JSON.stringify(list.json)).not.toContain("whsec_");
    expect((await call(hookDELETE, { method: "DELETE", path: `/api/v1/webhooks/${r.json.id}`, token: s.token, params: { id: r.json.id } })).status).toBe(200);
    expect((await call(hooksGET, { path: "/api/v1/webhooks", token: s.token })).json.webhooks).toHaveLength(0);
    const noScope = await seedApi({ scopes: ["sales:write"] });
    expect((await register(noScope.token, { url: URL_OK })).status).toBe(403);
  });

  it("gate: only https; private, loopback, link-local, metadata addresses refused – also after DNS", async () => {
    const s = await seedApi();
    for (const url of ["http://hooks.alisio.example/eet", "https://127.0.0.1/x", "https://10.1.2.3/x", "https://169.254.169.254/latest", "https://[::1]/x", "https://[fd00:ec2::254]/x", "https://192.168.1.10/x", "https://evil.example/x", "https://localhost/x", "https://user:pw@hooks.alisio.example/x"]) {
      const r = await register(s.token, { url });
      expect(r.status, url).toBe(400);
      expect(r.json.error.code, url).toBe("invalid_request");
      expect(r.json.error.field, url).toBe("url");
    }
    expect(await getDb().select().from(schema.webhookEndpoints)).toHaveLength(0);
  });

  it("gate: DNS rebinding – at delivery the address is resolved again; a private answer is not called", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    await register(s.token, { url: "https://rebind.example/hook" });
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    dns["rebind.example"] = ["127.0.0.1"];
    await deliverWebhooks(new Date());
    expect(sent).toHaveLength(0);
    const [d] = await deliveries();
    expect(d).toMatchObject({ status: "pending", attempts: 1 });
    expect(d!.lastError).toMatch(/blocked address/);
  });

  it("gate: redirects are not followed (3xx = failure)", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    await register(s.token, { url: URL_OK });
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    reply = () => 302;
    await deliverWebhooks(new Date());
    expect(sent).toHaveLength(1);
    expect((await deliveries())[0]).toMatchObject({ status: "pending", lastHttpStatus: 302 });
  });
});

describe("S8 – events, signature and delivery (8)", () => {
  it("gate: sale.confirmed is an outbox row (no HTTP inside the sale transaction), signed EZ-Signature t=…,v1=hmac(secret, t.body)", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const { json: hook } = await register(s.token, { url: URL_OK });
    const sale = apiSale(s.unit.id);
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [sale] } });
    expect(sent).toHaveLength(0);
    const [d] = await deliveries();
    expect(d).toMatchObject({ event: "sale.confirmed", status: "pending" });
    await deliverWebhooks(new Date());
    expect(sent).toHaveLength(1);
    const req = sent[0]!;
    const body = JSON.parse(req.body);
    expect(body).toMatchObject({ id: d!.id, type: "sale.confirmed", data: { id: sale.id, status: "confirmed" } });
    expect(Date.parse(body.createdAt)).not.toBeNaN();
    expect(req.headers["content-type"]).toBe("application/json");
    const sig = req.headers["ez-signature"]!;
    const [, ts, v1] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(sig)!;
    expect(v1).toBe(createHmac("sha256", hook.secret).update(`${ts}.${req.body}`).digest("hex"));
    // příklad ověření z dokumentace
    expect(verifyWebhookSignature(req.body, sig, hook.secret)).toBe(true);
    expect(verifyWebhookSignature(req.body.replace("confirmed", "rejected"), sig, hook.secret)).toBe(false);
    expect(verifyWebhookSignature(req.body, sig, "whsec_wrong")).toBe(false);
    const old = Math.floor(Date.now() / 1000) - 301;
    const oldSig = `t=${old},v1=${createHmac("sha256", hook.secret).update(`${old}.${req.body}`).digest("hex")}`;
    expect(verifyWebhookSignature(req.body, oldSig, hook.secret)).toBe(false);
    expect((await deliveries())[0]).toMatchObject({ status: "delivered", attempts: 1, lastHttpStatus: 200 });
  });

  it("gate: retries after 1 min, 5 min, 30 min, 2 h, 6 h, 24 h, then failed", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    await register(s.token, { url: URL_OK, events: ["sale.confirmed"] });
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    reply = () => 500;
    let now = new Date();
    const gaps: number[] = [];
    for (let i = 0; i < 7; i++) {
      await deliverWebhooks(now);
      const [d] = await deliveries();
      if (d!.status === "failed") break;
      gaps.push(Math.round((d!.nextAttemptAt.getTime() - now.getTime()) / 60_000));
      // před termínem se znovu nevolá
      const before = sent.length;
      await deliverWebhooks(new Date(d!.nextAttemptAt.getTime() - 1_000));
      expect(sent.length).toBe(before);
      now = d!.nextAttemptAt;
    }
    expect(gaps).toEqual([1, 5, 30, 120, 360, 1440]);
    expect(sent).toHaveLength(7);
    expect((await deliveries())[0]).toMatchObject({ status: "failed", attempts: 7, lastHttpStatus: 500 });
  });

  it("gate: failing for 3 days in a row → endpoint disabled and the owner gets the e-mail (verbatim); sales keep being evidenced", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const { json: hook } = await register(s.token, { url: URL_OK });
    reply = () => 503;
    const start = Date.now();
    for (let day = 0; day <= 3; day++) {
      await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
      await getDb().update(schema.webhookDeliveries).set({ nextAttemptAt: new Date(0) }).where(eq(schema.webhookDeliveries.status, "pending"));
      await deliverWebhooks(new Date(start + day * 86_400_000 + 60_000));
    }
    const ep = (await getDb().select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, hook.id)))[0]!;
    expect(ep.active).toBe(false);
    const mails = await getDb().select().from(schema.emailOutbox);
    const mail = mails.find((m) => JSON.stringify(m.payload).includes("Webhook pro integraci"));
    expect((mail!.payload as { text: string }).text).toContain("Webhook pro integraci ALiSiO nefunguje 3 dny a byl vypnut. Tržby se evidují dál, jen o nich systém ALiSiO nedostává zprávy.");
    expect(mail!.to).toBe(s.user.email);
    // vypnutý endpoint už nové události nedostává, tržby se evidují
    const before = (await deliveries()).length;
    const r = await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    expect(r.json.results[0].status).toBe("confirmed");
    expect((await deliveries()).length).toBe(before);
  });

  it("gate: a success resets the failure streak", async () => {
    __setTransportFactoryForTests(fakeTransports().factory);
    const s = await seedApi();
    const { json: hook } = await register(s.token, { url: URL_OK });
    reply = () => 500;
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    await deliverWebhooks(new Date());
    expect((await getDb().select().from(schema.webhookEndpoints))[0]!.failingSince).not.toBeNull();
    reply = () => 204;
    await deliverWebhooks(new Date(Date.now() + 61_000));
    const ep = (await getDb().select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, hook.id)))[0]!;
    expect(ep.failingSince).toBeNull();
  });

  it("gate: sale.rejected on a final FS refusal and on quarantine", async () => {
    __setTransportFactoryForTests(fakeTransports(() => ({ ok: false, retryable: false, code: "EET_4", message: "Neplatný podpis", errorClass: "permanent" }) as never).factory);
    const s = await seedApi();
    await register(s.token, { url: URL_OK, events: ["sale.rejected"] });
    const rejected = apiSale(s.unit.id);
    const quarantined = apiSale(s.unit.id, { soldAt: new Date(Date.now() + 3_600_000).toISOString() });
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [rejected, quarantined] } });
    const ds = await deliveries();
    expect(ds.map((d) => [(d.payload as { data: { id: string } }).data.id, d.event]).sort()).toEqual(
      [
        [rejected.id, "sale.rejected"],
        [quarantined.id, "sale.rejected"],
      ].sort(),
    );
    const q = ds.find((d) => (d.payload as { data: { id: string } }).data.id === quarantined.id)!;
    expect((q.payload as { data: { status: string } }).data.status).toBe("quarantined");
  });

  it("gate: sale.deadline_soon exactly once per sale when the deadline is ≤ 24 h away", async () => {
    __setTransportFactoryForTests(fakeTransports(() => ({ ok: false, retryable: true, code: "NETWORK", message: "FS nedostupná" })).factory);
    const s = await seedApi();
    await register(s.token, { url: URL_OK, events: ["sale.deadline_soon"] });
    const sale = apiSale(s.unit.id, { soldAt: new Date(Math.floor(Date.now() / 1000) * 1000 - 25 * 3_600_000).toISOString() });
    const fresh = apiSale(s.unit.id);
    await call(salesPOST, { path: "/api/v1/sales", token: s.token, body: { sales: [sale, fresh] } });
    await scanWebhookEvents(new Date());
    await scanWebhookEvents(new Date());
    await scanWebhookEvents(new Date(Date.now() + 3_600_000));
    const ds = (await deliveries()).filter((d) => d.event === "sale.deadline_soon");
    expect(ds).toHaveLength(1);
    expect((ds[0]!.payload as { data: { id: string } }).data.id).toBe(sale.id);
  });

  it("gate: certificate.expiring at 31, 14 and 3 days (once each) and certificate.expired", async () => {
    const s = await seedApi();
    await register(s.token, { url: URL_OK, events: ["certificate.expiring", "certificate.expired"] });
    const cert = (await getDb().select().from(schema.certificates).where(and(eq(schema.certificates.accountId, s.account.id), eq(schema.certificates.environment, "playground"))))[0]!;
    const validTo = cert.validTo.getTime();
    for (const daysBefore of [40, 31, 30, 14, 13, 3, 2]) {
      await scanWebhookEvents(new Date(validTo - daysBefore * 86_400_000 + 3_600_000));
    }
    await scanWebhookEvents(new Date(validTo + 3_600_000));
    await scanWebhookEvents(new Date(validTo + 7_200_000));
    const ds = await deliveries();
    expect(ds.filter((d) => d.event === "certificate.expiring").map((d) => (d.payload as { data: { daysLeft: number; threshold: number } }).data.threshold)).toEqual([31, 14, 3]);
    expect(ds.filter((d) => d.event === "certificate.expired")).toHaveLength(1);
    expect(JSON.stringify(ds)).not.toMatch(/BEGIN|PRIVATE|encrypted/);
  });

  it("gate: integration.revoked goes to all endpoints of the integration at revocation and is still delivered", async () => {
    const s = await seedApi();
    await register(s.token, { url: URL_OK, events: ["sale.confirmed"] });
    await register(s.token, { url: "https://hooks.alisio.example/second" });
    const { revokeIntegration } = await import("@/lib/server/integrations");
    await revokeIntegration(s.account.id, s.integration.id);
    const ds = (await deliveries()).filter((d) => d.event === "integration.revoked");
    expect(ds).toHaveLength(2);
    await deliverWebhooks(new Date());
    expect(sent.map((x) => JSON.parse(x.body).type)).toEqual(["integration.revoked", "integration.revoked"]);
  });

  it("gate: POST /v1/webhooks/{id}/test queues a test event", async () => {
    const s = await seedApi();
    const { json: hook } = await register(s.token, { url: URL_OK, events: ["sale.confirmed"] });
    const r = await call(hookTestPOST, { path: `/api/v1/webhooks/${hook.id}/test`, token: s.token, params: { id: hook.id } });
    expect(r.status).toBe(202);
    await deliverWebhooks(new Date());
    expect(JSON.parse(sent[0]!.body)).toMatchObject({ type: "webhook.test", data: { integrationId: s.integration.id } });
  });

  it("gate: runRetention deletes deliveries older than 30 days", async () => {
    const s = await seedApi();
    const { json: hook } = await register(s.token, { url: URL_OK });
    await getDb().insert(schema.webhookDeliveries).values({ endpointId: hook.id, event: "webhook.test", payload: {}, status: "delivered", createdAt: new Date(Date.now() - 31 * 86_400_000) });
    const { runRetention } = await import("@/lib/server/lifecycle");
    expect(await runRetention()).toMatchObject({ webhookDeliveries: 1 });
  });
});

describe("S8 – SSRF address filter used by the real sender", () => {
  it("gate: private, loopback, link-local, metadata, CGNAT, multicast and IPv4-mapped private addresses are not public", async () => {
    const { isPublicAddress } = await import("@/lib/server/webhooks");
    for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.5.4", "192.168.0.1", "169.254.169.254", "100.64.1.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd00:ec2::254", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "not-an-ip"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ["93.184.216.34", "2a00:1450:4001:80b::200e", "::ffff:93.184.216.34"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
});
