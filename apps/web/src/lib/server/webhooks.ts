import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { BlockList, isIP } from "node:net";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, notInArray } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { LocalKeyEncryptor, decryptSecret, encryptSecret } from "@ez/fiscal-core/server";
import { enqueueEmail } from "./mail";
import { ownerEmails } from "./owners";

/**
 * Webhooky EET API (S8, rozd. 8). Události vznikají jako řádky webhook_deliveries (outbox) – nikdy HTTP uvnitř transakce
 * tržby; odesílá je cron (deliverWebhooks). Pořadí se nezaručuje, příjemce deduplikuje podle `id` události.
 * SSRF: jen https, bez přihlašovacích údajů v URL, adresa se ověřuje při registraci i při každém odeslání (po DNS,
 * při samotném připojení – proti DNS rebinding), přesměrování se nesleduje.
 */

export const WEBHOOK_EVENTS = ["sale.confirmed", "sale.rejected", "sale.deadline_soon", "certificate.expiring", "certificate.expired", "integration.revoked"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | "webhook.test";

/** Odstupy opakování po neúspěchu (S8, rozd. 8): 1 min, 5 min, 30 min, 2 h, 6 h, 24 h – pak failed. */
export const RETRY_MINUTES = [1, 5, 30, 120, 360, 1440] as const;
export const DISABLE_AFTER_MS = 3 * 86_400_000;
const TIMEOUT_MS = 5_000;
const CERT_THRESHOLDS = [31, 14, 3] as const;

/* ───────────── síť (v testech podstrčená) ───────────── */

type SendReq = { url: string; headers: Record<string, string>; body: string };
type Net = { resolve: (host: string) => Promise<string[]>; send: (req: SendReq) => Promise<{ status: number }> };
let testNet: Net | null = null;

/** Jen pro testy: DNS a HTTP bez sítě. */
export function __setWebhookNetForTests(net: Net | null): void {
  testNet = net;
}

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  BLOCKED.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
] as const)
  BLOCKED.addSubnet(net, prefix, "ipv6");

/** Veřejná adresa? (privátní, loopback, link-local vč. metadat 169.254.169.254, multicast, dokumentační rozsahy ne) */
export function isPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (!v) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPublicAddress(mapped[1]!);
  return !BLOCKED.check(ip, v === 4 ? "ipv4" : "ipv6");
}

/** Jen pro místní kouřový test (api-smoke) mimo produkci: přijímač na http://localhost. */
function allowPrivate(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WEBHOOK_ALLOW_PRIVATE === "1";
}

async function resolveHost(host: string): Promise<string[]> {
  if (testNet) return testNet.resolve(host);
  if (isIP(host)) return [host];
  return (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
}

/** Proč URL nelze použít (null = smí). */
export async function urlRefusal(raw: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Invalid URL.";
  }
  if (raw.length > 500) return "URL is too long.";
  if (u.protocol !== "https:" && !(allowPrivate() && u.protocol === "http:")) return "Only https URLs are allowed.";
  if (u.username || u.password) return "Credentials in the URL are not allowed.";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    if (!allowPrivate()) return "The URL points to a private or reserved address.";
  }
  if (allowPrivate()) return null;
  const ips = await resolveHost(host).catch(() => []);
  if (!ips.length) return "The host name does not resolve.";
  if (ips.some((ip) => !isPublicAddress(ip))) return "The URL points to a private or reserved address.";
  return null;
}

/**
 * Odeslání POSTem: připojení jde jen na ověřenou veřejnou adresu (lookup při připojení), časový limit 5 s,
 * přesměrování se nesleduje, tělo odpovědi se nečte ani neukládá.
 */
async function send(req: SendReq): Promise<{ status: number }> {
  const u = new URL(req.url);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = await resolveHost(host);
  if (!allowPrivate() && (!ips.length || ips.some((ip) => !isPublicAddress(ip)))) throw new Error("blocked address");
  if (testNet) return testNet.send(req);
  const pinned = ips[0]!;
  return new Promise((resolve, reject) => {
    const r = (u.protocol === "https:" ? httpsRequest : httpRequest)(
      {
        method: "POST",
        hostname: host,
        port: u.port || undefined,
        path: `${u.pathname}${u.search}`,
        headers: { ...req.headers, "content-length": Buffer.byteLength(req.body) },
        timeout: TIMEOUT_MS,
        // připojit se přesně na ověřenou adresu (žádný nový dotaz do DNS mezi kontrolou a připojením)
        lookup: (_h: string, _o: unknown, cb: (err: Error | null, address: string, family: number) => void) => cb(null, pinned, isIP(pinned)),
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
      },
    );
    r.on("timeout", () => r.destroy(new Error("timeout")));
    r.on("error", reject);
    r.end(req.body);
  });
}

