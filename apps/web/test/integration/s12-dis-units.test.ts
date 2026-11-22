/**
 * S12 (22. 11. 2026) – CSV pro hromadný import evidenčních jednotek do DIS+: nové nepovinné údaje jednotky (migrace 0042)
 * se ukládají přes /api/ucet/jednotky, export z účtu i z Účetního kabinetu (jen propojený klient), 422 se seznamem toho,
 * co doplnit, výchozí jen jednotky bez čísla z DIS+.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let sessionToken: string | null = null;
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
  headers: async () => new Headers({ "x-real-ip": "198.51.100.62", "user-agent": "Mozilla/5.0" }),
}));

const { sha256, randomToken } = await import("@/lib/server/tokens");
const { POST: unitPOST } = await import("@/app/api/ucet/jednotky/route");
const { PATCH: unitPATCH } = await import("@/app/api/ucet/jednotky/[id]/route");
const { GET: ucetCsv } = await import("@/app/api/ucet/export/dis-jednotky/route");
const { GET: kabinetCsv } = await import("@/app/api/kabinet/export/dis-jednotky/route");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  sessionToken = null;
});

async function login(userId: string) {
  sessionToken = randomToken(24);
  await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId, expiresAt: new Date(Date.now() + 3_600_000) });
}

const get = (h: (r: Request, c: { params: Promise<object> }) => Promise<Response>, path: string) => h(new Request(`http://localhost${path}`), { params: Promise.resolve({}) });
const json = (h: (r: Request, c: { params: Promise<any> }) => Promise<Response>, method: string, path: string, body: unknown, params: object = {}) =>
  h(new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify(body) }), { params: Promise.resolve(params) });

describe("S12 – unit fields for DIS+ and the CSV export", () => {
  it("gate: new unit fields are stored (CZ-NACE without dots, RÚIAN digits) and validated", async () => {
    const s = await seedAccount();
    await login(s.user.id);
    const res = await json(unitPOST, "POST", "/api/ucet/jednotky", {
      type: "mobilni_provozovna",
      label: "Stánek na trhu",
      czNace: "47.81",
      locationText: "Tržiště Karlovy Vary, Tržní náměstí",
      indirectRepresentation: true,
    });
    expect(res.status).toBe(200);
    const { unit } = (await res.json()) as { unit: typeof schema.evidenceUnits.$inferSelect };
    expect(unit.czNace).toBe("4781");
    expect(unit.locationText).toBe("Tržiště Karlovy Vary, Tržní náměstí");
    expect(unit.indirectRepresentation).toBe(true);
    const bad = await json(unitPATCH, "PATCH", `/api/ucet/jednotky/${s.unit.id}`, { ruianCode: "12a" }, { id: s.unit.id });
    expect(bad.status).toBe(400);
    const ok = await json(unitPATCH, "PATCH", `/api/ucet/jednotky/${s.unit.id}`, { ruianCode: "21753237", czNace: "9602" }, { id: s.unit.id });
    expect(ok.status).toBe(200);
    const row = await getDb().query.evidenceUnits.findFirst({ where: eq(schema.evidenceUnits.id, s.unit.id) });
    expect(row).toMatchObject({ ruianCode: "21753237", czNace: "9602", fsUnitId: 303, label: "Salon" });
  });

  it("gate: owner export – only units without a DIS+ number by default, 422 lists what is missing, then a valid file", async () => {
    const s = await seedAccount();
    await login(s.user.id);
    // seedovaná jednotka má číslo z DIS+ → výchozí export nemá co exportovat
    expect((await get(ucetCsv, "/api/ucet/export/dis-jednotky")).status).toBe(404);
    const [u] = await getDb().insert(schema.evidenceUnits).values({ accountId: s.account.id, type: "stala_provozovna", label: "Pobočka", address: "Masarykova 12, 360 01 Karlovy Vary" }).returning();
    const missing = await get(ucetCsv, "/api/ucet/export/dis-jednotky");
    expect(missing.status).toBe(422);
    const body = (await missing.json()) as { error: string; units: { label: string; problems: string[] }[] };
    expect(body.units.map((x) => x.label)).toEqual(["Pobočka"]);
    expect(body.units[0]!.problems.join(" ")).toMatch(/CZ-NACE/);
    await getDb().update(schema.evidenceUnits).set({ czNace: "9602" }).where(eq(schema.evidenceUnits.id, u!.id));
    const ok = await get(ucetCsv, "/api/ucet/export/dis-jednotky");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(ok.headers.get("content-disposition")).toMatch(/^attachment; filename="dis-jednotky-12345679-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(await ok.text()).toBe("Pobočka;S;9602;;1;0;;Masarykova;12;;Karlovy Vary;;36001;;;\r\n");
    // ?vse=1 přidá i jednotku s číslem z DIS+ – té chybí CZ-NACE i adresa
    const all = await get(ucetCsv, "/api/ucet/export/dis-jednotky?vse=1");
    expect(all.status).toBe(422);
    expect(((await all.json()) as { units: { label: string }[] }).units.map((x) => x.label)).toEqual(["Salon"]);
  });

  it("gate: cabinet export only for a linked client; the business owner has no cabinet", async () => {
    const db = getDb();
    const s = await seedAccount();
    await db.update(schema.evidenceUnits).set({ fsUnitId: null, czNace: "9602", ruianCode: "21753237" }).where(eq(schema.evidenceUnits.id, s.unit.id));
    const [user] = await db.insert(schema.users).values({ email: `ucetni-${randomToken(6)}@example.cz` }).returning();
    const [acc] = await db.insert(schema.accounts).values({ kind: "accountant", name: "Účetní s.r.o.", plan: "partner" }).returning();
    await db.insert(schema.memberships).values({ accountId: acc!.id, userId: user!.id, role: "owner" });
    await db.insert(schema.accountantClients).values([
      { accountantAccountId: acc!.id, ico: "12345679", clientAccountId: s.account.id },
      { accountantAccountId: acc!.id, ico: "27074358" },
    ]);
    await login(user!.id);
    const ok = await get(kabinetCsv, "/api/kabinet/export/dis-jednotky?klient=12345679");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("Salon;S;9602;;1;0;21753237;;;;;;;;;\r\n");
    expect((await get(kabinetCsv, "/api/kabinet/export/dis-jednotky?klient=27074358")).status).toBe(404);
    await login(s.user.id);
    expect((await get(kabinetCsv, "/api/kabinet/export/dis-jednotky?klient=12345679")).status).toBe(403);
  });
});
