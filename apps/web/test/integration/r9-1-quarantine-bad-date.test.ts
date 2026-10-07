/**
 * R9.1 (рецензія №6, A1) – nečitelné datum v karanténě nesmí shodit dotazy. Regulární výraz v PRODUCTION_QUARANTINE pustil
 * řetězce, které Postgres na timestamptz nepřevede (`2026-10-07T99:99:99Z` ze surového payloadu, který neprošel zod;
 * zod-platné `0000-01-01T00:00:00Z`, které skončilo jako TOO_OLD) → „date/time field value out of range“ v nastavení,
 * při zrušení účtu a v celé retention pro všechny účty. Nově `pg_input_is_valid` – nečitelné datum se bere jako ostré
 * (fail-closed), jak slibuje komentář.
 */
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accountState } from "@/lib/server/account";
import { closeAccount, runRetention, settleElsewhere, unsentProductionOf } from "@/lib/server/lifecycle";
import { deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const DAY = 86_400_000;
const BAD_DATES = ["0000-01-01T00:00:00Z", "2026-10-07T99:99:99Z"];

async function quarantineBadDates(s: Awaited<ReturnType<typeof seedAccount>>) {
  const ids: string[] = [];
  for (const [i, soldAt] of BAD_DATES.entries()) {
    const id = randomUUID();
    ids.push(id);
    // payload z pokladny ve starém (ukázkovém) režimu → o „ostrosti“ rozhoduje datum proti eet_mode_changed_at
    await getDb()
      .insert(schema.saleQuarantine)
      .values({ id, accountId: s.account.id, deviceId: s.device.id, payload: { ...deviceSale(s.unit.id, { id, soldAt }), mode: "mock" }, reasonCode: i ? "INVALID" : "TOO_OLD", reason: "test" });
  }
  return ids;
}

const ownerOf = (s: Awaited<ReturnType<typeof seedAccount>>) =>
  ({ id: s.user.id, email: s.user.email, memberships: [{ role: "owner", accountKind: "business", accountId: s.account.id }] }) as never;

describe("R9.1 – quarantine with an unparsable date", () => {
  it("gate: production account + open quarantine with 0000-01-01 and 2026-10-07T99:99:99Z → accountState, closeAccount, runRetention do not fail", async () => {
    const s = await seedAccount({ mode: "production" });
    const ids = await quarantineBadDates(s);
    // jiný zrušený účet, který má retention normálně smazat – chyba jednoho účtu nesmí zastavit retention pro všechny
    const other = await seedAccount({ mode: "mock" });
    await closeAccount(other.account.id, { confirm: true });

    await expect(accountState(ownerOf(s))).resolves.toBeTruthy();
    await expect(closeAccount(s.account.id)).rejects.toMatchObject({ status: 409 });
    await expect(closeAccount(s.account.id, { confirm: true })).resolves.toBeInstanceOf(Date);
    // fail-closed: nečitelné datum na účtu v ostrém provozu = možná ostrá tržba
    const unsent = await unsentProductionOf(s.account.id);
    expect(unsent.quarantine.map((q) => q.id).sort()).toEqual([...ids].sort());
    const closure = ((await accountState(ownerOf(s))) as unknown as { closure: { quarantineProduction: number } }).closure;
    expect(closure.quarantineProduction).toBe(2);

    const out = await runRetention(new Date(Date.now() + 31 * DAY));
    expect(out).toMatchObject({ accountsHeld: 1 });
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toBeTruthy();
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, other.account.id) })).toBeUndefined();

    // „Evidováno jinak“ přes `seen` (cesta s PRODUCTION_QUARANTINE v UPDATE) taky projde
    const seen = { count: 2, lastAt: new Date(Date.now() + 60_000).toISOString() };
    await expect(settleElsewhere(s.account.id, { confirm: true, actor: "owner@example.cz", seen })).resolves.toEqual({ sales: 0, quarantine: 2 });
  });
});
