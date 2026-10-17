/**
 * S2-A – nápověda k pokladně (/napoveda, /napoveda/[slug]).
 *  - obsah: 20–30 článků, titulek ≤ 60 znaků, úvod, aspoň jeden krok nebo oddíl, 120–350 slov, odkazy vedou na existující
 *    stránky (helpers/routes.ts, pravidla R2.9) a nikdy do uzavřených sekcí; zákonná fakta přes FACTS;
 *  - dokud je pokladna zavřená (simulace ze skutečných seznamů, helpers/launch.ts – R17.2): noindex,follow, mimo sitemap
 *    (= mimo měření, R16.1) i llms.txt, poznámka „Pokladnu spouštíme 2. 11. 2026…“, žádný odkaz do pokladny;
 *  - po otevření (commit odebere „/pokladna“ z CLOSED_SECTIONS): indexovatelná, v sitemap i v llms.txt, bez poznámky.
 */
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";
import { resolvesPath } from "./helpers/routes";

vi.mock("@/lib/sitemap-registry", () => ({ extraSitemaps: async () => [] }));

// zavřená pokladna simulovaná ze skutečných seznamů – commit otevření 2. 11. test nerozbije (R17.2)
mockLaunch("closed");
afterEach(() => {
  mockLaunch("closed");
});

const NOTE = "Pokladnu spouštíme 2. 11. 2026 – návod popisuje, jak bude fungovat.";
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
const mdLinks = (text: string) => [...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]!);

async function load() {
  const content = await import("@/content/napoveda");
  const types = await import("@/content/napoveda/types");
  const page = await import("@/lib/help-page");
  const { GUIDES } = await import("@/content/guides");
  const launch = await import("@/lib/launch");
  return { ...content, ...types, ...page, GUIDES, launch };
}

/** Všechny texty článku se syntaxí (pro odkazy). */
async function rawTexts(slug: string): Promise<string> {
  const { getHelpArticle } = await load();
  const a = getHelpArticle(slug)!;
  return JSON.stringify([a.lead, a.steps ?? [], a.sections ?? []]);
}

async function renderArticle(slug: string): Promise<string> {
  const { default: Page } = await import("@/app/(site)/napoveda/[slug]/page");
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ slug }) } as never)) as ReactElement);
}

async function renderHub(): Promise<string> {
  const { default: Hub } = await import("@/app/(site)/napoveda/page");
  return renderToStaticMarkup(createElement(Hub as FC));
}

async function articleMeta(slug: string) {
  const { generateMetadata } = await import("@/app/(site)/napoveda/[slug]/page");
  return generateMetadata({ params: Promise.resolve({ slug }) } as never);
}

