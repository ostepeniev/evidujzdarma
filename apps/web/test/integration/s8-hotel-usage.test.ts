/**
 * S8 rozd. 10–11 – hotelová PMS: co volat a co ne (docs/integrations/hotel-pms.md + oddíl v /api-docs, jen z návodu
 * eet-ubytovani a FACTS – žádná nová daňová tvrzení), příklady JSON platné podle SaleV1; evidence využití v /admin;
 * návrhy podmínek a DPA (neveřejné); ČEKPOINT „ostré prostředí“ – API_LIVE_PUBLIC pro cizí partnery.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDb, schema } from "@ez/db";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiSale, call, seedApi } from "../helpers/api";
import { fakeTransports } from "../helpers/fake-transport";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("@/lib/launch", async (orig) => (await import("../helpers/launch")).launchAs(await orig(), "closed"));
let sessionToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
  headers: async () => new Headers({ "x-real-ip": "198.51.100.42", "user-agent": "Mozilla/5.0" }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => {} }));

const ROOT = join(__dirname, "../../../..");
const HOTEL = join(ROOT, "docs/integrations/hotel-pms.md");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  sessionToken = null;
  delete process.env.API_LIVE_PUBLIC;
});
afterEach(async () => {
  const { __setTransportFactoryForTests } = await import("@/lib/server/fiscal");
  __setTransportFactoryForTests(null);
});

const EVENTS = [
  "Záloha převodem / platební bránou / přes Booking, Airbnb online",
  "Záloha zaplacená na recepci (hotovost, karta, QR)",
  "Doplatek na recepci",
  "Doplatek převodem na fakturu",
  "Minibar, wellness, parkování placené na místě",
  "Vratná kauce – složení / vrácení",
  "Část kauce složené na místě, kterou si ponecháte",
  "Kauce poslaná převodem, část ponechána",
  "Storno / vrácení peněz na místě",
  "Místní poplatek z pobytu",
  "Dobití kreditu / hotelové karty k pozdějšímu čerpání",
];

describe("S8 – hotel PMS guide (10)", () => {
  it("gate: docs/integrations/hotel-pms.md has every PMS event with the API answer, sources and no default for the local fee", async () => {
    expect(existsSync(HOTEL)).toBe(true);
    const md = readFileSync(HOTEL, "utf8");
    for (const e of EVENTS) expect(md, e).toContain(e);
    expect(md).toMatch(/Místní poplatek z pobytu \| \*\*Otevřené\*\*/);
    expect(md).toMatch(/bez výchozí hodnoty/i);
    expect(md).toContain("credit_topup");
    expect(md).toContain("/v1/sales/{id}/refund");
    expect(md).toContain("/navody/eet-ubytovani");
    expect(md).toContain("https://eet.gov.cz");
  });

  it("gate: the JSON examples (záloha + doplatek, kauce 300 Kč) are valid SaleV1 and evidence what the guide says", async () => {
    const md = readFileSync(HOTEL, "utf8");
    const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]!));
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const { SaleV1Schema } = await import("@/lib/server/api/v1");
    const sales = blocks.flatMap((b) => (b.sales ?? [b]) as unknown[]);
    for (const s of sales) expect(SaleV1Schema.safeParse(s).success, JSON.stringify(s)).toBe(true);
    // kauce: tržba jen na ponechaných 300 Kč
    expect(sales.some((s: any) => s.lines.some((l: any) => /kauc/i.test(l.name)) && s.payments.reduce((a: number, p: any) => a + p.amount, 0) === 30000)).toBe(true);
    // záloha na recepci a doplatek kartou jsou dvě samostatné tržby
    expect(sales.filter((s: any) => /Záloha|Doplatek/.test(s.lines[0].name))).toHaveLength(2);
  });

  it("gate: /api-docs has the hotel section with the same rows (from the shared content), linked to the guide", async () => {
    const { pageText } = await import("../helpers/render-text");
    const { default: Page } = await import("@/app/(site)/api-docs/page");
    const text = pageText(Page);
    expect(text).toContain("Hotel a PMS");
    for (const e of EVENTS) expect(text, e).toContain(e);
    const { HOTEL_ROWS } = await import("@/content/api-hotel");
    const md = readFileSync(HOTEL, "utf8");
    for (const r of HOTEL_ROWS) expect(md, r.event).toContain(`| ${r.event} |`);
  });
});

