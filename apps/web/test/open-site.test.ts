/**
 * eet-open-site (docs/tasks/2026-10-03-open-site.md): veřejný je obsah, nástroje a předregistrace, od S3 i katalog firem
 * (LIA hotová, docs/LIA-katalog-firem.md). Pokladna, přihlášení, Účetní kabinet, pozvánky a účtenky zůstávají za heslem
 * (nginx) do 2. 11. 2026. Web na ně neodkazuje, robots.txt je zakazuje a sitemapy je neobsahují.
 * R17.2: testy čtou skutečné CLOSED_SECTIONS (commit otevření pokladny 2. 11. je nerozbije); stav „zavřeno“ tam,
 * kde na něm test stojí, si nasimulují (helpers/launch.ts).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POS_SECTIONS, mockLaunch } from "./helpers/launch";

vi.mock("@/lib/sitemap-registry", () => ({ extraSitemaps: async () => ["/firma/sitemap/0.xml", "/provozovna/sitemap/0.xml"] }));

const launch = await import("@/lib/launch");
const { default: robots } = await import("@/app/robots");
const { default: sitemap } = await import("@/app/sitemap");
const { SiteFooter } = await import("@/components/site-footer");
const { SiteHeader } = await import("@/components/site-header");

const CATALOG = ["/firmy", "/firma", "/provozovna", "/obor"];
const CLOSED: readonly string[] = launch.CLOSED_SECTIONS;
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);

afterEach(() => {
  vi.doUnmock("@/lib/launch");
  vi.resetModules();
});

describe("eet-open-site – what stays closed", () => {
  it("the closed list is only the app (until 2. 11.); the catalogue is open (S3); /ucetni is not caught by /u", () => {
    // katalog je od S3 otevřený; zavřené smí být jen sekce pokladny
    for (const p of CATALOG) {
      expect(CLOSED, p).not.toContain(p);
      expect(launch.isClosed(`${p}/x`), p).toBe(false);
    }
    expect(launch.CATALOG_CLOSED).toBe(false);
    for (const p of CLOSED) expect([...POS_SECTIONS], p).toContain(p);
    for (const p of CLOSED) {
      expect(launch.isClosed(p), p).toBe(true);
      expect(launch.isClosed(`${p}/x`), p).toBe(true);
    }
    for (const p of ["/", "/ucetni", "/ucetni/hromadna-kontrola", "/kontrola-ico", "/navody/x", "/namitka", "/registrace/potvrzeni", "/firmyx"]) expect(launch.isClosed(p), p).toBe(false);
  });

  it("gate: robots.txt disallows every closed section, not the catalogue, and lists the catalogue sitemaps (S3)", async () => {
    const r = await robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    for (const rule of rules) {
      const dis = ([] as string[]).concat(rule.disallow ?? []);
      for (const p of CLOSED) expect(dis.includes(`${p}$`) && dis.includes(`${p}/`), `${p} in ${String(rule.userAgent)}`).toBe(true);
      for (const p of CATALOG) expect(dis.some((d) => d === `${p}$` || d === `${p}/`), `${p} in ${String(rule.userAgent)}`).toBe(false);
    }
    expect(([] as string[]).concat(r.sitemap ?? []).filter((s) => /\/(firma|provozovna)\//.test(s)).length).toBe(2);
  });

  it("gate: the main sitemap has no closed URL", () => {
    for (const e of sitemap()) expect(launch.isClosed(new URL(e.url).pathname), e.url).toBe(false);
  });

  it("gate: header and footer do not link to closed sections", () => {
    for (const html of [renderToStaticMarkup(createElement(SiteHeader)), renderToStaticMarkup(createElement(SiteFooter))]) {
      for (const h of hrefs(html).filter((x) => x.startsWith("/"))) expect(launch.isClosed(h.split("#")[0]!), h).toBe(false);
    }
  });

  it("gate: /ucetni does not link to the closed cabinet nor claim it works already", async () => {
    mockLaunch("closed");
    const { default: Ucetni } = await import("@/app/(site)/ucetni/page");
    const html = renderToStaticMarkup(createElement(Ucetni));
    expect(hrefs(html).filter((h) => h.startsWith("/kabinet"))).toEqual([]);
    expect(html).not.toMatch(/funguje už teď/);
    expect(html).not.toMatch(/Dostupné už teď<\/span><h3[^>]*>(Stav připravenosti|Pozvání klienta|Export tržeb)/);
  });
});
