/**
 * R5.8 (A В-4) – „Zrušit účet“ s neodeslanými tržbami: 409 se seznamem, dokud to vlastník výslovně nepotvrdí.
 * Zařízení po zrušení jen dovyvezou uložené tržby. Retention nesmaže účet s produkčními tržbami bez POK.
 */
import { randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as configGet } from "@/app/api/pokladna/config/route";
import { POST as pinPost } from "@/app/api/pokladna/pin/route";
import { POST as salesPost } from "@/app/api/pokladna/sales/route";
import { HttpError } from "@/lib/server/auth";
import { storeCertificate } from "@/lib/server/fiscal";
import { closeAccount, runRetention } from "@/lib/server/lifecycle";
import { ingestSales } from "@/lib/server/sales";
import { sha256 } from "@/lib/server/tokens";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const DAY = 86_400_000;

async function productionWithQueuedSale() {
  const s = await seedAccount({ mode: "production" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  const sale = deviceSale(s.unit.id, { mode: "production" });
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  return { s, sale };
}

describe("R5.8 – closing an account with unsent sales", () => {
  it("gate: closeAccount with a queued production sale → 409 with the pending list", async () => {
    const { s } = await productionWithQueuedSale();
    const err = await closeAccount(s.account.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
    expect((err as HttpError).details).toMatchObject({ pending: [expect.objectContaining({ mode: "production", count: 1 })], quarantine: 0 });
    expect((err as HttpError).details!.devices).toEqual([expect.objectContaining({ registerId: "P1" })]);
    expect((await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) }))!.closedAt).toBeNull();
  });

  it("an open quarantine also needs the confirmation; an account with everything settled closes at once", async () => {
    const s = await seedAccount({ mode: "mock" });
    const ctx = await deviceContext(s.device.id);
    await ingestSales(ctx, [deviceSale(s.unit.id, { soldAt: new Date(Date.now() + 11 * 60_000).toISOString() }) as never]);
    const err = (await closeAccount(s.account.id).catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(409);
    expect(err.details).toMatchObject({ quarantine: 1 });
    const clean = await seedAccount();
    await expect(closeAccount(clean.account.id)).resolves.toBeInstanceOf(Date);
  });

  it("after a confirmed close the device can still upload stored sales, but cannot sell or approve", async () => {
    const { s } = await productionWithQueuedSale();
    await closeAccount(s.account.id, { confirm: true });
    const token = randomBytes(32).toString("base64url");
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

    const offline = deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 60_000).toISOString() });
    const up = await salesPost(new Request("http://localhost/api/pokladna/sales", { method: "POST", headers, body: JSON.stringify({ sales: [offline] }) }));
    expect(up.status).toBe(200);
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, offline.id) })).toBeTruthy();

    const cfg = (await (await configGet(new Request("http://localhost/api/pokladna/config", { headers }))).json()) as { account: { closed?: boolean } };
    expect(cfg.account.closed).toBe(true);
    const pin = await pinPost(new Request("http://localhost/api/pokladna/pin", { method: "POST", headers, body: JSON.stringify({ staffId: s.owner.id, pin: "123456", purpose: "unlock" }) }));
    expect(pin.status).toBe(403);
  });

  it("retention keeps a closed account with production sales without POK; one without them is deleted", async () => {
    const { s } = await productionWithQueuedSale();
    await closeAccount(s.account.id, { confirm: true });
    const clean = await seedAccount();
    await closeAccount(clean.account.id);
    const out = await runRetention(new Date(Date.now() + 31 * DAY));
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toBeTruthy();
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, clean.account.id) })).toBeUndefined();
    expect(out).toMatchObject({ accounts: 1, accountsHeld: 1 });
  });
});