describe("S8 – usage in /admin (11)", () => {
  it("gate: /admin/api shows integrations, account, active units this month and requests – only for an admin, audited", async () => {
    __setTransport();
    const s = await seedApi();
    const { POST } = await import("@/app/api/v1/sales/route");
    await call(POST, { path: "/api/v1/sales", token: s.token, body: { sales: [apiSale(s.unit.id)] } });
    const { default: Page } = await import("@/app/(admin)/admin/api/page");
    await expect(Page()).rejects.toThrow("NOT_FOUND");
    process.env.ADMIN_EMAILS = s.user.email;
    const { sha256, randomToken } = await import("@/lib/server/tokens");
    sessionToken = randomToken(32);
    await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId: s.user.id, expiresAt: new Date(Date.now() + 86_400_000) });
    const html = renderToStaticMarkup((await Page()) as never).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const x of ["ALiSiO", "Kadeřnictví Test", "test", "1"]) expect(html, x).toContain(x);
    expect(html).toMatch(/Активні одиниці/);
    expect(html).toMatch(/Запити/);
    expect((await getDb().select().from(schema.adminAudit)).map((a) => a.page)).toContain("/admin/api");
    delete process.env.ADMIN_EMAILS;
  });
});

function __setTransport() {
  void import("@/lib/server/fiscal").then((m) => m.__setTransportFactoryForTests(fakeTransports().factory));
}

describe("S8 – CHECKPOINT ostré prostředí: API_LIVE_PUBLIC (11)", () => {
  it("gate: a live token for an external partner app needs API_LIVE_PUBLIC=1; ALiSiO and the owner's own integration are allowed", async () => {
    const s = await seedApi({ environment: "live" });
    const { createIntegration } = await import("@/lib/server/integrations");
    const [ext] = await getDb().insert(schema.partnerApps).values({ name: "Cizí PMS", clientId: "ext", clientSecretHash: "x" }).returning();
    const [ali] = await getDb().insert(schema.partnerApps).values({ name: "ALiSiO", clientId: "alisio", clientSecretHash: "x" }).returning();
    const base = { environment: "live" as const, scopes: ["sales:write" as const], unitIds: [s.unit.id] };
    await expect(createIntegration(s.account.id, s.user.id, { ...base, name: "Cizí", partnerAppId: ext!.id })).rejects.toThrow(/zatím jen/);
    await expect(createIntegration(s.account.id, s.user.id, { ...base, name: "ALiSiO", partnerAppId: ali!.id })).resolves.toBeTruthy();
    await expect(createIntegration(s.account.id, s.user.id, { ...base, name: "Vlastní" })).resolves.toBeTruthy();
    // test token cizího partnera smí vždy
    await expect(createIntegration(s.account.id, s.user.id, { ...base, environment: "test", name: "Cizí test", partnerAppId: ext!.id })).resolves.toBeTruthy();
    process.env.API_LIVE_PUBLIC = "1";
    await expect(createIntegration(s.account.id, s.user.id, { ...base, name: "Cizí 2", partnerAppId: ext!.id })).resolves.toBeTruthy();
  });
});

describe("S8 – terms and DPA drafts (11, CHECKPOINT)", () => {
  it("gate: drafts exist, are marked Návrh – neschváleno and are not published anywhere in the app", () => {
    for (const f of ["docs/legal/podminky-api-navrh.md", "docs/legal/dpa-api-navrh.md"]) {
      const text = readFileSync(join(ROOT, f), "utf8");
      expect(text, f).toContain("Návrh – neschváleno");
    }
    const dpa = readFileSync(join(ROOT, "docs/legal/dpa-api-navrh.md"), "utf8");
    expect(dpa).toMatch(/čl\. 28/);
    expect(dpa).toMatch(/rodné číslo/);
    const terms = readFileSync(join(ROOT, "docs/legal/podminky-api-navrh.md"), "utf8");
    for (const s of ["technick", "poplatník", "48 hodin", "odpovědnost"]) expect(terms, s).toContain(s);
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    for (const f of walk(join(ROOT, "apps/web/src"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/api-navrh/);
  });
});
