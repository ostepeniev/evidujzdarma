/**
 * R4 – připomínky a upozornění (A r2 Д-7; A r1 Дрібне 13, 15).
 *  - Д-7: „stuck“ jen před koncem lhůty a nejvýš jednou za 6 h; po lhůtě a karanténa – v denním přehledu.
 *  - Дрібне 15: upozornění FS (Varovani) vlastník uvidí (seznam i denní přehled).
 *  - Дрібне 13: ověřovací odeslání má limit; v ukázkovém režimu je výsledek výslovně simulovaný.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/server/auth";
import { verifyEnvironment } from "@/lib/server/certificates";
import { __setTransportFactoryForTests, salesWithWarnings } from "@/lib/server/fiscal";
import { runReminders } from "@/lib/server/reminders";
import { ingestSales } from "@/lib/server/sales";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const H = 3_600_000;
/** dnešek dopoledne pražského času – denní přehled chodí od 7:00 (Praha) */
const daytime = () => new Date(`${new Date().toISOString().slice(0, 10)}T08:30:00Z`);
const mails = (to: string) => getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, to));
const text = (m: { payload: unknown }) => String((m.payload as { text?: string }).text);

async function queuedSale(over: Record<string, unknown> = {}) {
  const s = await seedAccount({ mode: "mock" });
  const sale = deviceSale(s.unit.id);
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  await getDb().update(schema.sales).set({ status: "queued", confirmationCode: null, ...over }).where(eq(schema.sales.id, sale.id));
  return { s, sale };
}

describe("Д-7 – reminders are capped", () => {
  it("gate: a sale past its deadline does not trigger an hourly 'stuck' e-mail; it is in the daily digest once", async () => {
    const day = new Date("2026-10-05T07:10:00Z");
    const { s } = await queuedSale({ deadlineAt: new Date(day.getTime() - 3 * 24 * H) });
    for (let i = 0; i < 5; i++) await runReminders(new Date(day.getTime() + i * H));
    const m = await mails(s.user.email);
    expect(m.filter((x) => x.dedupeKey?.startsWith("stuck:"))).toHaveLength(0);
    const digest = m.filter((x) => x.dedupeKey?.startsWith("attention:"));
    expect(digest).toHaveLength(1);
    expect(text(digest[0]!)).toMatch(/po lhůtě/);
  });

  it("gate: before the deadline the 'stuck' e-mail comes at most once per 6 hours", async () => {
    const day = new Date("2026-10-05T07:10:00Z");
    const { s } = await queuedSale({ deadlineAt: new Date(day.getTime() + 10 * H) });
    for (let i = 0; i < 4; i++) await runReminders(new Date(day.getTime() + i * H)); // 7:10 … 10:10 – jedno okno 6–12 h
    expect((await mails(s.user.email)).filter((x) => x.dedupeKey?.startsWith("stuck:"))).toHaveLength(1);
  });

  it("the daily digest is not sent at night (Prague time), but in the morning", async () => {
    const { s } = await queuedSale({ blockedReason: "CERT_MISSING" });
    await runReminders(new Date("2026-10-05T01:30:00Z")); // 3:30 v Praze
    expect((await mails(s.user.email)).filter((x) => x.dedupeKey?.startsWith("attention:"))).toHaveLength(0);
    await runReminders(new Date("2026-10-05T05:30:00Z")); // 7:30 v Praze
    expect((await mails(s.user.email)).filter((x) => x.dedupeKey?.startsWith("attention:"))).toHaveLength(1);
  });

  it("gate: an open quarantine is part of the daily digest", async () => {
    const s = await seedAccount({ mode: "mock" });
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { soldAt: new Date(Date.now() + 11 * 60_000).toISOString() }) as never]);
    await runReminders(daytime());
    const digest = (await mails(s.user.email)).filter((x) => x.dedupeKey?.startsWith("attention:"));
    expect(digest).toHaveLength(1);
    expect(text(digest[0]!)).toMatch(/karanténě/);
  });
});

describe("Дрібне 15 – FS warnings (Varovani) reach the owner", () => {
  it("gate: a confirmed sale with a warning is listed and mentioned in the daily digest", async () => {
    const { s, sale } = await queuedSale();
    const warnings = [{ code: 5, text: "Datum a cas prijeti trzby je vyrazne v minulosti" }];
    await getDb().update(schema.sales).set({ status: "confirmed", confirmationCode: "11111111-2222-4333-8444-555555555555-ff", warnings, sentAt: new Date() }).where(eq(schema.sales.id, sale.id));
    expect(await salesWithWarnings(s.account.id)).toEqual([expect.objectContaining({ id: sale.id, warnings })]);
    await runReminders(daytime());
    const digest = (await mails(s.user.email)).filter((x) => x.dedupeKey?.startsWith("attention:"));
    expect(digest).toHaveLength(1);
    expect(text(digest[0]!)).toMatch(/upozornění/);
  });
});

describe("Дрібне 13 – verification sends", () => {
  it("gate: mock verification says it is simulated; repeated sends are rate limited", async () => {
    const s = await seedAccount({ mode: "playground" });
    __setTransportFactoryForTests(fakeTransports().factory);
    const mock = await verifyEnvironment(s.account.id, s.unit.id, "mock");
    expect(mock).toMatchObject({ ok: true, mode: "mock", simulated: true });
    let limited: unknown = null;
    for (let i = 0; i < 10 && !limited; i++) {
      await verifyEnvironment(s.account.id, s.unit.id, "mock").catch((e: unknown) => {
        limited = e;
      });
    }
    expect(limited).toBeInstanceOf(HttpError);
    expect((limited as HttpError).status).toBe(429);
  });
});
