/**
 * R9.4 (рецензія №6, A4) – POST /api/registrace/potvrdit budil outbox (after(processOutbox)) na každý požadavek, i s neplatným
 * tokenem, bez přihlášení a limitu. Nově jen když confirmPreregistration vrátil true.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

const { processOutbox } = vi.hoisted(() => ({ processOutbox: vi.fn(async () => ({ sent: 0, failed: 0 })) }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/server/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/server/mail")>()), processOutbox }));

const { POST: confirmRoute } = await import("@/app/api/registrace/potvrdit/route");
const { issueConfirmToken } = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  processOutbox.mockClear();
});

const confirm = (token: string) => {
  const body = new FormData();
  body.set("token", token);
  return confirmRoute(new Request("http://localhost/api/registrace/potvrdit", { method: "POST", body }));
};

describe("R9.4 – potvrdit wakes the outbox only after a real confirmation", () => {
  it("gate: invalid token → 303 to the status page, processOutbox not called", async () => {
    for (const token of ["", "x", "A".repeat(32), "not a token"]) {
      const res = await confirm(token);
      expect(res.status).toBe(303);
    }
    expect(processOutbox).not.toHaveBeenCalled();
  });

  it("valid token → confirmed and the outbox is woken once", async () => {
    const { token, hash } = issueConfirmToken();
    await getDb().insert(schema.preregistrations).values({ email: "doi@example.cz", referralCode: "r9doi001", confirmTokenHash: hash, confirmTokenIssuedAt: new Date() });
    expect((await confirm(token)).status).toBe(303);
    expect(processOutbox).toHaveBeenCalledTimes(1);
    expect((await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, "doi@example.cz") }))!.confirmedAt).not.toBeNull();
  });
});
