/**
 * R7.14 (рецензія №4, A N3) – EET_PRODUCTION_ACCEPTS_FROM přísně.
 *  - platí jen úplné ISO-8601 s časem a posunem; „1“, „2026“, samotné datum nebo čas bez posunu → konstanta 1. 11. 2026
 *    (Date.parse by z „1“ udělal rok 2001 a kontrolu vypnul);
 *  - v NODE_ENV=production smí env datum jen posunout dál: max(env, konstanta).
 */
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
  vi.unstubAllEnvs();
  process.env.EET_PRODUCTION_ACCEPTS_FROM = saved;
});

const FS_DATE = Date.parse("2026-11-01T00:00:00+01:00");

describe("R7.14 – EET_PRODUCTION_ACCEPTS_FROM strictly", () => {
  it("gate N3: env '1' → the constant; a production sale on 20. 10. → PRODUCTION_NOT_OPEN; setEetMode → 400", async () => {
    process.env.EET_PRODUCTION_ACCEPTS_FROM = "1";
    expect(productionAcceptsFrom()).toBe(FS_DATE);
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const [r] = await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production" }) as never]);
    expect(r).toMatchObject({ quarantined: true, code: "PRODUCTION_NOT_OPEN" });
    const p = await seedAccount({ mode: "playground" });
    await storeVerifiedCertificate(p.account.id, testCert().cert, "production");
    const err = (await setEetMode(p.account.id, "production", { confirm: true }).catch((e: unknown) => e)) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
  });

  it("gate: only a full ISO-8601 with time and offset is accepted", () => {
    for (const v of ["0", "1", "2026", "2026-10-15", "2026-10-15T00:00", "2026-10-15 00:00:00+02:00", "15. 10. 2026", " ", "true"]) {
      process.env.EET_PRODUCTION_ACCEPTS_FROM = v;
      expect(productionAcceptsFrom(), v).toBe(FS_DATE);
    }
    process.env.EET_PRODUCTION_ACCEPTS_FROM = "2026-10-15T00:00:00+02:00";
    expect(productionAcceptsFrom()).toBe(Date.parse("2026-10-15T00:00:00+02:00"));
    process.env.EET_PRODUCTION_ACCEPTS_FROM = "2026-10-15T00:00Z";
    expect(productionAcceptsFrom()).toBe(Date.parse("2026-10-15T00:00:00Z"));
  });

  it("gate: in NODE_ENV=production env can only move the date later", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EET_PRODUCTION_ACCEPTS_FROM = "2000-01-01T00:00:00Z";
    expect(productionAcceptsFrom()).toBe(FS_DATE);
    process.env.EET_PRODUCTION_ACCEPTS_FROM = "2026-11-05T00:00:00+01:00";
    expect(productionAcceptsFrom()).toBe(Date.parse("2026-11-05T00:00:00+01:00"));
  });
});