/* ───────────── tajemství ───────────── */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function newSecret(): string {
  let s = "whsec_";
  for (const b of randomBytes(64)) if (b < 248 && s.length < 6 + 40) s += BASE62[b % 62];
  return s;
}
const secretContext = (endpointId: string) => `webhook:${endpointId}`;

async function secretOf(ep: typeof schema.webhookEndpoints.$inferSelect): Promise<string> {
  const plain = await decryptSecret(LocalKeyEncryptor.fromEnv(), { ciphertext: ep.secretEnc, encryptedDek: ep.secretDek, keyVersion: ep.secretKeyVersion }, secretContext(ep.id));
  return plain.toString("utf8");
}

/* ───────────── správa endpointů ───────────── */

export type EndpointDto = { id: string; url: string; events: string[]; active: boolean; failingSince: string | null; createdAt: string };
export function endpointDto(e: typeof schema.webhookEndpoints.$inferSelect): EndpointDto {
  return { id: e.id, url: e.url, events: e.events, active: e.active, failingSince: e.failingSince?.toISOString() ?? null, createdAt: e.createdAt.toISOString() };
}

export async function createEndpoint(integrationId: string, url: string, events: string[]): Promise<{ endpoint: EndpointDto; secret: string }> {
  const id = randomUUID();
  const secret = newSecret();
  const sealed = await encryptSecret(LocalKeyEncryptor.fromEnv(), Buffer.from(secret), secretContext(id));
  const [row] = await getDb()
    .insert(schema.webhookEndpoints)
    .values({ id, integrationId, url, events, secretEnc: sealed.ciphertext, secretDek: sealed.encryptedDek, secretKeyVersion: sealed.keyVersion })
    .returning();
  return { endpoint: endpointDto(row!), secret };
}

export async function listEndpoints(integrationId: string) {
  return (await getDb().select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.integrationId, integrationId)).orderBy(asc(schema.webhookEndpoints.createdAt))).map(endpointDto);
}

export async function deleteEndpoint(integrationId: string, id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(schema.webhookEndpoints)
    .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.integrationId, integrationId)))
    .returning({ id: schema.webhookEndpoints.id });
  return rows.length > 0;
}

/* ───────────── události (outbox) ───────────── */

type Emit = { integrationId: string; event: WebhookEvent; data: unknown; dedupeKey?: string; endpointId?: string; includeInactive?: boolean };

/** Událost do outboxu pro aktivní endpointy integrace, které ji odebírají (prázdný seznam událostí = všechny). */
export async function emit(e: Emit): Promise<number> {
  const db = getDb();
  const endpoints = await db
    .select()
    .from(schema.webhookEndpoints)
    .where(and(eq(schema.webhookEndpoints.integrationId, e.integrationId), ...(e.endpointId ? [eq(schema.webhookEndpoints.id, e.endpointId)] : []), ...(e.includeInactive ? [] : [eq(schema.webhookEndpoints.active, true)])));
  let n = 0;
  for (const ep of endpoints) {
    if (e.event !== "webhook.test" && e.event !== "integration.revoked" && ep.events.length && !ep.events.includes(e.event)) continue;
    const id = randomUUID();
    const payload = { id, type: e.event, createdAt: new Date().toISOString(), data: e.data };
    const rows = await db
      .insert(schema.webhookDeliveries)
      .values({ id, endpointId: ep.id, event: e.event, payload, dedupeKey: e.dedupeKey ?? null })
      .onConflictDoNothing()
      .returning({ id: schema.webhookDeliveries.id });
    n += rows.length;
  }
  return n;
}

async function saleData(saleId: string) {
  const { statusForWebhook } = await import("./api/v1");
  return statusForWebhook(saleId);
}

/** Po výsledku pokusu o odeslání (processSale): sale.confirmed / sale.rejected – jen tržby z API. */
export async function onSaleOutcome(row: { id: string; integrationId: string | null }, result: "confirmed" | "rejected"): Promise<void> {
  if (!row.integrationId) return;
  const data = await saleData(row.id);
  if (data) await emit({ integrationId: row.integrationId, event: result === "confirmed" ? "sale.confirmed" : "sale.rejected", data, dedupeKey: `${result}:${row.id}` });
}

/** Tržba z API skončila v karanténě → sale.rejected (stav quarantined). */
export async function onSaleQuarantined(integrationId: string, data: { id: string }): Promise<void> {
  await emit({ integrationId, event: "sale.rejected", data, dedupeKey: `quarantined:${data.id}` });
}

/** integration.revoked na všechny endpointy integrace v okamžiku odpojení. */
export async function emitIntegrationRevoked(integration: { id: string; name: string; revokedAt: Date | null }): Promise<void> {
  await emit({ integrationId: integration.id, event: "integration.revoked", data: { integrationId: integration.id, name: integration.name, revokedAt: integration.revokedAt?.toISOString() ?? null }, dedupeKey: `revoked:${integration.id}` });
}

