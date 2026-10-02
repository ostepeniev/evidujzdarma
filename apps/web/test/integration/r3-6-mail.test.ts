/** R3.6 – bez SMTP v produkci se e-mail neoznačí jako odeslaný a jeho obsah (odkaz s tokenem) se nezaloguje. */
import { getDb, schema } from "@ez/db";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("R3.6 – fail closed without SMTP", () => {
  it("production without SMTP_URL keeps the e-mail queued and logs no content", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_URL", "");
    const spies = [vi.spyOn(console, "info").mockImplementation(() => {}), vi.spyOn(console, "log").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {})];
    vi.resetModules();
    const { enqueueEmail, processOutbox } = await import("@/lib/server/mail");
    const secretUrl = "https://evidujzdarma.cz/api/auth/callback?token=SECRET_LOGIN_TOKEN_123";
    await enqueueEmail({ to: "a@example.cz", template: "login-link", payload: { url: secretUrl } });
    const r = await processOutbox(5);
    expect(r.sent).toBe(0);
    const [row] = await getDb().select().from(schema.emailOutbox);
    expect(row!.status).not.toBe("sent");
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain("SECRET_LOGIN_TOKEN_123");
  });
});
