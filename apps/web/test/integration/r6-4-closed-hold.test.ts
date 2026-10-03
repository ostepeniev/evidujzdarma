/**
 * R6.4 (рецензія №3, B В3-3; rozhodnutí Б7) – utržení zrušeného účtu má konec.
 *  - Účet s neodeslanými ostrými tržbami (v sales nebo v otevřené karanténě) držíme nejdéle 60 dnů od zrušení.
 *  - Pokladny zrušeného účtu se odpojí po 30 dnech, i když se účet ještě drží.
 *  - Po zrušení jen tři souhrnné e-maily (den 0, 30, 55); denní „attention“ pro zrušené účty nechodí.
 *  - „Evidováno jinak“: vlastník označí neodeslané ostré tržby za vyřízené (s potvrzením, do auditu) a držení končí.
 */
import { getDb, schema } from "@ez/db";
import { and, eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, authenticateDevice } from "@/lib/server/auth";
import { closeAccount, runRetention, settleElsewhere } from "@/lib/server/lifecycle";
import { runReminders } from "@/lib/server/reminders";
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
afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;
/** dopoledne pražského času, `days` dní od teď (denní přehled chodí od 7:00) */
const morning = (days: number) => {
  const d = new Date(Date.now() + days * DAY);
  return new Date(`${d.toISOString().slice(0, 10)}T08:30:00Z`);
};
const account = (id: string) => getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, id) });

async function heldAccount() {
  const s = await seedAccount({ mode: "production" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  const sale = deviceSale(s.unit.id, { mode: "production" });
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  await closeAccount(s.account.id, { confirm: true });
  return { s, sale };
}

describe("R6.4 – the hold of a closed account ends", () => {
  it("gate: a held account is deleted 60 days after closing", async () => {
    const { s } = await heldAccount();
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 1 });
    expect(await account(s.account.id)).toBeTruthy();
    await runRetention(new Date(Date.now() + 61 * DAY));
    expect(await account(s.account.id)).toBeUndefined();
  });

  it("gate: a device of a closed account gets 401 after 30 days (and retention revokes it)", async () => {
    const { s } = await heldAccount();
    const token = "t".repeat(40);
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    const req = () => new Request("http://localhost/api/pokladna/config", { headers: { authorization: `Bearer ${token}` } });
    await expect(authenticateDevice(req(), { allowClosed: true })).resolves.toBeTruthy();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 31 * DAY));
    const err = (await authenticateDevice(req(), { allowClosed: true }).catch((e: unknown) => e)) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
    await runRetention(new Date());
    expect((await getDb().query.devices.findFirst({ where: eq(schema.devices.id, s.device.id) }))!.revokedAt).not.toBeNull();
  });

  it("gate: runReminders sends no daily attention digest for a closed account", async () => {
    const { s } = await heldAccount();
    await getDb().update(schema.sales).set({ blockedReason: "CERT_MISSING" }).where(eq(schema.sales.accountId, s.account.id));
    for (const d of [1, 2, 3]) await runReminders(morning(d));
    const digests = await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, s.user.email), like(schema.emailOutbox.dedupeKey, "attention:%")));
    expect(digests).toHaveLength(0);
  });

  it("only three summary e-mails after closing: day 0, 30 and 55, each with the export link and the unsent list", async () => {
    const { s } = await heldAccount();
    for (const d of [1, 10, 30, 31, 40, 55, 56, 59]) await runReminders(morning(d));
    const mails = await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, s.user.email), like(schema.emailOutbox.dedupeKey, "closed-summary:%")));
    expect(mails.map((m) => m.dedupeKey!.split(":")[2]).sort()).toEqual(["0", "30", "55"]);
    for (const m of mails) {
      const p = m.payload as { text: string; url: string };
      expect(p.url).toMatch(/#export$/);
      expect(p.text).toMatch(/neodeslan/i);
    }
  });

  it("gate: 'Evidováno jinak' ends the hold (confirmation required, audited)", async () => {
    const { s, sale } = await heldAccount();
    // i produkční tržba v otevřené karanténě
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 60_000).toISOString(), unitId: crypto.randomUUID() }) as never]);
    await expect(settleElsewhere(s.account.id, { confirm: false, actor: s.user.email })).rejects.toBeInstanceOf(HttpError);
    const out = await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email });
    expect(out).toMatchObject({ sales: 1, quarantine: 1 });
    const audit = await getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, sale.id));
    expect(audit.some((a) => a.code === "EVIDENCED_ELSEWHERE" && a.message!.includes(s.user.email))).toBe(true);
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 0 });
    expect(await account(s.account.id)).toBeUndefined();
  });

  it("'Evidováno jinak' is only for a closed account", async () => {
    const s = await seedAccount({ mode: "production" });
    const err = (await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email }).catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(400);
  });
});

describe("R6.4 – legal texts say what the code does (invariant 10)", () => {
  it("privacy policy and terms 10.2 / 11.3 name the 60-day exception; versions are bumped", async () => {
    const { readFileSync } = await import("node:fs");
    const zasady = readFileSync(new URL("../../src/app/(site)/ochrana-osobnich-udaju/page.tsx", import.meta.url), "utf8");
    const podminky = readFileSync(new URL("../../src/app/(site)/podminky/page.tsx", import.meta.url), "utf8");
    expect(zasady).toMatch(/nejdéle 60 dnů od zrušení/);
    expect(podminky).toMatch(/10\.2[\s\S]{0,200}nejdéle 60 dnů/);
    expect(podminky).toMatch(/11\.3[\s\S]{0,900}nejdéle 60 dnů od zrušení/);
    expect(podminky).not.toMatch(/automaticky nesmaže/);
    const { TERMS_VERSION, PRIVACY_VERSION } = await import("@/lib/legal");
    expect(TERMS_VERSION > "2026-10-02").toBe(true);
    expect(PRIVACY_VERSION > "2026-10-03").toBe(true);
  });
});