describe("S2-A – help articles (content)", () => {
  it("gate: 20–30 articles, unique slugs, every article has title ≤ 60, lead, description and ≥ 1 step or section", async () => {
    const { HELP_ARTICLES, HELP_TOPIC_ORDER } = await load();
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(20);
    expect(HELP_ARTICLES.length).toBeLessThanOrEqual(30);
    expect(new Set(HELP_ARTICLES.map((a) => a.slug)).size).toBe(HELP_ARTICLES.length);
    for (const a of HELP_ARTICLES) {
      expect(a.slug, a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(a.title.length, a.slug).toBeGreaterThan(0);
      expect(a.title.length, `${a.slug}: ${a.title}`).toBeLessThanOrEqual(60);
      expect(a.lead.trim().length, a.slug).toBeGreaterThan(40);
      expect(a.description.length, `${a.slug}: description ${a.description.length}`).toBeGreaterThanOrEqual(110);
      expect(a.description.length, `${a.slug}: description ${a.description.length}`).toBeLessThanOrEqual(160);
      expect((a.steps?.length ?? 0) + (a.sections?.length ?? 0), a.slug).toBeGreaterThanOrEqual(1);
      for (const s of a.steps ?? []) expect(s.name.trim() && s.text.trim(), a.slug).toBeTruthy();
      for (const s of a.sections ?? []) expect(s.blocks.length, `${a.slug}#${s.id}`).toBeGreaterThan(0);
      expect(new Set((a.sections ?? []).map((s) => s.id)).size, a.slug).toBe(a.sections?.length ?? 0);
      expect(HELP_TOPIC_ORDER, a.slug).toContain(a.topic);
      expect(a.updated, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // každé téma rozcestníku má aspoň jeden článek
    for (const t of HELP_TOPIC_ORDER) expect(HELP_ARTICLES.some((a) => a.topic === t), t).toBe(true);
  });

  it("gate: every article is short – 120 to 350 words", async () => {
    const { HELP_ARTICLES, helpWordCount } = await load();
    const out = HELP_ARTICLES.map((a) => [a.slug, helpWordCount(a)] as const).filter(([, n]) => n < 120 || n > 350);
    expect(out).toEqual([]);
  });

  it("gate: related articles and guides exist (and are not the article itself)", async () => {
    const { HELP_ARTICLES, GUIDES } = await load();
    const help = new Set(HELP_ARTICLES.map((a) => a.slug));
    const guides = new Set(GUIDES.map((g) => g.slug));
    for (const a of HELP_ARTICLES) {
      expect(a.related.length, a.slug).toBeGreaterThan(0);
      for (const r of a.related) {
        expect(help.has(r), `${a.slug} → ${r}`).toBe(true);
        expect(r, a.slug).not.toBe(a.slug);
      }
      for (const g of a.guides ?? []) expect(guides.has(g), `${a.slug} → /navody/${g}`).toBe(true);
    }
  });

  it("gate: internal links in the texts resolve (R2.9 rules) and never point into a closed section", async () => {
    const { HELP_ARTICLES, GUIDES, launch } = await load();
    const slugs = { navody: new Set(GUIDES.map((g) => g.slug)), napoveda: new Set(HELP_ARTICLES.map((a) => a.slug)) };
    const broken: string[] = [];
    const closed: string[] = [];
    for (const a of HELP_ARTICLES) {
      for (const link of mdLinks(await rawTexts(a.slug))) {
        if (!resolvesPath(link, slugs)) broken.push(`${a.slug}: ${link}`);
        if (launch.isClosed(link.split(/[?#]/)[0]!)) closed.push(`${a.slug}: ${link}`);
      }
    }
    expect(broken).toEqual([]);
    // web na uzavřené sekce neodkazuje (eet-open-site); odkaz do pokladny přidává až HelpCta po otevření
    expect(closed).toEqual([]);
  });

  it("gate: legal facts come from FACTS (verbatim) – offline window, certificate validity, units, POK, receipts, vouchers", async () => {
    const { FACTS } = await import("@/content/facts");
    expect(await rawTexts("prodej-bez-signalu")).toContain(FACTS.offline.summary);
    expect(await rawTexts("platnost-certifikatu")).toContain(FACTS.certificate.summary);
    expect(FACTS.certificate.summary).toContain("366 dní");
    expect(await rawTexts("evidencni-jednotky")).toContain(FACTS.units.summary);
    expect(await rawTexts("zmeny-v-provozovne")).toContain(FACTS.units.change);
    expect(await rawTexts("pok-na-uctence")).toContain(FACTS.confirmation.summary);
    expect(await rawTexts("pok-na-uctence")).toContain(FACTS.confirmation.onReceipt);
    expect(await rawTexts("tisk-uctenky")).toContain(FACTS.receipt.summary);
    expect(await rawTexts("poukazy-kredit-zalohy")).toContain(FACTS.evidenced.prepayments);
  });

  it("gate: the support e-mail is the site one; no pokladna-promise phrases switched in lib/site.ts (R11, R12.1)", async () => {
    const { SITE } = await import("@/lib/site");
    expect(SITE.email).toBe("ahoj@evidujzdarma.cz");
    expect(await rawTexts("podpora")).toContain(SITE.email);
    const { HELP_ARTICLES } = await load();
    const all = JSON.stringify(HELP_ARTICLES);
    expect(all).not.toMatch(/nabízíme práci bez signálu|Naše pokladna tržbu uloží|ukazuje u každé neodeslané tržby|podpis řeší sama|[Ff]unguje i bez signálu/);
  });
});

describe("S2-A – closed cash register (until 2. 11. 2026)", () => {
  it("gate: hub and every article are noindex,follow", async () => {
    const { HELP_ARTICLES, launch } = await load();
    expect(launch.isClosed("/pokladna")).toBe(true);
    const hub = await import("@/app/(site)/napoveda/page");
    expect(hub.metadata.robots).toEqual({ index: false, follow: true });
    for (const a of HELP_ARTICLES) {
      const m = await articleMeta(a.slug);
      expect(m.robots, a.slug).toEqual({ index: false, follow: true });
      expect((m.alternates as { canonical?: string }).canonical, a.slug).toBe(`/napoveda/${a.slug}`);
    }
  });

  it("gate: not in the sitemap (= not tracked, R16.1) nor in llms.txt", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const { sitePages } = await import("@/lib/site-pages");
    const { SITE_URL } = await import("@/lib/site");
    const urls = sitemap().map((e) => e.url.slice(SITE_URL.length) || "/");
    expect(urls.filter((u) => u.startsWith("/napoveda"))).toEqual([]);
    expect(sitePages().filter((p) => p.path.startsWith("/napoveda"))).toEqual([]);
    // sitemap a rejstřík měření jsou jeden zdroj (R16.1)
    expect(urls).toEqual(sitePages().map((p) => p.path));
    const { llmsTxt, llmsFullTxt } = await import("@/lib/llms");
    expect(llmsTxt()).not.toContain("/napoveda");
    expect(llmsFullTxt()).not.toContain("/napoveda");
  });

  it("gate: the note on top, and no link into the closed cash register (hub and articles)", async () => {
    const { HELP_ARTICLES, launch } = await load();
    const pages: [string, string][] = [["hub", await renderHub()]];
    for (const a of HELP_ARTICLES) pages.push([a.slug, await renderArticle(a.slug)]);
    for (const [name, html] of pages) {
      expect(html, name).toContain(NOTE);
      const bad = hrefs(html).filter((h) => h.startsWith("/") && launch.isClosed(h.split(/[?#]/)[0]!));
      expect(bad, name).toEqual([]);
      // výzva k akci zve k předregistraci
      expect(html, name).toContain('href="/#registrace"');
    }
  });

  it("gate: the footer links to /napoveda („Nápověda“ in Služba)", async () => {
    const { SiteFooter } = await import("@/components/site-footer");
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toMatch(/<a[^>]+href="\/napoveda"[^>]*>Nápověda<\/a>/);
  });
});

describe("S2-A – open cash register (after the launch commit)", () => {
  it("gate: hub and articles become indexable by themselves", async () => {
    mockLaunch("open");
    const { HELP_ARTICLES, launch } = await load();
    expect(launch.isClosed("/pokladna")).toBe(false);
    const hub = await import("@/app/(site)/napoveda/page");
    expect(hub.metadata.robots).toBeUndefined();
    for (const a of HELP_ARTICLES) expect((await articleMeta(a.slug)).robots, a.slug).toBeUndefined();
  });

  it("gate: in the sitemap and in llms.txt", async () => {
    mockLaunch("open");
    const { HELP_ARTICLES } = await load();
    const { default: sitemap } = await import("@/app/sitemap");
    const { sitePages } = await import("@/lib/site-pages");
    const { SITE_URL } = await import("@/lib/site");
    const urls = sitemap().map((e) => e.url.slice(SITE_URL.length) || "/");
    expect(urls).toContain("/napoveda");
    for (const a of HELP_ARTICLES) expect(urls, a.slug).toContain(`/napoveda/${a.slug}`);
    expect(urls).toEqual(sitePages().map((p) => p.path));
    for (const e of sitemap().filter((x) => x.url.includes("/napoveda"))) expect(String(e.lastModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toContain(`(${SITE_URL}/napoveda)`);
  });

  it("gate: no launch note; the call to action leads into the cash register", async () => {
    mockLaunch("open");
    const hub = await renderHub();
    const art = await renderArticle("prvni-prodej");
    for (const html of [hub, art]) {
      expect(html).not.toContain(NOTE);
      expect(hrefs(html)).toContain("/pokladna");
    }
  });
});

describe("S2-A – structured data", () => {
  it("gate: step articles carry HowTo (steps verbatim, plain text) and every page a BreadcrumbList", async () => {
    const { HELP_ARTICLES, helpJsonLd } = await load();
    const { plainText } = await import("@/components/rich-text");
    const { SITE_URL } = await import("@/lib/site");
    for (const a of HELP_ARTICLES) {
      const html = await renderArticle(a.slug);
      expect(html, a.slug).toContain('"@type":"BreadcrumbList"');
      expect(html, a.slug).toContain(`"item":"${SITE_URL}/napoveda/${a.slug}"`);
      const ld = helpJsonLd(a);
      if (a.steps?.length) {
        expect(html, a.slug).toContain('"@type":"HowTo"');
        const howTo = ld[0] as { name: string; step: { name: string; text: string; position: number }[] };
        expect(howTo.name).toBe(a.title);
        expect(howTo.step.map((s) => s.name)).toEqual(a.steps.map((s) => s.name));
        expect(howTo.step.map((s) => s.text)).toEqual(a.steps.map((s) => plainText(s.text)));
        for (const s of howTo.step) expect(s.text, a.slug).not.toMatch(/\*\*|\]\(/);
      } else {
        expect(ld, a.slug).toEqual([]);
        expect(html, a.slug).not.toContain('"@type":"HowTo"');
      }
    }
  });

  it("gate: unreviewed guides are not linked from help pages (Ф9)", async () => {
    const { HELP_ARTICLES } = await load();
    const { GUIDES, isIndexable } = await import("@/content/guides");
    const drafts = GUIDES.filter((g) => !isIndexable(g)).map((g) => `/navody/${g.slug}`);
    for (const a of HELP_ARTICLES) {
      const links = hrefs(await renderArticle(a.slug));
      for (const d of drafts) expect(links, a.slug).not.toContain(d);
    }
  });
});

describe("S2-A – links from the app", () => {
  it("gate: settings header and the unregistered screen link to the help", async () => {
    const { readFileSync } = await import("node:fs");
    const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
    expect(src("components/setup/setup-app.tsx")).toMatch(/<Link href="\/napoveda" target="_blank" className="btn-secondary">\s*Nápověda\s*<\/Link>/);
    expect(src("components/pos/pos-app.tsx")).toContain('href="/napoveda/prvni-spusteni"');
  });
});
