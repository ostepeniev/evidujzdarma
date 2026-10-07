/**
 * Рецензія №6:
 *  - R9.2 (A2) – „Evidováno jinak“ přes `seen` porovnával received_at/updated_at (mikrosekundy z now() na PG16) s časem
 *    z JS Date (milisekundy): nejnovější řádek „byl později“ a vlastník musel potvrzovat dvakrát. Nově
 *    date_trunc('milliseconds', …) <= lastSeen.
 *  - R9.5 (A5) – Math.max(0, ...rows) padal na RangeError zhruba od 120 tis. řádků.
 *  - R9.6 (A6) – dedupe klíč „closed-unsent“ skládal čas z max(...)::text a replace-ů; závisel na DateStyle a TimeZone,
 *    při nezdaru vznikl klíč „NaN“ a denní dedupe se po „Evidováno jinak“ už nikdy neobnovil. Nově extract(epoch …).
 */
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { and, eq, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accountState } from "@/lib/server/account";
import { closeAccount, settleElsewhere, unsentProductionOf, unsentView } from "@/lib/server/lifecycle";
import { ingestSales } from "@/lib/server/sales";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const DAY = 86_400_000;
const ts = (iso: string) => sql`${iso}::timestamptz`;

async function closedProductionWithMicroseconds() {
  const s = await seedAccount({ mode: "production" });
  await closeAccount(s.account.id, { confirm: true });
  const base = Date.now() - 3_600_000;
  const micro = (i: number) => `${new Date(base + i * 1000).toISOString().slice(0, 23)}${String(100 + i).padStart(3, "0")}Z`;
  await getDb()
    .insert(schema.sales)
    .values(
      Array.from({ length: 3 }, (_, i) => ({
        id: randomUUID(),
        accountId: s.account.id,
        deviceId: s.device.id,
        unitId: s.unit.id,
        registerId: "P1",
        fsUnitId: 303,
        sequence: `MICRO-${i}`,
        soldAt: new Date(base + i * 1000),
        total: 10000,
        payments: [{ method: "cash", amount: 10000 }],
        evidencedTotal: 10000,
        mode: "production" as const,
        deadlineAt: new Date(base + 2 * DAY),
        // explicitní timestamptz se 6 desetinnými místy, jako z now() na PG16
        receivedAt: ts(micro(i)) as never,
      })),
    );
  const qid = randomUUID();
  await getDb()
    .insert(schema.saleQuarantine)
    .values({
      id: qid,
      accountId: s.account.id,
      deviceId: s.device.id,
      payload: { ...deviceSale(s.unit.id, { id: qid }), mode: "production" },
      reasonCode: "FUTURE_DATE",
      reason: "test",
      receivedAt: ts(micro(3)) as never,
      updatedAt: ts(micro(4)) as never,
    });
  return s;
}

const ownerOf = (s: Awaited<ReturnType<typeof seedAccount>>) =>
  ({ id: s.user.id, email: s.user.email, memberships: [{ role: "owner", accountKind: "business", accountId: s.account.id }] }) as never;

describe("R9.2 / R9.5 / R9.6 – settle-elsewhere precision", () => {
  it("gate R9.2: rows stored with microseconds – one 'Evidováno jinak' by `seen` closes all of them", async () => {
    const s = await closedProductionWithMicroseconds();
    const seen = ((await accountState(ownerOf(s))) as unknown as { closure: { unsentSeen: { count: number; lastAt: string } } }).closure.unsentSeen;
    expect(seen.count).toBe(4);
    expect(await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, seen })).toEqual({ sales: 3, quarantine: 1 });
    const left = await unsentProductionOf(s.account.id);
    expect(left.sales.length + left.quarantine.length).toBe(0);
  });

  it("gate R9.5: unsentView handles 200 000 rows without RangeError and still finds the latest arrival", () => {
    const base = Date.parse("2026-10-07T08:00:00Z");
    const sales = Array.from({ length: 200_000 }, (_, i) => ({ id: `s${i}`, soldAt: new Date(base), total: 1, registerId: "P1", sequence: `${i}`, receivedAt: new Date(base + i) }));
    const quarantine = [{ id: "q", payload: {}, updatedAt: new Date(base + 5) }];
    const view = unsentView({ sales, quarantine } as never);
    expect(view.seen).toEqual({ count: 200_001, lastAt: new Date(base + 199_999).toISOString() });
    expect(view.ids).toBeNull();
    expect(unsentView({ sales: [], quarantine: [] }).seen).toEqual({ count: 0, lastAt: null });
  });

  it("gate R9.6: the closed-unsent dedupe key does not depend on DateStyle/TimeZone and is never NaN", async () => {
    const s = await closedProductionWithMicroseconds();
    const seen = ((await accountState(ownerOf(s))) as unknown as { closure: { unsentSeen: { count: number; lastAt: string } } }).closure.unsentSeen;
    await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, seen });
    const keys = async () =>
      (await getDb().select({ k: schema.emailOutbox.dedupeKey }).from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, s.user.email), like(schema.emailOutbox.dedupeKey, "closed-unsent:%")))).map(
        (r) => r.k!,
      );
    const db = getDb();
    try {
      await db.execute(sql`set DateStyle = 'SQL, DMY'`);
      await db.execute(sql`set TimeZone = 'America/New_York'`);
      await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 60_000).toISOString() }) as never]);
    } finally {
      await db.execute(sql`reset DateStyle`);
      await db.execute(sql`reset TimeZone`);
    }
    const [key] = await keys();
    expect(key).toBeTruthy();
    expect(key).not.toMatch(/NaN/);
    // čas posledního „Evidováno jinak“ v ms – tentýž jako v ISO zápisu, ať je nastavení relace jakékoli
    const [{ at }] = (await db
      .select({ at: sql<string>`floor(extract(epoch from max(${schema.sales.settledElsewhereAt})) * 1000)::bigint::text` })
      .from(schema.sales)
      .where(eq(schema.sales.accountId, s.account.id))) as [{ at: string }];
    expect(key).toContain(`:${at}:`);
  });
});
