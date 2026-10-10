/**
 * R18 (рецензія №15, docs/tasks/2026-10-10-review-15.md).
 *  R18.1 /kontrola-ico po otevření pokladny: místo předregistrace přihlášení s IČO do nastavení pokladny
 *        (/pokladna/nastaveni?ico=); krok „Firma“ bere ?ico= (přednost před předregistrací), podpis doslovně;
 *        zavřeno – jako dosud; zaniklý – bez formuláře i bez přihlášení; neplatné ?ico= se ignoruje.
 *  R18.2 nejvýš 300 nových klíčů utm za den (v paměti u denní soli); známé klíče se počítají dál.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "../helpers/launch";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }), usePathname: () => "/" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Mozilla/5.0", "x-real-ip": "198.51.100.81" }) }));
// zaniklý subjekt: fixture 12345679 s datem zániku pod jiným platným IČO (jako v r16)
vi.mock("@/lib/server/ares", async (orig) => {
  const real = await orig<typeof import("@/lib/server/ares")>();
  return {
    ...real,
    lookupCompany: async (ico: string, opts?: never) => {
      if (ico !== "27082440") return real.lookupCompany(ico, opts);
      const base = (await real.lookupCompany("12345679"))!;
      return { ...base, subject: { ...base.subject, ico: "27082440", dissolvedAt: "2020-06-30" } };
    },
  };
});

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  process.env.ARES_MOCK = "1";
});
afterEach(() => {
  delete process.env.ARES_MOCK;
  mockLaunch("closed");
});

const text = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const LOGIN_H = "Začněte evidovat zdarma";
const loginText = (ico: string) => `Zadejte e-mail a pošleme vám odkaz. IČO ${ico} doplníme do nastavení pokladny.`;
async function icoPage(ico: string) {
  const { default: Page } = await import("@/app/(site)/kontrola-ico/page");
  return renderToStaticMarkup((await Page({ searchParams: Promise.resolve({ ico }) } as never)) as ReactElement);
}

describe("R18.1 – /kontrola-ico after the register opens", () => {
  it("gate: open – login instead of the pre-registration (verbatim), leading to /pokladna/nastaveni?ico=", async () => {
    mockLaunch("open");
    const h = await icoPage("12345679");
    expect(text(h)).toContain(LOGIN_H);
    expect(text(h)).toContain(loginText("12345679"));
    expect(h).toContain('id="login-email"');
    expect(h).not.toContain('name="marketing"');
    expect(text(h)).not.toContain("Chcete evidovat zdarma?");
    const src = readFileSync(new URL("../../src/app/(site)/kontrola-ico/page.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/<LoginForm redirectTo=\{`\/pokladna\/nastaveni\?ico=\$\{prefillIco\}`\} \/>/);
  });

  it("gate: closed – the pre-registration form as before", async () => {
    mockLaunch("closed");
    const h = text(await icoPage("12345679"));
    expect(h).toContain("Chcete evidovat zdarma?");
    expect(h).not.toContain(LOGIN_H);
  });

  it("gate: dissolved – neither the form nor the login (open and closed)", async () => {
    for (const state of ["open", "closed"] as const) {
      mockLaunch(state);
      const h = await icoPage("27082440");
      expect(text(h), state).toContain("Subjekt zanikl");
      expect(text(h), state).not.toContain(LOGIN_H);
      expect(text(h), state).not.toContain("Chcete evidovat zdarma?");
      expect(h, state).not.toContain('id="login-email"');
    }
  });
});

describe("R18.1 – the Firma step takes ?ico=", () => {
  it("gate: only a valid 8-digit IČO from the query is taken", async () => {
    const { icoParam } = await import("@/lib/ico-param");
    expect(icoParam("12345679")).toBe("12345679");
    for (const v of [undefined, "", "12345678", "1234567", "123456790", "1234567a", ["12345679"], " 12345679"]) expect(icoParam(v), String(v)).toBeNull();
    const src = readFileSync(new URL("../../src/app/(app)/pokladna/nastaveni/page.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/checkIco: icoParam\(/);
  });

  it("gate: ?ico= wins over the pre-registration and says where it came from (verbatim); without it the pre-registration", async () => {
    const { SetupApp } = await import("@/components/setup/setup-app");
    const both = renderToStaticMarkup(createElement(SetupApp, { initial: { user: { email: "a@example.cz" }, account: null, preregIco: "27082440", checkIco: "12345679" } }));
    expect(both).toMatch(/<input id="f-ico"[^>]*value="12345679"/);
    expect(text(both)).toContain("IČO jsme doplnili z kontroly IČO.");
    expect(text(both)).not.toContain("IČO jsme doplnili z vaší předregistrace.");
    const prereg = renderToStaticMarkup(createElement(SetupApp, { initial: { user: { email: "a@example.cz" }, account: null, preregIco: "27082440", checkIco: null } }));
    expect(prereg).toMatch(/<input id="f-ico"[^>]*value="27082440"/);
    expect(text(prereg)).toContain("IČO jsme doplnili z vaší předregistrace.");
    // účet už existuje – ?ico= nic nemění
    const acc = { id: "x", name: "Firma", ico: "27082440", dic: null, eic: null, vatPayer: false, iban: null, receiptHeader: null, receiptFooter: null, receiptShowPok: true, eetMode: "mock", plan: "free", closedAt: null };
    const withAccount = renderToStaticMarkup(createElement(SetupApp, { initial: { user: { email: "a@example.cz" }, account: acc, checkIco: "12345679", units: [], staff: [], catalog: [], devices: [], certificates: [], limits: { staff: 5, units: 3, devices: 10 } } as never }));
    expect(withAccount).toMatch(/<input id="f-ico"[^>]*value="27082440"/);
    expect(text(withAccount)).not.toContain("IČO jsme doplnili z kontroly IČO.");
  });
});

describe("R18.2 – daily cap on new utm keys", () => {
  it("gate: the 301st new label of the day creates no row; a view of a known label still counts", async () => {
    const analytics = await import("@/lib/server/analytics");
    analytics.__resetAnalyticsForTests();
    expect(analytics.UTM_DAILY_KEYS).toBe(300);
    const h = new Headers({ "user-agent": "Mozilla/5.0 (X11; Linux) Firefox/131.0", "x-real-ip": "203.0.113.150" });
    const now = new Date("2026-10-20T10:00:00Z");
    for (let i = 0; i < 300; i++) await analytics.recordView(h, { path: "/", utm: { s: `src${i}` } }, now);
    await analytics.recordView(h, { path: "/", utm: { s: "src300" } }, now);
    await analytics.recordView(h, { path: "/", utm: { s: "src7" } }, now);
    const utm = (await getDb().select().from(schema.analyticsDaily)).filter((r) => r.metric === "utm");
    expect(utm).toHaveLength(300);
    expect(utm.find((r) => r.key === "src300/-/-")).toBeUndefined();
    expect(utm.find((r) => r.key === "src7/-/-")!.views).toBe(2);
    // stránka se počítá i nad limitem – omezují se jen nové štítky
    expect((await getDb().select().from(schema.analyticsDaily)).find((r) => r.metric === "page" && r.key === "/")!.views).toBe(302);
  }, 120_000);

  it("gate: after a restart the cap counts again in memory (like the salt); a label already in the database keeps counting above the cap; a new day starts from zero", async () => {
    const analytics = await import("@/lib/server/analytics");
    const db = getDb();
    const day = "2026-10-21";
    // řádky štítků zapsané před restartem
    await db.insert(schema.analyticsDaily).values([{ day, metric: "utm", key: "old5/-/-", views: 1, visitors: 1 }]);
    analytics.__resetAnalyticsForTests();
    const h = new Headers({ "user-agent": "Mozilla/5.0 (X11; Linux) Firefox/131.0", "x-real-ip": "203.0.113.151" });
    const now = new Date("2026-10-21T10:00:00Z");
    for (let i = 0; i < 300; i++) await analytics.recordView(h, { path: "/", utm: { s: `fresh${i}` } }, now);
    await analytics.recordView(h, { path: "/", utm: { s: "old5" } }, now);
    await analytics.recordView(h, { path: "/", utm: { s: "brandnew" } }, now);
    const rows = (await db.select().from(schema.analyticsDaily)).filter((r) => r.metric === "utm" && r.day === day);
    expect(rows).toHaveLength(301);
    expect(rows.find((r) => r.key === "old5/-/-")!.views).toBe(2);
    expect(rows.find((r) => r.key === "brandnew/-/-")).toBeUndefined();
    await analytics.recordView(h, { path: "/", utm: { s: "brandnew" } }, new Date("2026-10-22T10:00:00Z"));
    expect((await db.select().from(schema.analyticsDaily)).find((r) => r.metric === "utm" && r.day === "2026-10-22" && r.key === "brandnew/-/-")).toBeTruthy();
  }, 120_000);
});
