/**
 * R6.3 (рецензія №3, B В3-2) – retention vidí otevřenou produkční karanténu. Zrušený účet, jehož produkční tržba
 * leží v karanténě (nikdy nebyla evidována), se po 30 dnech nesmaže – drží se jako účet s neodeslanými tržbami.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAccount, runRetention } from "@/lib/server/lifecycle";
import { ingestSales } from "@/lib/server/sales";
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

describe("R6.3 – retention sees an open production quarantine", () => {
  it("gate: production sale in FUTURE_DATE quarantine → close → retention +31 d keeps the account (accountsHeld 1)", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const [r] = await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() + 11 * 60_000).toISOString() }) as never]);
    expect(r).toMatchObject({ quarantined: true, code: "FUTURE_DATE" });
    await closeAccount(s.account.id, { confirm: true });
    const out = await runRetention(new Date(Date.now() + 31 * DAY));
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toBeTruthy();
    expect(out).toMatchObject({ accountsHeld: 1 });
  });

  it("a resolved or a mock quarantine does not hold the account", async () => {
    const s = await seedAccount({ mode: "mock" });
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { soldAt: new Date(Date.now() + 11 * 60_000).toISOString() }) as never]);
    await closeAccount(s.account.id, { confirm: true });
    await runRetention(new Date(Date.now() + 31 * DAY));
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toBeUndefined();
  });
});
