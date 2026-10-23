/**
 * S4 (23. 10. 2026) – stránky „EET pro kadeřnice / bistro / restaurace“: rychlá kontrola, pokladna pro obor,
 * předregistrace s oborem a kampaní, odkazy z návodů a z katalogu, nový titulek kalkulačky EET OFF.
 */
import { readFileSync } from "node:fs";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
}));

const SLUGS = ["kadernice", "bistro", "restaurace"] as const;
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ");

async function renderLanding(slug: string): Promise<string> {
  const { default: Page } = await import("@/app/(site)/eet-pro/[obor]/page");
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ obor: slug }) } as never)) as ReactElement);
}

mockLaunch("closed");
afterEach(() => mockLaunch("closed"));

describe("S4 – obor landing pages", () => {
  it("gate: three pages, static params, sitemap and llms.txt", async () => {
    const page = await import("@/app/(site)/eet-pro/[obor]/page");
    expect(page.generateStaticParams().map((p) => p.obor)).toEqual([...SLUGS]);
    expect(page.dynamicParams).toBe(false);
    const { STATIC_PAGES } = await import("@/lib/static-pages");
    for (const s of SLUGS) expect(STATIC_PAGES.map((p) => p.path)).toContain(`/eet-pro/${s}`);
    const { llmsTxt } = await import("@/lib/llms");
    for (const s of SLUGS) expect(llmsTxt()).toContain(`https://evidujzdarma.cz/eet-pro/${s})`);
  });

  it("gate: absolute title ≤ 60, description 140–160 – closed and open", async () => {
    for (const state of ["closed", "open"] as const) {
      mockLaunch(state);
      const page = await import("@/app/(site)/eet-pro/[obor]/page");
      for (const s of SLUGS) {
        const m = await page.generateMetadata({ params: Promise.resolve({ obor: s }) } as never);
        const title = (m.title as { absolute: string }).absolute;
        expect(title, s).toMatch(/^EET pro /);
        expect(title.length, `${s} ${title}`).toBeLessThanOrEqual(60);
        const d = m.description as string;
        expect(d.length, `${state} ${s} ${d}`).toBeGreaterThanOrEqual(140);
        expect(d.length, `${state} ${s} ${d}`).toBeLessThanOrEqual(160);
        expect(d).toMatch(state === "closed" ? /předregistrujete pokladnu zdarma/ : /začnete evidovat zdarma/);
        expect(m.alternates?.canonical).toBe(`/eet-pro/${s}`);
      }
    }
  });

  it("gate: each landing has ≥ 4 questions, a gate question first, an answer for every question, only reviewed guides", async () => {
    const { OBOR_LANDINGS, landingFaq } = await import("@/content/obor-landings");
    const { getGuide, isIndexable } = await import("@/content/guides");
    for (const l of OBOR_LANDINGS) {
      expect(l.questions.length, l.slug).toBeGreaterThanOrEqual(4);
      expect(l.questions[0]!.gate, l.slug).toBe(true);
      expect(l.questions[0]!.no?.text, l.slug).toContain("/musim-evidovat");
      for (const q of l.questions) expect(q.yes ?? q.no, `${l.slug} ${q.id}`).toBeTruthy();
      expect(l.pains).toHaveLength(4);
      expect(l.features).toHaveLength(6);
      const g = getGuide(l.guideSlug);
      expect(g && isIndexable(g), l.slug).toBe(true);
      // FAQ: otázky z revidovaného návodu (doslovně) + produktové z úvodní stránky
      const faq = landingFaq(l);
      expect(faq.length).toBeGreaterThanOrEqual(6);
      for (const i of l.guideFaq) expect(faq.map((f) => f.q)).toContain(g!.faq![i]!.q);
      expect(faq.map((f) => f.q)).toContain("Je pokladna EvidujZdarma opravdu zdarma?");
      // žádná vymyšlená výjimka 50 000 Kč
      expect(JSON.stringify(l)).not.toMatch(/50 000/);
    }
  });

  it("gate: closed – no present tense about the register, local registration form with obor and campaign, honest 'what we lack'", async () => {
    for (const s of SLUGS) {
      const html = await renderLanding(s);
      const t = text(html);
      expect(t, s).not.toMatch(/[Ff]unguje i bez signálu/);
      expect(t, s).toContain("spouštíme 2. 11. 2026");
      expect(html, s).toContain('id="registrace"');
      expect(html, s).toContain('data-prereg-form="true"');
      expect(html, s).toContain('href="#registrace"');
      expect(html, s).toContain('href="#kontrola"');
      expect(t, s).toMatch(/nemáme/);
      expect(t, s).toContain("prošel odbornou revizí");
      expect(html, s).toContain('"@type":"FAQPage"');
    }
    // obor předvybraný ve formuláři
    expect(await renderLanding("kadernice")).toMatch(/<option value="kadernictvi-a-kosmetika" selected="">/);
    expect(await renderLanding("bistro")).toMatch(/<option value="restaurace-a-kavarny" selected="">/);
  });

  it("open → login CTA instead of the pre-registration form", async () => {
    mockLaunch("open");
    const html = await renderLanding("restaurace");
    expect(html).not.toContain("data-prereg-form");
    expect(html).toContain('href="/prihlaseni"');
  });

  it("gate: PreregForm sends obor UTM only when the URL has none; MobileCta jumps to the local form", () => {
    const form = src("components/prereg-form.tsx");
    expect(form).toContain('utm: readUtm() ?? (campaign ? { utm_source: "web", utm_medium: "obor", utm_campaign: campaign.slice(0, 100) } : undefined)');
    expect(form).toContain('defaultValue={industry ?? ""}');
    const cta = src("components/mobile-cta.tsx");
    expect(cta).toContain('document.querySelector("#registrace [data-prereg-form]")');
    expect(cta).toContain('href="#registrace"');
  });

  it("gate: obor guides link the landings; catalog EET panel links them by CZ-NACE", async () => {
    const { default: GuidePage } = await import("@/app/(site)/navody/[slug]/page");
    const k = renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: "eet-kadernictvi-kosmetika" }) } as never)) as ReactElement);
    expect(k).toContain('href="/eet-pro/kadernice"');
    const g = renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: "eet-gastronomie" }) } as never)) as ReactElement);
    expect(g).toContain('href="/eet-pro/bistro"');
    expect(g).toContain('href="/eet-pro/restaurace"');
    const other = renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: "eet-ubytovani" }) } as never)) as ReactElement);
    expect(other).not.toContain('href="/eet-pro/');

    const { EetPanel } = await import("@/components/catalog/eet-panel");
    const salon = renderToStaticMarkup(createElement(EetPanel as FC<Record<string, unknown>>, { relevance: "likely", nace: ["96021"] }));
    expect(salon).toContain('href="/eet-pro/kadernice"');
    expect(salon).toContain("Pokladna pro kadeřnictví zdarma");
    const gastro = renderToStaticMarkup(createElement(EetPanel as FC<Record<string, unknown>>, { relevance: "likely", nace: ["56101"] }));
    expect(gastro).toContain('href="/eet-pro/bistro"');
    expect(gastro).toContain('href="/eet-pro/restaurace"');
    const itFirm = renderToStaticMarkup(createElement(EetPanel as FC<Record<string, unknown>>, { relevance: "unlikely", nace: ["62010"] }));
    expect(itFirm).not.toContain("/eet-pro/");
  });

  it("gate: EET OFF calculator snippet starts with the searched phrase", async () => {
    const { metadata } = await import("@/app/(site)/kalkulacka-eet-off/page");
    expect(metadata.title).toBe("EET kalkulačka 2027: evidovat, nebo EET OFF?");
    expect(`${metadata.title as string} | EvidujZdarma`.length).toBeLessThanOrEqual(60);
    const d = metadata.description as string;
    expect(d.length).toBeGreaterThanOrEqual(140);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toContain("1 400 Kč");
    expect(d).toContain("Oznámení do 11. 1. 2027.");
  });
});
