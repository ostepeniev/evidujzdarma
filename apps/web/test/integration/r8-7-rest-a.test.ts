/**
 * R8.7 (рецензія №5, A N12–N16) – zbytek A.
 *  - N12: po „Evidováno jinak“ přijde e-mail o další neodeslané tržbě i týž den (dedupe se po vyřízení obnoví);
 *  - N13: na účtu v ostrém provozu drží zrušený účet každá otevřená karanténa tržby z jiného režimu prodané po přepnutí,
 *    ne jen MODE_MISMATCH (FUTURE_DATE, TOO_OLD… ji schovají);
 *  - N14: EET_PRODUCTION_ACCEPTS_FROM přijme i milisekundy (toISOString); neplatná zadaná hodnota → console.error jednou;
 *  - N15: opakované odeslání už přijaté tržby (sameSale) je ok ještě před kontrolou vratky a plateb – žádná karanténa-duplikát;
 *  - N16: „Evidováno jinak“ jedním UPDATE; vyřízenou karanténu nepřepíše; u dlouhého seznamu potvrzuje počet a čas
 *    posledního přijetí místo id.
 */
import { getDb, schema } from "@ez/db";
import { and, eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPin } from "@/lib/pos/pin";
import { accountState } from "@/lib/server/account";
import { HttpError } from "@/lib/server/auth";
import { productionAcceptsFrom } from "@/lib/server/fiscal";
import { closeAccount, runRetention, settleElsewhere, unsentProductionOf, unsentView } from "@/lib/server/lifecycle";
import { ingestSales } from "@/lib/server/sales";
import { verifyStaffPinOnline } from "@/lib/server/staff-pin";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
let savedEnv: string | undefined;
beforeAll(async () => {
  t = await createTestDb();
  savedEnv = process.env.EET_PRODUCTION_ACCEPTS_FROM;
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.env.EET_PRODUCTION_ACCEPTS_FROM = savedEnv;
});

const DAY = 86_400_000;
const mails = (to: string, prefix: string) =>
  getDb()
    .select()
    .from(schema.emailOutbox)
    .where(and(eq(schema.emailOutbox.to, to), like(schema.emailOutbox.dedupeKey, `${prefix}%`)));

async function closedProduction() {
  const s = await seedAccount({ mode: "production" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  const a = deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 300_000).toISOString() });
  await ingestSales(await deviceContext(s.device.id), [a as never]);
  await closeAccount(s.account.id, { confirm: true });
  return { s, a };
}

