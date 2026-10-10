/**
 * R16 (рецензія №13, docs/tasks/2026-10-10-review-13.md).
 *  R16.1 /api/m počítá zobrazení a čas jen pro cesty z rejstříku stránek – téhož zdroje jako sitemap.xml; jiná cesta
 *        (vymyšlená, 404, návod mimo sitemap) nezapíše nic.
 *  R16.2 /kontrola-ico: u zaniklého subjektu (verdikt dissolved) bez formuláře předregistrace.
 *  R16.3 runRetention maže admin_audit starší 24 měsíců.
 *  R16.4 MobileCta se schová, když je vidět jakýkoli formulář předregistrace (data-prereg-form), ne jen #registrace.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Mozilla/5.0", "x-real-ip": "198.51.100.61" }) }));
// zaniklý subjekt: fixture 12345679 s datem zániku pod jiným (platným) IČO
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

const { POST: beacon } = await import("@/app/api/m/route");
const analytics = await import("@/lib/server/analytics");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  analytics.__resetAnalyticsForTests();
});
afterEach(() => {
  delete process.env.ARES_MOCK;
});

const send = (body: unknown) =>
  beacon(
    new Request("http://localhost/api/m", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "x-real-ip": "203.0.113.90" },
      body: JSON.stringify(body),
    }),
  );
const rows = () => getDb().select().from(schema.analyticsDaily);

describe("R16.1 – only pages from the site register", () => {
  it("gate: a made-up path and a non-existent guide write nothing (view and time); / and an existing guide are counted", async () => {
    for (const p of ["/neexistuje-xyz", "/navody/neexistuje", "/navody/eet-trhy-stanky", "/cenik/x", "/kontrola-ico/12345679"]) {
      await send({ t: "v", p });
      await send({ t: "t", p, s: 10, n: 1 });
    }
    expect(await rows()).toEqual([]);
    await send({ t: "v", p: "/" });
    await send({ t: "v", p: "/navody/eet-off" });
    await send({ t: "t", p: "/navody/eet-off", s: 20, n: 1 });
    const pages = (await rows()).filter((r) => r.metric === "page").map((r) => [r.key, r.views, r.secondsSum]);
    expect(pages.sort()).toEqual([
      ["/", 1, 0],
      ["/navody/eet-off", 1, 20],
    ]);
  });

  it("gate: the register is the same source as sitemap.xml – every sitemap page is tracked, nothing else", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const { SITE_URL } = await import("@/lib/site");
    const paths = sitemap().map((e) => e.url.slice(SITE_URL.length) || "/");
    for (const p of paths) expect(analytics.isTrackedPath(p), p).toBe(true);
    expect([...analytics.trackedPaths()].sort()).toEqual([...new Set(paths)].sort());
  });
});

describe("R16.2 – dissolved subject on /kontrola-ico", () => {
  async function icoPage(ico: string) {
    process.env.ARES_MOCK = "1";
    const { default: Page } = await import("@/app/(site)/kontrola-ico/page");
    return renderToStaticMarkup((await Page({ searchParams: Promise.resolve({ ico }) } as never)) as ReactElement);
  }

  it("gate: dissolved (Subjekt zanikl) → no pre-registration form; an active subject → the form", async () => {
    const dissolved = await icoPage("27082440");
    expect(dissolved).toContain("Subjekt zanikl");
    expect(dissolved).not.toContain("Chcete evidovat zdarma?");
    expect(dissolved).not.toContain("data-prereg-form");
    const active = await icoPage("12345679");
    expect(active).toContain("Chcete evidovat zdarma?");
    expect(active).toContain("data-prereg-form");
  });
});

describe("R16.3 – admin audit retention", () => {
  it("gate: a 25-month-old audit record is deleted, a 23-month-old one stays", async () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const monthsAgo = (m: number) => {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - m);
      return d;
    };
    await getDb()
      .insert(schema.adminAudit)
      .values([
        { email: "owner@example.cz", page: "/admin/predregistrace", createdAt: monthsAgo(25) },
        { email: "owner@example.cz", page: "/admin/predregistrace/csv", createdAt: monthsAgo(23) },
      ]);
    const { runRetention } = await import("@/lib/server/lifecycle");
    const out = await runRetention(now);
    expect(out.adminAudit).toBe(1);
    expect((await getDb().select({ page: schema.adminAudit.page }).from(schema.adminAudit)).map((r) => r.page)).toEqual(["/admin/predregistrace/csv"]);
    const { RETENTION } = await import("@/lib/legal");
    expect(RETENTION.adminAuditMonths).toBe(24);
  });
});

describe("R16.4 – the phone button hides over any pre-registration form", () => {
  it("gate: MobileCta observes forms with data-prereg-form (not #registrace); PreregForm carries the attribute", async () => {
    const src = readFileSync(new URL("../../src/components/mobile-cta.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/querySelectorAll\("\[data-prereg-form\]"\)/);
    expect(src).toMatch(/IntersectionObserver/);
    expect(src).not.toMatch(/getElementById\("registrace"\)/);
    const { PreregForm } = await import("@/components/prereg-form");
    expect(renderToStaticMarkup(createElement(PreregForm))).toMatch(/<form[^>]*data-prereg-form="true"/);
  });
});
