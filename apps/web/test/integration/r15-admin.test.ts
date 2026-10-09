/**
 * R15.2 (docs/tasks/2026-10-09-r15.md) – adminský kabinet /admin.
 *  - přístup: přihlášení (magic link) + e-mail v ADMIN_EMAILS, jinak 404 (stránky, CSV i API);
 *  - každé zobrazení stránky s osobními údaji (předregistrace, CSV, změna CRM, účty) → záznam v auditu;
 *  - „interní“ předregistrace (@swipescape.eu a adresy s „+“) se nepočítají do čísla v záhlaví;
 *  - CRM: stav a poznámka (migrace), export CSV; účty do otevření pokladny prázdné s textem.
 */
import { getDb, schema } from "@ez/db";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

let sessionToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
  headers: async () => new Headers({ "x-real-ip": "198.51.100.40", "user-agent": "Mozilla/5.0" }),
}));

const { sha256, randomToken } = await import("@/lib/server/tokens");
const { default: Overview } = await import("@/app/(admin)/admin/page");
const { default: PreregPage } = await import("@/app/(admin)/admin/predregistrace/page");
const { default: AccountsPage } = await import("@/app/(admin)/admin/ucty/page");
const { GET: csv } = await import("@/app/(admin)/admin/predregistrace/csv/route");
const { POST: crm } = await import("@/app/api/admin/predregistrace/[id]/route");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  sessionToken = null;
  process.env.ADMIN_EMAILS = "Owner@Example.cz, second@example.cz";
});
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

async function login(email: string) {
  const [user] = await getDb().insert(schema.users).values({ email }).returning();
  sessionToken = randomToken(32);
  await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId: user!.id, expiresAt: new Date(Date.now() + 86_400_000) });
  return user!;
}
async function prereg(email: string, extra: Partial<typeof schema.preregistrations.$inferInsert> = {}) {
  const [r] = await getDb()
    .insert(schema.preregistrations)
    .values({ email, referralCode: randomToken(6).slice(0, 8), confirmTokenHash: sha256(randomToken()), ...extra })
    .returning();
  return r!;
}
const html = async (el: Promise<unknown> | unknown) => renderToStaticMarkup((await el) as ReactElement);
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;
const crmPost = (id: string, body: unknown) =>
  crm(new Request(`http://localhost/api/admin/predregistrace/${id}`, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  } as never);
const audit = () => getDb().select({ email: schema.adminAudit.email, page: schema.adminAudit.page }).from(schema.adminAudit);

