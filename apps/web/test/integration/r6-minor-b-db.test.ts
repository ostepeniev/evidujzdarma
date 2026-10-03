/**
 * Рецензія №3, B – дрібне s databází / routami: Д3-5 token v e-mailové frontě, Д3-7 limit těla přes proxy,
 * Д3-8 kontrola původu na všech cookie routách, Д3-9 předregistrace.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { processOutbox } = await import("@/lib/server/mail");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.8.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = (email: string) => getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) });
const outbox = (email: string) => getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));

describe("Д3-5 – the confirmation token does not stay in email_outbox", () => {
  it("gate: after processOutbox the payload no longer contains the token from the e-mail", async () => {
    await post({ email: "token@example.cz" });
    const [queued] = await outbox("token@example.cz");
    const token = (queued!.payload as { confirmToken: string }).confirmToken;
    expect(token).toBeTruthy();
    await processOutbox(10);
    const [sent] = await outbox("token@example.cz");
    expect(sent!.status).toBe("sent");
    expect(JSON.stringify(sent!.payload)).not.toContain(token);
  });

  it("the login link is not kept after sending either", async () => {
    const { enqueueEmail } = await import("@/lib/server/mail");
    await enqueueEmail({ to: "login@example.cz", template: "login-link", payload: { url: "https://evidujzdarma.cz/prihlaseni/overeni?token=SECRETSECRETSECRETSECRETSECRET12" } });
    await processOutbox(10);
    const [sent] = await outbox("login@example.cz");
    expect(JSON.stringify(sent!.payload)).not.toContain("SECRETSECRET");
  });
});

describe("Д3-7 – body limit for chunked requests through the proxy", () => {
  it("gate: next.config sets experimental.proxyClientMaxBodySize to 1 MB", () => {
    const cfg = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
    expect(cfg).toMatch(/proxyClientMaxBodySize:\s*"1mb"/);
  });
});

describe("Д3-8 – same-origin check on every cookie route, not only in proxy.ts", () => {
  const evil = (url: string, method = "POST") => new Request(url, { method, headers: { origin: "https://evil.example", "content-type": "application/json" }, body: method === "DELETE" ? undefined : "{}" });
  const id = "11111111-2222-4333-8444-555555555555";
  it.each([
    ["POST /api/ucet", async () => (await import("@/app/api/ucet/route")).POST(evil("http://localhost/api/ucet"))],
    ["POST /api/kabinet", async () => (await import("@/app/api/kabinet/route")).POST(evil("http://localhost/api/kabinet"))],
    ["POST /api/kabinet/klienti", async () => (await import("@/app/api/kabinet/klienti/route")).POST(evil("http://localhost/api/kabinet/klienti"))],
    ["PATCH /api/kabinet/klienti/[id]", async () => (await import("@/app/api/kabinet/klienti/[id]/route")).PATCH(evil(`http://localhost/api/kabinet/klienti/${id}`, "PATCH"), { params: Promise.resolve({ id }) } as never)],
    ["DELETE /api/kabinet/klienti/[id]", async () => (await import("@/app/api/kabinet/klienti/[id]/route")).DELETE(evil(`http://localhost/api/kabinet/klienti/${id}`, "DELETE"), { params: Promise.resolve({ id }) } as never)],
    ["POST /api/kabinet/klienti/[id]/pozvanka", async () => (await import("@/app/api/kabinet/klienti/[id]/pozvanka/route")).POST(evil(`http://localhost/api/kabinet/klienti/${id}/pozvanka`), { params: Promise.resolve({ id }) } as never)],
    ["POST /api/pozvanka/[token]", async () => (await import("@/app/api/pozvanka/[token]/route")).POST(evil("http://localhost/api/pozvanka/x"), { params: Promise.resolve({ token: "x".repeat(40) }) } as never)],
    ["POST /api/auth/login", async () => (await import("@/app/api/auth/login/route")).POST(evil("http://localhost/api/auth/login"))],
    ["POST /api/auth/logout", async () => (await import("@/app/api/auth/logout/route")).POST(evil("http://localhost/api/auth/logout"))],
    ["POST /api/auth/callback", async () => (await import("@/app/api/auth/callback/route")).POST(evil("http://localhost/api/auth/callback"))],
  ])("gate: %s with Origin evil.example (bypassing proxy) → 403", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(403);
  });
});

describe("Д3-9 – pre-registration", () => {
  it("gate: a repeated registration does not modify someone else's record (UTM)", async () => {
    await post({ email: "owner@example.cz", utm: { utm_source: "fb" } });
    await post({ email: "owner@example.cz", utm: { utm_source: "attacker", utm_campaign: "x" } });
    expect((await rowOf("owner@example.cz"))!.utm).toEqual({ utm_source: "fb" });
  });

  it("gate: an unsubscribed address gets no new e-mail on a repeated registration", async () => {
    await post({ email: "gone@example.cz" });
    await getDb().update(schema.preregistrations).set({ unsubscribedAt: new Date() }).where(sql`${schema.preregistrations.email} = 'gone@example.cz'`);
    const before = (await outbox("gone@example.cz")).length;
    await post({ email: "gone@example.cz" });
    expect((await outbox("gone@example.cz")).length).toBe(before);
  });

  it("gate: a long honeypot value is silent too (200, nothing stored)", async () => {
    const res = await post({ email: "bot2@example.cz", website: "x".repeat(600) });
    expect(res.status).toBe(200);
    expect(await rowOf("bot2@example.cz")).toBeUndefined();
  });
});

describe("Д3-5 – migration 0025 strips secrets from rows sent before the fix", () => {
  it("gate: sent prereg-confirm / login-link rows lose the token; queued rows keep it", async () => {
    const { readFileSync: read } = await import("node:fs");
    const db = getDb();
    await db.insert(schema.emailOutbox).values([
      { to: "a@example.cz", template: "prereg-confirm", payload: { confirmToken: "OLDTOKEN", referralCode: "x" }, status: "sent" },
      { to: "b@example.cz", template: "login-link", payload: { url: "https://x/?token=OLDLOGIN" }, status: "sent" },
      { to: "c@example.cz", template: "prereg-confirm", payload: { confirmToken: "PENDING" }, status: "queued" },
    ]);
    const migration = read(new URL("../../../../packages/db/migrations/0025_outbox_strip_secrets.sql", import.meta.url), "utf8");
    for (const stmt of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(stmt));
    const rows = await db.select().from(schema.emailOutbox);
    const by = (to: string) => JSON.stringify(rows.find((r) => r.to === to)!.payload);
    expect(by("a@example.cz")).not.toContain("OLDTOKEN");
    expect(by("a@example.cz")).toContain("referralCode");
    expect(by("b@example.cz")).not.toContain("OLDLOGIN");
    expect(by("c@example.cz")).toContain("PENDING");
  });
});
