/**
 * R6.11 (рецензія №3, A Д-2) – ostrý provoz nejde zapnout dřív, než ostré prostředí FS přijímá tržby
 * (1. 11. 2026, přechodný režim). Neplatná hodnota EET_PRODUCTION_ACCEPTS_FROM kontrolu nevypne (fail-closed).
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setEetMode } from "@/lib/server/account";
import { HttpError } from "@/lib/server/auth";
import { productionAcceptsFrom } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
const saved = process.env.EET_PRODUCTION_ACCEPTS_FROM;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T10:00:00+02:00"));
});
afterEach(() => {
  vi.useRealTimers();
  process.env.EET_PRODUCTION_ACCEPTS_FROM = saved;
});

const FS_DATE = Date.parse("2026-11-01T00:00:00+01:00");

/** Účet připravený na ostrý provoz (ověřený certifikát, jednotka s číslem FS), zatím v Playgroundu. */
async function readyForProduction() {
  const s = await seedAccount({ mode: "playground" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  return s;
}

describe("R6.11 – production only from the date FS accepts it", () => {
  it("gate: setEetMode('production') on 20. 10. 2026 → 400 naming the date", async () => {
    delete process.env.EET_PRODUCTION_ACCEPTS_FROM; // skutečné datum FS
    const s = await readyForProduction();
    const err = (await setEetMode(s.account.id, "production", { confirm: true }).catch((e: unknown) => e)) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/1\. 11\. 2026/);
    expect((await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) }))!.eetMode).toBe("playground");
  });

  it("gate: invalid env value → the constant 2026-11-01, not a disabled check", async () => {
    process.env.EET_PRODUCTION_ACCEPTS_FROM = "x";
    expect(productionAcceptsFrom()).toBe(FS_DATE);
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const [r] = await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production" }) as never]);
    expect(r).toMatchObject({ quarantined: true, code: "PRODUCTION_NOT_OPEN" });
    const p = await readyForProduction();
    await expect(setEetMode(p.account.id, "production", { confirm: true })).rejects.toBeInstanceOf(HttpError);
  });

  it("control: from 1. 11. 2026 (or with a valid earlier override) production can be switched on", async () => {
    delete process.env.EET_PRODUCTION_ACCEPTS_FROM;
    vi.setSystemTime(new Date("2026-11-01T08:00:00+01:00"));
    const s = await readyForProduction();
    await setEetMode(s.account.id, "production", { confirm: true });
    expect((await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) }))!.eetMode).toBe("production");
  });
});