describe("R8.7 – rest of A", () => {
  it("gate N12 (S1): after 'Evidováno jinak' a sale delivered the same day e-mails the owner again", async () => {
    const { s } = await closedProduction();
    const ctx = await deviceContext(s.device.id);
    await ingestSales(ctx, [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 200_000).toISOString() }) as never]);
    expect(await mails(s.user.email, "closed-unsent:")).toHaveLength(1);
    await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, ids: unsentView(await unsentProductionOf(s.account.id)).ids });
    const c = deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 100_000).toISOString() });
    expect((await ingestSales(ctx, [c as never]))[0]).toMatchObject({ ok: true, inserted: true });
    expect(await mails(s.user.email, "closed-unsent:")).toHaveLength(2);
    // bez dalšího vyřízení týž den už ne
    await ingestSales(ctx, [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 90_000).toISOString() }) as never]);
    expect(await mails(s.user.email, "closed-unsent:")).toHaveLength(2);
  });

  it("gate N13 (S2): a stale-config mock sale with FUTURE_DATE on a production account holds the closed account", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const x = deviceSale(s.unit.id, { mode: "mock", soldAt: new Date(Math.floor((Date.now() + 15 * 60_000) / 1000) * 1000).toISOString() });
    expect((await ingestSales(await deviceContext(s.device.id), [x as never]))[0]).toMatchObject({ quarantined: true, code: "FUTURE_DATE" });
    expect((await unsentProductionOf(s.account.id)).quarantine).toHaveLength(1);
    await closeAccount(s.account.id, { confirm: true });
    const [day0] = await mails(s.user.email, "closed-summary:");
    expect(String((day0!.payload as { text: string }).text)).toMatch(/1× tržba v karanténě/);
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 1 });
  });

  it("control N13: a mock sale sold before the switch to production does not hold the account", async () => {
    const s = await seedAccount({ mode: "production" });
    await getDb().update(schema.accounts).set({ eetModeChangedAt: new Date(Date.now() - 60_000) }).where(eq(schema.accounts.id, s.account.id));
    // prodej před přepnutím, ale neznámá jednotka → karanténa (ne MODE_MISMATCH)
    const x = deviceSale(s.unit.id, { mode: "mock", soldAt: new Date(Date.now() - 3_600_000).toISOString(), unitId: crypto.randomUUID() });
    expect((await ingestSales(await deviceContext(s.device.id), [x as never]))[0]).toMatchObject({ quarantined: true, code: "UNKNOWN_UNIT" });
    expect((await unsentProductionOf(s.account.id)).quarantine).toHaveLength(0);
  });

  it("gate N14 (S3): a postponed date with milliseconds is accepted; an invalid set value is reported once", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EET_PRODUCTION_ACCEPTS_FROM = new Date("2027-01-01T00:00:00+01:00").toISOString(); // 2026-12-31T23:00:00.000Z
    expect(productionAcceptsFrom()).toBe(Date.parse("2027-01-01T00:00:00+01:00"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.EET_PRODUCTION_ACCEPTS_FROM = "1";
    expect(productionAcceptsFrom()).toBe(Date.parse("2026-11-01T00:00:00+01:00"));
    productionAcceptsFrom();
    productionAcceptsFrom();
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0]![0])).toMatch(/EET_PRODUCTION_ACCEPTS_FROM/);
    expect(JSON.stringify(err.mock.calls[0])).not.toContain('"1"');
  });

  it("gate N15 (S4): re-sending an already accepted cross-mode refund is ok, no duplicate in quarantine", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "playground");
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
    const orig = deviceSale(s.unit.id, { mode: "playground", soldAt: new Date(Date.now() - 3_600_000).toISOString() });
    await ingestSales(await deviceContext(s.device.id), [orig as never]);
    await getDb().update(schema.accounts).set({ eetMode: "production", eetModeChangedAt: new Date(Date.now() - 60_000) }).where(eq(schema.accounts.id, s.account.id));
    const ctx = await deviceContext(s.device.id);
    const approval = (await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: orig.id, amount: 35000 })).approval!;
    const x = deviceSale(s.unit.id, { mode: "production", lines: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "cash", amount: -35000 }], refundOf: orig.id, staffId: s.owner.id, approval });
    // stav jako před R7.13: vratka už v sales (přijatá starým serverem)
    await getDb().insert(schema.sales).values({
      id: x.id,
      accountId: s.account.id,
      deviceId: s.device.id,
      unitId: s.unit.id,
      registerId: "P1",
      fsUnitId: 303,
      sequence: x.sequence as string,
      soldAt: new Date(x.soldAt as string),
      total: -35000,
      payments: [{ method: "cash", amount: -35000 }],
      items: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }],
      refundOf: orig.id,
      evidencedTotal: -35000,
      mode: "production",
      deadlineAt: new Date(Date.now() + 2 * DAY),
    });
    const [r] = await ingestSales(ctx, [x as never]);
    expect(r).toMatchObject({ ok: true, inserted: false });
    expect(await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, x.id) })).toBeUndefined();
  });

  it("control N15: a new cross-mode refund is still quarantined", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
    const orig = deviceSale(s.unit.id, { mode: "playground", soldAt: new Date(Date.now() - 3_600_000).toISOString() });
    await ingestSales(await deviceContext(s.device.id), [orig as never]);
    await getDb().update(schema.accounts).set({ eetMode: "production", eetModeChangedAt: new Date(Date.now() - 60_000) }).where(eq(schema.accounts.id, s.account.id));
    const ctx = await deviceContext(s.device.id);
    const approval = (await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: orig.id, amount: 35000 })).approval!;
    const x = deviceSale(s.unit.id, { mode: "production", lines: [{ name: "Střih", qty: -1, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "cash", amount: -35000 }], refundOf: orig.id, staffId: s.owner.id, approval });
    expect((await ingestSales(ctx, [x as never]))[0]).toMatchObject({ quarantined: true, code: "REFUND_MODE_MISMATCH" });
  });

  it("gate N16: a quarantine resolved meanwhile is not overwritten to 'dismissed'", async () => {
    const { s } = await closedProduction();
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 60_000).toISOString(), unitId: crypto.randomUUID() }) as never]);
    const view = unsentView(await unsentProductionOf(s.account.id));
    expect(view.quarantine).toBe(1);
    const qid = view.ids!.find((id) => id !== view.sales[0]!.id)!;
    const db = getDb();
    const orig = db.transaction.bind(db);
    vi.spyOn(db, "transaction").mockImplementationOnce((async (fn: never) => {
      // jiná karta: vlastník karanténu mezitím vyřídil přijetím
      await db.update(schema.saleQuarantine).set({ resolution: "ingested", resolvedAt: new Date() }).where(eq(schema.saleQuarantine.id, qid));
      return orig(fn);
    }) as never);
    const out = await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, ids: view.ids });
    expect(out).toEqual({ sales: 1, quarantine: 0 });
    expect((await db.query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, qid) }))!.resolution).toBe("ingested");
  });

  it("gate N16: a long list is confirmed by count and last arrival instead of ids; a later arrival → 409", async () => {
    const { s } = await closedProduction();
    const base = Date.now() - 3_600_000;
    await getDb()
      .insert(schema.sales)
      .values(
        Array.from({ length: 30 }, (_, i) => ({
          id: crypto.randomUUID(),
          accountId: s.account.id,
          deviceId: s.device.id,
          unitId: s.unit.id,
          registerId: "P1",
          fsUnitId: 303,
          sequence: `BULK-${i}`,
          soldAt: new Date(base + i * 1000),
          total: 10000,
          payments: [{ method: "cash", amount: 10000 }],
          evidencedTotal: 10000,
          mode: "production",
          deadlineAt: new Date(base + 2 * DAY),
        })),
      );
    const user = { id: s.user.id, email: s.user.email, memberships: [{ role: "owner", accountKind: "business", accountId: s.account.id }] } as never;
    const closure = ((await accountState(user)) as unknown as { closure: { unsentProduction: number; unsentSales: unknown[]; unsentSeen: { count: number; lastAt: string } } }).closure;
    expect(closure.unsentProduction).toBe(31);
    expect(closure.unsentSales.length).toBeLessThanOrEqual(20);
    expect(closure.unsentSeen.count).toBe(31);

    // pokladna mezitím doveze další → potvrzení počtu neplatí
    const late = deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 120_000).toISOString() });
    await ingestSales(await deviceContext(s.device.id), [late as never]);
    const err = (await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, seen: closure.unsentSeen }).catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(409);
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, late.id) }).then((r) => r!.settledElsewhereAt)).toBeNull();

    const fresh = ((await accountState(user)) as unknown as { closure: { unsentSeen: { count: number; lastAt: string } } }).closure.unsentSeen;
    const out = await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, seen: fresh });
    expect(out).toEqual({ sales: 32, quarantine: 0 });
    const audit = await getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.code, "EVIDENCED_ELSEWHERE"));
    expect(audit).toHaveLength(32);
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 0 });
  });

  it("a dedupe key longer than the column is shortened deterministically – a long owner address does not break the quarantine mail", async () => {
    const { fitDedupeKey } = await import("@/lib/server/mail");
    const short = "quarantine:abc:2026-10-03T10:jan@example.cz";
    expect(fitDedupeKey(short)).toBe(short);
    const long = (to: string) => `closed-unsent:${"0".repeat(36)}:2026-10-03:1791047056259:${to}`;
    const a = fitDedupeKey(long(`${"a".repeat(90)}@example.cz`));
    expect(a.length).toBeLessThanOrEqual(128);
    expect(fitDedupeKey(long(`${"a".repeat(90)}@example.cz`))).toBe(a);
    expect(fitDedupeKey(long(`${"b".repeat(90)}@example.cz`))).not.toBe(a);

    const s = await seedAccount({ mode: "mock" });
    const owner = `${"o".repeat(100)}@example.cz`;
    await getDb().update(schema.users).set({ email: owner }).where(eq(schema.users.id, s.user.id));
    const [r] = await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { unitId: crypto.randomUUID() }) as never]);
    expect(r).toMatchObject({ quarantined: true, code: "UNKNOWN_UNIT" });
    expect(await mails(owner, "quarantine:")).toHaveLength(1);
  });
});