describe("R15.2 – access", () => {
  it("gate: without login → 404 on every admin page, the CSV and the CRM API", async () => {
    const p = await prereg("a@firma.cz");
    await expect(Overview({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(NOT_FOUND);
    await expect(PreregPage()).rejects.toThrow(NOT_FOUND);
    await expect(AccountsPage()).rejects.toThrow(NOT_FOUND);
    expect((await csv(new Request("http://localhost/admin/predregistrace/csv"))).status).toBe(404);
    expect((await crmPost(p.id, { status: "contacted", note: "x" })).status).toBe(404);
    expect(await audit()).toEqual([]);
  });

  it("gate: logged in with an e-mail outside ADMIN_EMAILS (or ADMIN_EMAILS unset) → 404", async () => {
    await login("someone@example.cz");
    await expect(PreregPage()).rejects.toThrow(NOT_FOUND);
    expect((await csv(new Request("http://localhost/admin/predregistrace/csv"))).status).toBe(404);
    sessionToken = null;
    await login("owner@example.cz");
    delete process.env.ADMIN_EMAILS;
    await expect(PreregPage()).rejects.toThrow(NOT_FOUND);
    await expect(Overview({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(NOT_FOUND);
    expect(await audit()).toEqual([]);
  });

  it("gate: noindex, Disallow: /admin in robots.txt and the strict CSP with nonce", async () => {
    const { metadata } = await import("@/app/(admin)/admin/layout");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    const { default: robots } = await import("@/app/robots");
    const r = await robots();
    for (const rule of [r.rules].flat()) expect([rule.disallow].flat()).toContain("/admin");
    const { proxy } = await import("@/proxy");
    expect(proxy(new NextRequest("http://localhost/admin/predregistrace")).headers.get("content-security-policy")).toMatch(/'nonce-/);
  });
});

describe("R15.2 – pre-registrations, audit and CSV", () => {
  it("gate: the table (Ukrainian), „внутрішній“ flag; internal addresses are not in the header count; the view is audited", async () => {
    await login("owner@example.cz");
    await prereg("jana@kadernictvi.cz", { ico: "12345679", companyName: "Kadeřnictví Jana s.r.o.", industry: "kadernictvi", establishmentsCount: 2, needs: ["printer"], confirmedAt: new Date(), utm: { utm_source: "facebook" } });
    await prereg("tester@swipescape.eu");
    await prereg("jan+test@gmail.com");
    const h = text(await html(PreregPage()));
    expect(h).toContain("Передреєстрації: 1");
    expect(h).toContain("jana@kadernictvi.cz");
    expect(h).toContain("Kadeřnictví Jana s.r.o.");
    expect(h).toContain("facebook");
    expect(h.match(/внутрішній/g)?.length).toBe(2);
    expect(await audit()).toEqual([{ email: "owner@example.cz", page: "/admin/predregistrace" }]);
  });

  it("gate: CRM status and note (migration) – saved, audited; unknown status refused", async () => {
    const admin = await login("owner@example.cz");
    const p = await prereg("jana@kadernictvi.cz");
    expect(p).toMatchObject({ crmStatus: "new", crmNote: null });
    expect((await crmPost(p.id, { status: "contacted", note: "Volala 10. 10., chce tiskárnu" })).status).toBe(200);
    const [after] = await getDb().select().from(schema.preregistrations);
    expect(after).toMatchObject({ crmStatus: "contacted", crmNote: "Volala 10. 10., chce tiskárnu" });
    expect((await crmPost(p.id, { status: "vip" })).status).toBe(400);
    expect(await audit()).toEqual([{ email: admin.email, page: `crm:${p.id}` }]);
    const h = text(await html(PreregPage()));
    expect(h).toContain("зв'язались");
    expect(h).toContain("Volala 10. 10., chce tiskárnu");
  });

  it("gate: CSV export – text/csv with all columns, audited", async () => {
    await login("owner@example.cz");
    await prereg("jana@kadernictvi.cz", { ico: "12345679", companyName: 'Firma "Jana"; s.r.o.' });
    await prereg("tester@swipescape.eu");
    const res = await csv(new Request("http://localhost/admin/predregistrace/csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = await res.text();
    const [head, ...lines] = body.trim().split("\n");
    expect(head).toContain("email");
    expect(head).toContain("internal");
    expect(lines).toHaveLength(2);
    expect(body).toContain('"Firma ""Jana""; s.r.o."');
    expect(await audit()).toEqual([{ email: "owner@example.cz", page: "/admin/predregistrace/csv" }]);
  });

  it("CSV cells starting with = + - @ are neutralised (spreadsheet formula injection)", async () => {
    await login("owner@example.cz");
    await prereg("x@firma.cz", { companyName: "=HYPERLINK(\"http://evil\")" });
    const body = await (await csv(new Request("http://localhost/admin/predregistrace/csv"))).text();
    expect(body).not.toMatch(/(^|;|,)"?=HYPERLINK/m);
    expect(body).toContain("'=HYPERLINK");
  });
});

describe("R15.2 – overview and accounts", () => {
  it("gate: the overview (7/30/90 days) renders from aggregates only and writes no audit", async () => {
    await login("owner@example.cz");
    const today = new Date().toISOString().slice(0, 10);
    await getDb()
      .insert(schema.analyticsDaily)
      .values([
        { day: today, metric: "site", key: "", views: 12, visitors: 5 },
        { day: today, metric: "page", key: "/cenik", views: 4, visitors: 3, secondsSum: 120, secondsCount: 3 },
        { day: today, metric: "ref", key: "google.com", views: 2 },
        { day: today, metric: "device", key: "mobile", views: 9 },
        { day: today, metric: "event", key: "ico_check", views: 3 },
        { day: today, metric: "event", key: "prereg_submitted", views: 1 },
      ]);
    for (const d of ["7", "30", "90", "nonsense"]) {
      const h = text(await html(Overview({ searchParams: Promise.resolve({ d }) } as never)));
      expect(h, d).toContain("Огляд");
      expect(h, d).toContain("/cenik");
      expect(h, d).toContain("google.com");
      expect(h, d).toContain("Перевірки IČO");
    }
    expect(await audit()).toEqual([]);
  });

  it("gate: accounts – before the register opens an empty page with „Каса відкривається 2. 11.“", async () => {
    await login("owner@example.cz");
    const h = text(await html(AccountsPage()));
    expect(h).toContain("Каса відкривається 2. 11.");
    expect(await audit()).toEqual([]);
  });

  it("CSV and CRM status labels come from one list (новий / зв'язались / зареєструвався / не цікаво)", async () => {
    const { PREREG_STATUSES } = await import("@/lib/server/admin");
    expect(PREREG_STATUSES).toEqual([
      { value: "new", label: "новий" },
      { value: "contacted", label: "зв'язались" },
      { value: "registered", label: "зареєструвався" },
      { value: "not_interested", label: "не цікаво" },
    ]);
  });
});

describe("R15.2 – internal addresses", () => {
  it("gate: @swipescape.eu and addresses with + are internal; others are not", async () => {
    const { isInternalEmail } = await import("@/lib/server/admin");
    expect(isInternalEmail("o.stepeniev@swipescape.eu")).toBe(true);
    expect(isInternalEmail("Test@SWIPESCAPE.EU")).toBe(true);
    expect(isInternalEmail("jan+eet@gmail.com")).toBe(true);
    expect(isInternalEmail("jana@kadernictvi.cz")).toBe(false);
    expect(isInternalEmail("someone@notswipescape.eu")).toBe(false);
  });
});
