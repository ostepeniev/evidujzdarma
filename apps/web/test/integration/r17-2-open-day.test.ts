/**
 * R17.2 (docs/tasks/2026-10-10-r17.md) – den otevření pokladny (2. 11.). Test podvrhne CLOSED_SECTIONS / CLOSED_API bez
 * sekcí pokladny (ze skutečných seznamů, helpers/launch.ts) a ověří, co se samo přepne:
 *  - SERVICE_COPY v přítomném čase, startCta → /prihlaseni;
 *  - úvodní stránka: v #registrace přihlášení (LoginForm → /pokladna/nastaveni) místo předregistrace;
 *  - /prihlaseni: „Přihlášení a registrace“ a text doslovně (zavřeno – jako dosud);
 *  - robots.txt bez Disallow pro /pokladna a /prihlaseni;
 *  - app-ready se už neodkládá.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "../helpers/launch";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }), usePathname: () => "/" }));
vi.mock("@/lib/sitemap-registry", () => ({ extraSitemaps: async () => [] }));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const text = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const LOGIN_H = "Začněte evidovat zdarma";
const LOGIN_T = "Zadejte e-mail a pošleme vám odkaz. Účet založíme při prvním přihlášení – heslo si pamatovat nemusíte.";
const PRIHLASENI_H = "Přihlášení a registrace";
const PRIHLASENI_T = "Zadejte e-mail a pošleme vám odkaz. Pokud u nás účet ještě nemáte, založíme ho. Heslo si pamatovat nemusíte.";

async function home() {
  const { default: Home } = await import("@/app/(site)/page");
  return renderToStaticMarkup(createElement(Home as FC));
}
async function prihlaseni() {
  const { default: Login } = await import("@/app/(app)/prihlaseni/page");
  return renderToStaticMarkup((await Login({ searchParams: Promise.resolve({}) } as never)) as ReactElement);
}
const registrace = (html: string) => html.slice(html.indexOf('id="registrace"'), html.indexOf('aria-labelledby="faq"'));

describe("R17.2 – the opening day (CLOSED_SECTIONS without the cash register)", () => {
  it("gate: SERVICE_COPY in the present tense, startCta → /prihlaseni", async () => {
    mockLaunch("open");
    const { SERVICE_COPY } = await import("@/lib/site");
    expect(SERVICE_COPY.startCta).toEqual({ label: "Začít zdarma", href: "/prihlaseni" });
    expect(SERVICE_COPY.hero).toBe("Bezplatná pokladna pro EET 2.0, která funguje i bez signálu.");
    const { MobileCta } = await import("@/components/mobile-cta");
    expect(renderToStaticMarkup(createElement(MobileCta))).toMatch(/<a [^>]*href="\/prihlaseni"[^>]*>Začít zdarma<\/a>/);
  });

  it("gate: the home page – login instead of the pre-registration form in #registrace", async () => {
    mockLaunch("open");
    const block = registrace(await home());
    expect(text(block)).toContain(LOGIN_H);
    expect(text(block)).toContain(LOGIN_T);
    expect(block).toContain('id="login-email"');
    expect(block).not.toContain('name="marketing"');
    expect(block).not.toContain("Předregistrace k pokladně zdarma");
    // LoginForm s přechodem na /pokladna/nastaveni
    expect(readFileSync(new URL("../../src/app/(site)/page.tsx", import.meta.url), "utf8")).toMatch(/<LoginForm redirectTo="\/pokladna\/nastaveni" \/>/);
  });

  it("closed – the home page keeps the pre-registration form", async () => {
    mockLaunch("closed");
    const block = registrace(await home());
    expect(text(block)).toContain("Předregistrace k pokladně zdarma");
    expect(block).toContain('name="marketing"');
    expect(text(block)).not.toContain(LOGIN_H);
    const { SERVICE_COPY } = await import("@/lib/site");
    expect(SERVICE_COPY.startCta).toEqual({ label: "Předregistrovat se zdarma", href: "/#registrace" });
  });

  it("gate: /prihlaseni – „Přihlášení a registrace“ when open, as today when closed", async () => {
    mockLaunch("open");
    const open = text(await prihlaseni());
    expect(open).toContain(PRIHLASENI_H);
    expect(open).toContain(PRIHLASENI_T);
    mockLaunch("closed");
    const closed = text(await prihlaseni());
    expect(closed).toContain("Přihlášení");
    expect(closed).toContain("Pošleme vám odkaz pro přihlášení. Žádné heslo si nemusíte pamatovat.");
    expect(closed).not.toContain(PRIHLASENI_H);
  });

  it("gate: robots.txt has no Disallow for /pokladna and /prihlaseni; the catalogue stays disallowed", async () => {
    mockLaunch("open");
    const { default: robots } = await import("@/app/robots");
    const r = await robots();
    for (const rule of [r.rules].flat()) {
      const dis = [rule.disallow ?? []].flat();
      for (const p of ["/pokladna", "/prihlaseni"]) expect(dis.filter((d) => d === `${p}$` || d.startsWith(`${p}/`) || d === p), p).toEqual([]);
      expect(dis).toContain("/firmy/");
    }
  });

  it("gate: app-ready is no longer postponed – it is sent", async () => {
    mockLaunch("open");
    const { enqueueEmail, processOutbox } = await import("@/lib/server/mail");
    await getDb().insert(schema.preregistrations).values({ email: "open@example.cz", referralCode: "opencode", confirmTokenHash: "a".repeat(64), confirmedAt: new Date() });
    await enqueueEmail({ to: "open@example.cz", template: "app-ready", payload: { unsubscribeToken: "x" } });
    await processOutbox(10);
    const [row] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "open@example.cz"));
    expect(row!.lastError).toBeNull();
    expect(row!.status).toBe("sent");
  });
});