export async function emitTest(integrationId: string, endpointId: string): Promise<boolean> {
  return (await emit({ integrationId, endpointId, event: "webhook.test", data: { integrationId, message: "Test event from EvidujZdarma." } })) > 0;
}

/**
 * Plánované události (cron): sale.deadline_soon (tržba bez POK, do lhůty ≤ 24 h, jednou na tržbu) a
 * certificate.expiring za 31, 14 a 3 dny / certificate.expired (jednou na certifikát a práh).
 */
export async function scanWebhookEvents(now = new Date()): Promise<{ deadlineSoon: number; certificates: number }> {
  const db = getDb();
  const hooked = db.select({ id: schema.webhookEndpoints.integrationId }).from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.active, true));
  const soon = await db
    .select({ id: schema.sales.id, integrationId: schema.sales.integrationId })
    .from(schema.sales)
    .where(
      and(
        isNotNull(schema.sales.integrationId),
        inArray(schema.sales.integrationId, hooked),
        notInArray(schema.sales.status, ["confirmed", "not_required"]),
        lte(schema.sales.deadlineAt, new Date(now.getTime() + 24 * 3_600_000)),
        gt(schema.sales.deadlineAt, new Date(now.getTime() - 7 * 86_400_000)),
      ),
    )
    .limit(500);
  let deadlineSoon = 0;
  for (const s of soon) {
    const data = await saleData(s.id);
    if (data) deadlineSoon += await emit({ integrationId: s.integrationId!, event: "sale.deadline_soon", data, dedupeKey: `deadline:${s.id}` });
  }

  let certificates = 0;
  const integrations = await db
    .select()
    .from(schema.integrations)
    .where(and(isNull(schema.integrations.revokedAt), inArray(schema.integrations.id, hooked)));
  for (const i of integrations) {
    const env = i.environment === "live" ? "production" : "playground";
    const [cert] = await db
      .select({ id: schema.certificates.id, validTo: schema.certificates.validTo })
      .from(schema.certificates)
      .where(and(eq(schema.certificates.accountId, i.accountId), eq(schema.certificates.environment, env), isNull(schema.certificates.revokedAt)))
      .orderBy(desc(schema.certificates.createdAt))
      .limit(1);
    if (!cert) continue;
    const msLeft = cert.validTo.getTime() - now.getTime();
    const daysLeft = Math.floor(msLeft / 86_400_000);
    if (msLeft <= 0) {
      certificates += await emit({ integrationId: i.id, event: "certificate.expired", data: { environment: i.environment, validTo: cert.validTo.toISOString() }, dedupeKey: `cert-expired:${cert.id}` });
      continue;
    }
    // nejnižší práh, pod který už platnost klesla (při výpadku cronu se starší prahy nedohánějí)
    const threshold = [...CERT_THRESHOLDS].reverse().find((d) => msLeft <= d * 86_400_000);
    if (threshold) {
      certificates += await emit({
        integrationId: i.id,
        event: "certificate.expiring",
        data: { environment: i.environment, validTo: cert.validTo.toISOString(), daysLeft, threshold },
        dedupeKey: `cert-expiring:${cert.id}:${threshold}`,
      });
    }
  }
  return { deadlineSoon, certificates };
}

/* ───────────── doručování ───────────── */

/**
 * Odešle splatné doručenky (cron). 2xx = doručeno. Jinak další pokus podle RETRY_MINUTES, po vyčerpání failed.
 * Endpoint, který selhává 3 dny v kuse, se vypne a vlastník dostane e-mail.
 */
