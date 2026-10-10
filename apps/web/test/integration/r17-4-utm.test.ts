/**
 * R17.4 (docs/tasks/2026-10-10-r17.md, DECISIONS K9) – zdroj návštěvy podle UTM.
 *  - beacon při prvním zobrazení pošle utm_source/medium/campaign; každý parametr malými písmeny, [a-z0-9._-], max. 40
 *    znaků, jinak se zahodí; server počítá metriku utm (klíč source/medium/campaign, chybějící „-“); v prohlížeči nic;
 *  - accounts.acquisition (migrace) se jednou při založení účtu vyplní z předregistrace se stejným e-mailem, jinak null;
 *  - /admin: tabulka „Мітки (UTM)“ v přehledu, v účtech sloupce „Джерело“ a „Тариф“ a souhrn podle zdroje;
 *  - zásady doslovně, PRIVACY_VERSION 2026-11-r17.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "../helpers/launch";
import { createTestDb, type TestDb } from "../helpers/test-db";

let sessionToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
  headers: async () => new Headers({ "x-real-ip": "198.51.100.71", "user-agent": "Mozilla/5.0" }),
}));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  sessionToken = null;
  (await import("@/lib/server/analytics")).__resetAnalyticsForTests();
});
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  mockLaunch("closed");
});

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
async function send(body: unknown, ip = "203.0.113.120") {
  const { POST } = await import("@/app/api/m/route");
  return POST(new Request("http://localhost/api/m", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost", "user-agent": "Mozilla/5.0 (X11; Linux) Firefox/131.0", "x-real-ip": ip }, body: JSON.stringify(body) }));
}
const utmRows = async () => (await getDb().select().from(schema.analyticsDaily)).filter((r) => r.metric === "utm").map((r) => [r.key, r.views, r.visitors]);

describe("R17.4 – UTM in the traffic stats", () => {
  it("gate: the first view with UTM counts metric utm (source/medium/campaign, missing „-“), lowercased; views and visitors", async () => {
    await send({ t: "v", p: "/", u: { s: "Instagram", m: "bio", c: "profil" } });
    await send({ t: "v", p: "/cenik", u: { s: "instagram", m: "bio", c: "profil" } });
    await send({ t: "v", p: "/", u: { s: "facebook", c: "spusteni-2026-11" } }, "203.0.113.121");
    expect((await utmRows()).sort()).toEqual([
      ["facebook/-/spusteni-2026-11", 1, 1],
      ["instagram/bio/profil", 2, 1],
    ]);
  });

  it("gate: a crooked utm_source (space, <, 41 characters) is not counted", async () => {
    for (const s of ["insta gram", "<script>", "a".repeat(41), "instagram!", ""]) await send({ t: "v", p: "/", u: { s } });
    expect(await utmRows()).toEqual([]);
    await send({ t: "v", p: "/", u: { s: "bad value", m: "bio" } });
    expect(await utmRows()).toEqual([["-/bio/-", 1, 1]]);
    const { utmKey } = await import("@/lib/server/analytics");
    expect(utmKey({ s: "a".repeat(40) })).toBe(`${"a".repeat(40)}/-/-`);
    expect(utmKey({ s: "x", m: "y", c: "z", extra: "nope" })).toBe("x/y/z");
    expect(utmKey("instagram")).toBeNull();
  });

  it("gate: the client sends only the three parameters on the first view and stores nothing", () => {
    const src = readFileSync(new URL("../../src/components/analytics-beacon.tsx", import.meta.url), "utf8");
    for (const p of ["utm_source", "utm_medium", "utm_campaign"]) expect(src).toContain(`"${p}"`);
    expect(src).toMatch(/firstView \? \{[^}]*u: /);
    expect(src).not.toMatch(/document\.cookie|localStorage|sessionStorage|indexedDB/);
  });
});

describe("R17.4 – accounts.acquisition", () => {
  const input = { name: "Kadeřnictví Jana", vatPayer: false, acceptTerms: true } as never;
  async function newUser(email: string) {
    const [u] = await getDb().insert(schema.users).values({ email }).returning();
    return { id: u!.id, email: u!.email, name: null, memberships: [] as never[] };
  }

  it("gate: a new account takes the UTM of the pre-registration with the same e-mail – once; without a pre-registration null", async () => {
    const { upsertAccount } = await import("@/lib/server/account");
    const db = getDb();
    const preAt = new Date("2026-10-12T09:00:00Z");
    await db.insert(schema.preregistrations).values({
      email: "Jana@Kadernictvi.cz",
      referralCode: "janacode",
      confirmTokenHash: "a".repeat(64),
      referredBy: "kolega01",
      utm: { utm_source: "instagram", utm_medium: "bio", utm_campaign: "profil", utm_term: "x" },
      createdAt: preAt,
    });
    const jana = await newUser("jana@kadernictvi.cz");
    await upsertAccount(jana, input);
    const [acc] = await db.select().from(schema.accounts);
    expect(acc!.acquisition).toEqual({ utm_source: "instagram", utm_medium: "bio", utm_campaign: "profil", preregistered_at: preAt.toISOString(), referred: true });
    // další uložení údajů účtu acquisition nemění
    const withAccount = { ...jana, memberships: [{ accountId: acc!.id, role: "owner" as const, accountName: acc!.name, accountKind: "business" }] };
    await db.update(schema.preregistrations).set({ utm: { utm_source: "facebook" } });
    await upsertAccount(withAccount as never, { ...(input as object), name: "Kadeřnictví Jana s.r.o." } as never);
    expect((await db.select().from(schema.accounts).where(eq(schema.accounts.id, acc!.id)))[0]!.acquisition).toMatchObject({ utm_source: "instagram" });

    const petr = await newUser("petr@example.cz");
    await upsertAccount(petr, input);
    const rows = await db.select({ email: schema.users.email, acquisition: schema.accounts.acquisition }).from(schema.accounts).innerJoin(schema.memberships, eq(schema.memberships.accountId, schema.accounts.id)).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId));
    expect(rows.find((r) => r.email === "petr@example.cz")!.acquisition).toBeNull();
  });

  it("gate: a pre-registration without UTM gives nulls, preregistered_at and referred: false", async () => {
    const { upsertAccount } = await import("@/lib/server/account");
    const preAt = new Date("2026-10-13T09:00:00Z");
    await getDb().insert(schema.preregistrations).values({ email: "bez@example.cz", referralCode: "bezcode1", confirmTokenHash: "b".repeat(64), createdAt: preAt });
    await upsertAccount(await newUser("bez@example.cz"), input);
    const [acc] = await getDb().select().from(schema.accounts);
    expect(acc!.acquisition).toEqual({ utm_source: null, utm_medium: null, utm_campaign: null, preregistered_at: preAt.toISOString(), referred: false });
  });
});

describe("R17.4 – /admin", () => {
  async function adminLogin() {
    process.env.ADMIN_EMAILS = "owner@example.cz";
    const { sha256, randomToken } = await import("@/lib/server/tokens");
    const [user] = await getDb().insert(schema.users).values({ email: "owner@example.cz" }).returning();
    sessionToken = randomToken(32);
    await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId: user!.id, expiresAt: new Date(Date.now() + 86_400_000) });
  }

  it("gate: the overview has the table „Мітки (UTM)“ – label, views, visitors", async () => {
    await adminLogin();
    const today = new Date().toISOString().slice(0, 10);
    await getDb().insert(schema.analyticsDaily).values({ day: today, metric: "utm", key: "instagram/bio/profil", views: 7, visitors: 4 });
    const { default: Overview } = await import("@/app/(admin)/admin/page");
    const h = text(renderToStaticMarkup((await Overview({ searchParams: Promise.resolve({}) } as never)) as ReactElement));
    expect(h).toContain("Мітки (UTM)");
    expect(h).toMatch(/instagram\/bio\/profil\s+7\s+4/);
  });

  it("gate: accounts (open register) – columns „Джерело“ and „Тариф“, summary by source: accounts / with a first ostrá tržba / Premium", async () => {
    await adminLogin();
    const db = getDb();
    const { seedAccount } = await import("../helpers/fixtures");
    const jana = await seedAccount({ mode: "production" });
    await db
      .update(schema.accounts)
      .set({ acquisition: { utm_source: "instagram", utm_medium: "bio", utm_campaign: "profil", preregistered_at: "2026-10-12T09:00:00.000Z", referred: false } })
      .where(eq(schema.accounts.id, jana.account.id));
    await db.insert(schema.accounts).values([
      { name: "Petr", plan: "premium", acquisition: { utm_source: "instagram", utm_medium: "story", utm_campaign: null, preregistered_at: "2026-10-12T09:00:00.000Z", referred: false } },
      { name: "Bez", acquisition: null },
    ]);
    // první ostrá tržba účtu z Instagramu
    await db.insert(schema.sales).values({
      id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f",
      accountId: jana.account.id,
      deviceId: jana.device.id,
      unitId: jana.unit.id,
      registerId: "P1",
      fsUnitId: 303,
      sequence: "P1-TEST-000001",
      soldAt: new Date("2027-01-02T10:00:00Z"),
      total: 100,
      evidencedTotal: 100,
      payments: [{ method: "cash", amount: 100 }],
      mode: "production",
      deadlineAt: new Date("2027-01-04T10:00:00Z"),
    } as never);
    mockLaunch("open");
    const { default: Accounts } = await import("@/app/(admin)/admin/ucty/page");
    const h = text(renderToStaticMarkup((await Accounts()) as ReactElement));
    expect(h).toContain("Джерело");
    expect(h).toContain("Тариф");
    expect(h).toContain("instagram / bio / profil");
    expect(h).toMatch(/instagram\s+2\s+1\s+1/);
    // sloupce z poddotazů (jednotky, certifikát, první ostrá tržba) – dřív kvůli "id" bez tabulky vždy prázdné
    expect(h).toMatch(/Kadeřnictví Test\s+12345679\s+production\s+ні\s+1\s+02\.01\.2027/);
  });
});

describe("R17.4 – privacy policy (verbatim)", () => {
  it("gate: both texts and PRIVACY_VERSION 2026-11-r17", async () => {
    const { default: Privacy } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const h = text(renderToStaticMarkup(createElement(Privacy as FC)));
    expect(h).toContain(
      "Pokud jste se předregistrovali, převezmeme z předregistrace i zdroj návštěvy (UTM) – na základě oprávněného zájmu zjistit, které cesty k nám fungují (čl. 6 odst. 1 písm. f) GDPR).",
    );
    expect(h).toContain("typ zařízení, označení kampaně z odkazu (UTM)");
    const { PRIVACY_VERSION } = await import("@/lib/legal");
    expect(PRIVACY_VERSION).toBe("2026-11-r17");
  });
});
