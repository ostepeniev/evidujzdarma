/**
 * S11 – doporučená nastavení: stálý kód kanceláře, ?ref= v poptávce (/api/poptavka → service_orders), tabulka a odměna
 * v kabinetu (200 Kč za „hotovo“ u Nastavení na klíč), stav mění jen správce, retence záznamů poptávek, export do Pohody
 * z kabinetu jen pro propojeného klienta a z účtu jen ostré tržby. Marketingový souhlas ve formuláři pro účetní jen
 * se zaškrtnutým polem.
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
  headers: async () => new Headers({ "x-real-ip": "198.51.100.61", "user-agent": "Mozilla/5.0" }),
}));

const { sha256, randomToken } = await import("@/lib/server/tokens");
const { POST: poptavka } = await import("@/app/api/poptavka/route");
const { GET: kabinetGET } = await import("@/app/api/kabinet/route");
const { GET: kabinetPohoda } = await import("@/app/api/kabinet/export/pohoda/route");
const { GET: ucetPohoda } = await import("@/app/api/ucet/export/pohoda/route");
const { POST: adminStatus } = await import("@/app/api/admin/nastaveni/[id]/route");
const { POST: preregistrace } = await import("@/app/api/preregistrace/route");
const { ensurePartnerCode, referredOrders, setServiceOrderStatus } = await import("@/lib/server/service-orders");
const { runRetention } = await import("@/lib/server/lifecycle");

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

async function accountant(name = "Účetní Nováková s.r.o.") {
  const db = getDb();
  const [user] = await db.insert(schema.users).values({ email: `ucetni-${randomToken(6)}@example.cz` }).returning();
  const [acc] = await db.insert(schema.accounts).values({ kind: "accountant", name, plan: "partner" }).returning();
  await db.insert(schema.memberships).values({ accountId: acc!.id, userId: user!.id, role: "owner" });
  return { user: user!, acc: acc! };
}

let ipSeq = 0;
const order = (body: Record<string, unknown>) =>
  poptavka(new Request("http://localhost/api/poptavka", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.61.${++ipSeq % 250}.1` }, body: JSON.stringify(body) }));
const orders = () => getDb().select().from(schema.serviceOrders);
const get = (h: (r: Request, c: { params: Promise<object> }) => Promise<Response>, path: string) => h(new Request(`http://localhost${path}`), { params: Promise.resolve({}) });

describe("S11 – accountant partner code and referred setup orders", () => {
  it("gate: the code is created once, stable, [a-z0-9]{8}, unique per office", async () => {
    const a = await accountant();
    const b = await accountant("Druhá kancelář");
    const c1 = await ensurePartnerCode(a.acc.id);
    expect(c1).toMatch(/^[a-z0-9]{8}$/);
    expect(await ensurePartnerCode(a.acc.id)).toBe(c1);
    expect(await ensurePartnerCode(b.acc.id)).not.toBe(c1);
    const biz = await seedAccount();
    await expect(ensurePartnerCode(biz.account.id)).rejects.toThrow();
  });

  it("gate: an order with a valid ref is stored with the office; the operator e-mail names it; the customer gets nothing", async () => {
    const a = await accountant();
    const code = await ensurePartnerCode(a.acc.id);
    const res = await order({ email: "Klient@Example.cz", ico: "27074358", establishments: "2", ref: code });
    expect(res.status).toBe(200);
    const [row] = await orders();
    expect(row).toMatchObject({ package: "nastaveni", email: "klient@example.cz", ico: "27074358", establishments: 2, referrerAccountId: a.acc.id, refCode: code, status: "zadano" });
    const mails = await getDb().select().from(schema.emailOutbox);
    expect(mails).toHaveLength(1);
    expect((mails[0]!.payload as { text: string }).text).toContain(`Doporučila účetní kancelář: Účetní Nováková s.r.o. (kód ${code})`);
  });

  it("gate: an unknown or malformed ref is ignored (order still accepted, no office); the same order twice a day is stored once", async () => {
    expect((await order({ email: "a@example.cz", ref: "neexistuje" })).status).toBe(200);
    expect((await order({ email: "b@example.cz", ref: "<script>" })).status).toBe(200);
    expect((await order({ email: "b@example.cz", ref: "<script>" })).status).toBe(200);
    const rows = await orders();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.referrerAccountId === null && r.refCode === null)).toBe(true);
  });

  it("gate: the cabinet shows referred orders with status and 200 Kč per completed setup only; no customer e-mail", async () => {
    const a = await accountant();
    const code = await ensurePartnerCode(a.acc.id);
    await order({ email: "k1@example.cz", ico: "27074358", ref: code });
    await order({ email: "k2@example.cz", ref: code });
    await order({ package: "pripojeni", email: "k3@example.cz", ref: code });
    await order({ email: "cizi@example.cz" });
    const rows = await orders();
    const by = (e: string) => rows.find((r) => r.email === e)!.id;
    await setServiceOrderStatus(by("k1@example.cz"), "hotovo");
    await setServiceOrderStatus(by("k2@example.cz"), "v_reseni");
    await setServiceOrderStatus(by("k3@example.cz"), "hotovo");
    const r = await referredOrders(a.acc.id);
    expect(r.orders).toHaveLength(3);
    expect(r.rewardTotal).toBe(200);
    expect(r.orders.map((o) => [o.ico, o.statusLabel, o.reward]).sort()).toEqual(
      [
        [null, "hotovo", 0],
        [null, "v řešení", 0],
        ["27074358", "hotovo", 200],
      ].sort(),
    );
    expect(JSON.stringify(r)).not.toContain("@example.cz");

    await login(a.user.id);
    const state = (await (await kabinetGET()).json()) as { partnerCode: string; referred: { rewardTotal: number } };
    expect(state.partnerCode).toBe(code);
    expect(state.referred.rewardTotal).toBe(200);
  });

  it("gate: only an admin can change the status; invalid status refused", async () => {
    await order({ email: "x@example.cz" });
    const [row] = await orders();
    const call = (body: unknown) =>
      adminStatus(new Request(`http://localhost/api/admin/nastaveni/${row!.id}`, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" }, body: JSON.stringify(body) }), {
        params: Promise.resolve({ id: row!.id }),
      });
    const a = await accountant();
    await login(a.user.id);
    process.env.ADMIN_EMAILS = "admin@example.cz";
    expect((await call({ status: "hotovo" })).status).toBe(404);
    const [admin] = await getDb().insert(schema.users).values({ email: "admin@example.cz" }).returning();
    await login(admin!.id);
    expect((await call({ status: "nic" })).status).toBe(400);
    expect((await call({ status: "hotovo" })).status).toBe(200);
    expect((await orders())[0]!.status).toBe("hotovo");
    delete process.env.ADMIN_EMAILS;
  });

  it("gate: retention deletes order records 12 months after the last change", async () => {
    await order({ email: "old@example.cz" });
    await order({ email: "new@example.cz" });
    await getDb()
      .update(schema.serviceOrders)
      .set({ updatedAt: new Date(Date.now() - 400 * 86_400_000) })
      .where(eq(schema.serviceOrders.email, "old@example.cz"));
    expect(await runRetention()).toMatchObject({ serviceOrders: 1 });
    expect((await orders()).map((o) => o.email)).toEqual(["new@example.cz"]);
  });
});

describe("S11 – Pohoda XML export routes", () => {
  async function productionSale(accountId: string, unitId: string, deviceId: string, over: Partial<typeof schema.sales.$inferInsert> = {}) {
    await getDb()
      .insert(schema.sales)
      .values({
        id: crypto.randomUUID(),
        accountId,
        deviceId,
        unitId,
        registerId: "P1",
        fsUnitId: 303,
        sequence: `P1-${randomToken(4)}`,
        soldAt: new Date("2026-11-02T09:00:00+01:00"),
        total: 12100,
        payments: [{ method: "cash", amount: 12100 }],
        vatBreakdown: { "21": { base: 10000, vat: 2100 } },
        evidencedTotal: 12100,
        status: "confirmed",
        mode: "production",
        deadlineAt: new Date(),
        ...over,
      });
  }

  it("gate: the owner export contains only production sales; empty period → 404", async () => {
    const s = await seedAccount();
    await productionSale(s.account.id, s.unit.id, s.device.id);
    await productionSale(s.account.id, s.unit.id, s.device.id, { mode: "mock", total: 99900, payments: [{ method: "cash", amount: 99900 }], vatBreakdown: { "21": { base: 82562, vat: 17338 } } });
    await login(s.user.id);
    const res = await get(ucetPohoda, "/api/ucet/export/pohoda?od=2026-11-01&do=2026-11-30");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain('ico="12345679"');
    expect(xml).toContain("<typ:priceHigh>100.00</typ:priceHigh><typ:priceHighVAT>21.00</typ:priceHighVAT>");
    expect(xml).not.toContain("825.62");
    expect((await get(ucetPohoda, "/api/ucet/export/pohoda?od=2026-10-01&do=2026-10-31")).status).toBe(404);
    expect((await get(ucetPohoda, "/api/ucet/export/pohoda?od=2026-11-01&do=2026-11-30&pokladna=%3Cx%3E")).status).toBe(400);
  });

  it("gate: the cabinet export works only for a linked client (by IČO), not for an unlinked IČO", async () => {
    const a = await accountant();
    const s = await seedAccount();
    await productionSale(s.account.id, s.unit.id, s.device.id);
    await getDb().insert(schema.accountantClients).values([
      { accountantAccountId: a.acc.id, ico: "12345679", clientAccountId: s.account.id },
      { accountantAccountId: a.acc.id, ico: "27074358" },
    ]);
    await login(a.user.id);
    const ok = await get(kabinetPohoda, "/api/kabinet/export/pohoda?klient=12345679&od=2026-11-01&do=2026-11-30&pokladna=P2");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("<typ:ids>P2</typ:ids>");
    expect((await get(kabinetPohoda, "/api/kabinet/export/pohoda?klient=27074358&od=2026-11-01&do=2026-11-30")).status).toBe(404);
    // vlastník firmy kabinet nemá
    await login(s.user.id);
    expect((await get(kabinetPohoda, "/api/kabinet/export/pohoda?klient=12345679")).status).toBe(403);
  });
});

describe("S11 – accountant form: marketing consent only with the box ticked", () => {
  let ip = 0;
  const prereg = (body: Record<string, unknown>) =>
    preregistrace(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.62.${++ip}.1` }, body: JSON.stringify(body) }));

  it("gate: without the box the request is handled (interest stored) but no marketing consent; with the box consent is stored", async () => {
    expect((await prereg({ email: "bez@example.cz", interest: "kabinet", utm: { utm_source: "ucetni" } })).status).toBe(200);
    expect((await prereg({ email: "nepravda@example.cz", interest: "kabinet", marketingConsent: false })).status).toBe(200);
    expect((await prereg({ email: "se@example.cz", interest: "kabinet", marketingConsent: true })).status).toBe(200);
    const rows = await getDb().select().from(schema.preregistrations);
    const by = (e: string) => rows.find((r) => r.email === e)!;
    for (const e of ["bez@example.cz", "nepravda@example.cz"]) {
      expect(by(e).marketingConsent, e).toBe(false);
      expect(by(e).marketingConsentAt, e).toBeNull();
      expect(by(e).consentEvidence, e).toBeNull();
    }
    expect(by("se@example.cz").marketingConsent).toBe(true);
    expect(by("se@example.cz").consentEvidence).toMatch(/^souhlas:/);
    const interests = await getDb().select().from(schema.preregistrationInterests);
    expect(interests.filter((i) => i.campaign === "kabinet")).toHaveLength(3);
  });

  it("gate: the form sends consent only from the separate, unticked checkbox", async () => {
    const { readFileSync } = await import("node:fs");
    const form = readFileSync(new URL("../../src/components/accountant/webinar-form.tsx", import.meta.url), "utf8");
    expect(form).toContain('marketingConsent: fd.get("marketing") === "on"');
    const box = form.slice(form.indexOf('name="marketing"') - 120, form.indexOf('name="marketing"') + 120);
    expect(box).toContain('type="checkbox"');
    expect(box).not.toMatch(/defaultChecked|checked=/);
  });
});