export async function deliverWebhooks(now = new Date(), limit = 50): Promise<{ delivered: number; failed: number }> {
  const db = getDb();
  const due = await db
    .select({ d: schema.webhookDeliveries, ep: schema.webhookEndpoints })
    .from(schema.webhookDeliveries)
    .innerJoin(schema.webhookEndpoints, eq(schema.webhookEndpoints.id, schema.webhookDeliveries.endpointId))
    .where(and(eq(schema.webhookDeliveries.status, "pending"), lte(schema.webhookDeliveries.nextAttemptAt, now)))
    .orderBy(asc(schema.webhookDeliveries.nextAttemptAt))
    .limit(limit);
  let delivered = 0;
  let failed = 0;
  const secrets = new Map<string, string>();
  for (const { d, ep } of due) {
    // vypnutý endpoint dostane jen integration.revoked; ostatní čekající doručenky propadnou
    if (!ep.active && d.event !== "integration.revoked") {
      await db.update(schema.webhookDeliveries).set({ status: "failed", lastError: "endpoint disabled" }).where(eq(schema.webhookDeliveries.id, d.id));
      continue;
    }
    const body = JSON.stringify(d.payload);
    const t = Math.floor(now.getTime() / 1000);
    let status = 0;
    let error: string | null = null;
    try {
      if (!secrets.has(ep.id)) secrets.set(ep.id, await secretOf(ep));
      const v1 = createHmac("sha256", secrets.get(ep.id)!).update(`${t}.${body}`).digest("hex");
      status = (await send({ url: ep.url, body, headers: { "content-type": "application/json", "user-agent": "EvidujZdarma-Webhooks/1", "ez-signature": `t=${t},v1=${v1}`, "ez-event-id": d.id } })).status;
    } catch (e) {
      error = e instanceof Error && /blocked address|timeout|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN/.test(e.message) ? e.message.slice(0, 200) : `${e instanceof Error ? e.name : "Error"}`;
    }
    const attempts = d.attempts + 1;
    if (status >= 200 && status < 300) {
      delivered++;
      await db.update(schema.webhookDeliveries).set({ status: "delivered", attempts, lastHttpStatus: status, lastError: null, deliveredAt: now }).where(eq(schema.webhookDeliveries.id, d.id));
      if (ep.failingSince) await db.update(schema.webhookEndpoints).set({ failingSince: null }).where(eq(schema.webhookEndpoints.id, ep.id));
      continue;
    }
    failed++;
    const delay = RETRY_MINUTES[attempts - 1];
    await db
      .update(schema.webhookDeliveries)
      .set({
        status: delay === undefined ? "failed" : "pending",
        attempts,
        lastHttpStatus: status || null,
        lastError: (error ?? `HTTP ${status}`).slice(0, 200),
        nextAttemptAt: new Date(now.getTime() + (delay ?? 0) * 60_000),
      })
      .where(eq(schema.webhookDeliveries.id, d.id));
    const failingSince = ep.failingSince ?? now;
    if (!ep.failingSince) await db.update(schema.webhookEndpoints).set({ failingSince: now }).where(eq(schema.webhookEndpoints.id, ep.id));
    ep.failingSince = failingSince;
    if (ep.active && now.getTime() - failingSince.getTime() >= DISABLE_AFTER_MS) {
      ep.active = false;
      await disableEndpoint(ep.id, ep.integrationId);
    }
  }
  return { delivered, failed };
}

async function disableEndpoint(endpointId: string, integrationId: string) {
  const db = getDb();
  const [done] = await db
    .update(schema.webhookEndpoints)
    .set({ active: false })
    .where(and(eq(schema.webhookEndpoints.id, endpointId), eq(schema.webhookEndpoints.active, true)))
    .returning({ id: schema.webhookEndpoints.id });
  if (!done) return;
  const integration = await db.query.integrations.findFirst({ where: eq(schema.integrations.id, integrationId) });
  if (!integration) return;
  const { absoluteUrl } = await import("@/lib/site");
  for (const to of await ownerEmails(integration.accountId)) {
    await enqueueEmail({
      to,
      template: "notice",
      dedupeKey: `webhook-disabled:${endpointId}:${to}`,
      payload: {
        subject: `Webhook integrace ${integration.name} byl vypnut`,
        text: `Webhook pro integraci ${integration.name} nefunguje 3 dny a byl vypnut. Tržby se evidují dál, jen o nich systém ${integration.name} nedostává zprávy.`,
        url: absoluteUrl("/pokladna/integrace"),
        buttonLabel: "Otevřít integrace",
      },
    });
  }
}

/** Úklid (runRetention): doručenky starší 30 dní. */
export async function cleanupWebhookDeliveries(now = new Date()): Promise<number> {
  const rows = await getDb()
    .delete(schema.webhookDeliveries)
    .where(lt(schema.webhookDeliveries.createdAt, new Date(now.getTime() - 30 * 86_400_000)))
    .returning({ id: schema.webhookDeliveries.id });
  return rows.length;
}

/** Stav doručenek endpointů integrace pro UI vlastníka (bez těl). */
export async function recentDeliveries(integrationId: string, limit = 20) {
  return getDb()
    .select({ id: schema.webhookDeliveries.id, endpointId: schema.webhookDeliveries.endpointId, event: schema.webhookDeliveries.event, status: schema.webhookDeliveries.status, attempts: schema.webhookDeliveries.attempts, lastHttpStatus: schema.webhookDeliveries.lastHttpStatus, createdAt: schema.webhookDeliveries.createdAt })
    .from(schema.webhookDeliveries)
    .innerJoin(schema.webhookEndpoints, eq(schema.webhookEndpoints.id, schema.webhookDeliveries.endpointId))
    .where(eq(schema.webhookEndpoints.integrationId, integrationId))
    .orderBy(desc(schema.webhookDeliveries.createdAt))
    .limit(limit);
}
