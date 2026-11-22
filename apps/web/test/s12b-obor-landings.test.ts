/**
 * S12b (22. 11. 2026):
 *  A – další stránky „EET pro …“ (veterináři, wellness a fitness, taxi, kosmetický salon, hospoda, realitní kancelář,
 *      svobodná povolání, farmy, horské ubytování, obchody, stánky a zmrzlina, rychlé občerstvení, e-shop s vlastními
 *      výrobky) jako koncepty do revize: noindex, mimo sitemap, llms.txt, katalog i bannery v návodech; rozcestník /eet-pro;
 *  B – návod „Tiskárna na účtenky“ (koncept) a ceník pro dotazy „bez měsíčních poplatků“ a „pro více uživatelů“;
 *  C – pilíř /ucetnictvi-bez-chaosu s čekací listinou bety Doklady k platbám (zájem "doklady") a pět článků clusteru (koncepty).
 */
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
}));

const S12_LANDINGS = [
  "veterinari",
  "wellness-a-fitness",
  "taxi",
  "kosmeticky-salon",
  "hospoda",
  "realitni-kancelar",
  "svobodna-povolani",
  "farmy-a-farmarske-trhy",
  "ubytovani-na-horach",
  "obchody-a-prodejny",
  "stanky-a-zmrzlina",
  "rychle-obcerstveni",
  "eshop-vlastni-vyrobky",
] as const;
const S12_GUIDES = [
  "tiskarna-na-uctenky",
  "co-ucetni-potrebuje-kazdy-mesic",
  "chybejici-doklady-k-platbam",
  "pokladni-kniha-eet-a-banka",
  "proc-ucetni-chce-faktury",
  "parovani-plateb-s-doklady",
] as const;
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

async function renderLanding(slug: string): Promise<string> {
  const { default: Page } = await import("@/app/(site)/eet-pro/[obor]/page");
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ obor: slug }) } as never)) as ReactElement);
}

mockLaunch("open");
afterEach(() => mockLaunch("open"));

describe("S12b A – obor landings (drafts until the review)", () => {
  it("gate: 13 new landings, static params, all pending review → noindex, out of sitemap, llms.txt, catalog panel and guide banners", async () => {
    const { OBOR_LANDINGS, getLanding, isLandingIndexable, landingsForGuide, landingsForIndustry } = await import("@/content/obor-landings");
    const page = await import("@/app/(site)/eet-pro/[obor]/page");
    expect(page.generateStaticParams().map((p) => p.obor)).toEqual(["kadernice", "bistro", "restaurace", ...S12_LANDINGS]);
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = sitemap().map((e) => e.url);
    const { llmsTxt } = await import("@/lib/llms");
    for (const slug of S12_LANDINGS) {
      const l = getLanding(slug)!;
      expect(l.pendingReview, slug).toBe(true);
      expect(isLandingIndexable(l), slug).toBe(false);
      const m = await page.generateMetadata({ params: Promise.resolve({ obor: slug }) } as never);
      expect(m.robots, slug).toEqual({ index: false, follow: true });
      expect(urls, slug).not.toContain(`https://evidujzdarma.cz/eet-pro/${slug}`);
      expect(llmsTxt(), slug).not.toContain(`/eet-pro/${slug})`);
      expect(landingsForGuide(l.guideSlug).map((x) => x.slug), slug).not.toContain(slug);
      expect(landingsForIndustry(l.industry).map((x) => x.slug), slug).not.toContain(slug);
    }
    // první tři zůstávají v indexu
    for (const s of ["kadernice", "bistro", "restaurace"]) expect(isLandingIndexable(getLanding(s)!)).toBe(true);
    expect(OBOR_LANDINGS).toHaveLength(16);
  });

  it("gate: shape – title ≤ 60, description 140–160 in both states, ≥ 4 questions with a gate, 4 pains, 6 features, FAQ ≥ 6, reviewed backing guide", async () => {
    const { getGuide, isIndexable } = await import("@/content/guides");
    for (const state of ["closed", "open"] as const) {
      mockLaunch(state);
      const { getLanding, landingFaq } = await import("@/content/obor-landings");
      for (const slug of S12_LANDINGS) {
        const l = getLanding(slug)!;
        expect(l.title, slug).toMatch(/^EET pro /);
        expect(l.title.length, `${slug} ${l.title}`).toBeLessThanOrEqual(60);
        const d = l.description();
        expect(d.length, `${state} ${slug} ${d}`).toBeGreaterThanOrEqual(140);
        expect(d.length, `${state} ${slug} ${d}`).toBeLessThanOrEqual(160);
        expect(l.questions.length, slug).toBeGreaterThanOrEqual(4);
        expect(l.questions[0]!.gate, slug).toBe(true);
        expect(l.questions[0]!.no?.text, slug).toContain("/musim-evidovat");
        for (const q of l.questions) expect(q.yes ?? q.no, `${slug} ${q.id}`).toBeTruthy();
        expect(l.pains, slug).toHaveLength(4);
        expect(l.features, slug).toHaveLength(6);
        const g = getGuide(l.guideSlug);
        expect(g && isIndexable(g), slug).toBe(true);
        expect(landingFaq(l).length, slug).toBeGreaterThanOrEqual(6);
        const json = JSON.stringify(l);
        expect(json, slug).not.toMatch(/50 000/);
        // tón: bez strašení a bez „zavřou vás“
        expect(json, slug).not.toMatch(/zavřou|hrozí vám|pokuta až/i);
      }
    }
  });

  it("gate: unique copy – no two landings share a lead, an h1, a pain or a question", async () => {
    const { OBOR_LANDINGS } = await import("@/content/obor-landings");
    const seen = new Map<string, string>();
    for (const l of OBOR_LANDINGS) {
      for (const t of [l.lead, l.h1, l.title, ...l.pains.map((p) => p.text), ...l.questions.map((q) => q.q)]) {
        if (/^Jste OSVČ v 1\. pásmu/.test(t)) continue; // otázka na EET OFF je záměrně stejná
        expect(seen.get(t), `${l.slug}: ${t}`).toBeUndefined();
        seen.set(t, l.slug);
      }
    }
  });

  it("gate: render – FAQPage, registration CTA, Nastavení na klíč, honest draft note with date and eet.gov.cz", async () => {
    for (const slug of S12_LANDINGS) {
      const html = await renderLanding(slug);
      expect(html, slug).toContain('"@type":"FAQPage"');
      expect(html, slug).toContain('href="#kontrola"');
      expect(html, slug).toContain('href="/nastaveni-na-klic"');
      expect(html, slug).toContain("990 Kč bez DPH");
      expect(html, slug).toContain("čeká na odbornou revizi");
      expect(html, slug).toContain("Stav k 22. 11. 2026");
      expect(html, slug).toContain('href="https://eet.gov.cz"');
      expect(html, slug).not.toContain("prošel odbornou revizí");
    }
    expect(await renderLanding("ubytovani-na-horach")).toContain('href="/eet-api"');
    expect(await renderLanding("eshop-vlastni-vyrobky")).toContain('href="/navody/eet-eshop-dobirka"');
    // zavřená pokladna → předregistrace s oborem
    mockLaunch("closed");
    expect(await renderLanding("taxi")).toMatch(/<option value="doprava-taxi" selected="">/);
  });

  it("gate: hub /eet-pro lists only indexable landings; footer links the hub", async () => {
    const { default: Hub, metadata } = await import("@/app/(site)/eet-pro/page");
    const html = renderToStaticMarkup(Hub() as ReactElement);
    for (const s of ["kadernice", "bistro", "restaurace"]) expect(html).toContain(`href="/eet-pro/${s}"`);
    for (const s of S12_LANDINGS) expect(html, s).not.toContain(`href="/eet-pro/${s}"`);
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(140);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
    expect(src("components/site-footer.tsx")).toContain('{ href: "/eet-pro", label: "EET podle oboru" }');
    const { STATIC_PAGES } = await import("@/lib/static-pages");
    expect(STATIC_PAGES.map((p) => p.path)).toContain("/eet-pro");
  });
});

describe("S12b B/C – new guides are drafts", () => {
  it("gate: drafts – reviewedBy null, noindex, out of sitemap, llms.txt and MCP; shape; related only indexable", async () => {
    const { SOURCES } = await import("@/content/facts");
    const { GUIDES, getGuide, isIndexable } = await import("@/content/guides");
    const { guideMetadata } = await import("@/lib/guide-page");
    const { default: sitemap } = await import("@/app/sitemap");
    const { llmsTxt, llmsFullTxt } = await import("@/lib/llms");
    const { publicGuides } = await import("@/lib/mcp/guides");
    const ALL = new Set<string>(Object.values(SOURCES).map((s) => s.url));
    const urls = sitemap().map((e) => e.url);
    for (const slug of S12_GUIDES) {
      const g = getGuide(slug)!;
      expect(GUIDES, slug).toContain(g);
      expect(g.reviewedBy, slug).toBeNull();
      expect(isIndexable(g), slug).toBe(false);
      expect(guideMetadata(g).robots, slug).toEqual({ index: false, follow: true });
      expect(urls, slug).not.toContain(`https://evidujzdarma.cz/navody/${slug}`);
      expect(llmsTxt(), slug).not.toContain(`/navody/${slug})`);
      expect(llmsFullTxt(), slug).not.toContain(`/navody/${slug}`);
      expect(publicGuides().map((x) => x.slug), slug).not.toContain(slug);
      expect(g.title.length, slug).toBeLessThanOrEqual(60);
      expect(g.description.length, `${slug} ${g.description.length}`).toBeGreaterThanOrEqual(140);
      expect(g.description.length, `${slug} ${g.description.length}`).toBeLessThanOrEqual(160);
      expect(g.summary.length, slug).toBeGreaterThanOrEqual(3);
      expect(g.summary.length, slug).toBeLessThanOrEqual(5);
      expect(g.faq!.length, slug).toBeGreaterThanOrEqual(3);
      for (const s of g.sources) expect(ALL.has(s.url), `${slug} ${s.url}`).toBe(true);
      for (const r of g.related) expect(isIndexable(getGuide(r)!), `${slug} → ${r}`).toBe(true);
      expect(g.changelog?.[0], slug).toEqual({ date: "2026-11-22", text: "Nový návod – čeká na odbornou revizi." });
    }
  });

  it("gate: printer guide – no brand recommendations, honest about Bluetooth LE / Safari / USB, receipt not required", async () => {
    const { getGuide } = await import("@/content/guides");
    const { FACTS } = await import("@/content/facts");
    const t = JSON.stringify(getGuide("tiskarna-na-uctenky"));
    expect(t).not.toMatch(/Epson|Zebra|Star Micronics|Xprinter|Goojprt|Sunmi|Bixolon|Citizen|PT-210|MTP-II/i);
    for (const x of ["Bluetooth LE", "ESC/POS", "Safari", "USB", "32 znaků", "bez diakritiky", "nedoporučujeme"]) expect(t).toContain(x);
    expect(t).toContain(FACTS.receipt.summary);
    expect(t).toContain(FACTS.confirmation.onReceipt);
  });

  it("gate: cluster tone – respectful to accountants, no 'accountants make mistakes'", async () => {
    const { getGuide } = await import("@/content/guides");
    for (const slug of S12_GUIDES.slice(1)) {
      const t = JSON.stringify(getGuide(slug));
      expect(t, slug).not.toMatch(/účetní (často |dělají |dělá )?chyb/i);
    }
  });
});

describe("S12b B – pricing for 'bez měsíčních poplatků' and 'více uživatelů'", () => {
  it("gate: cenik title, description and FAQ", async () => {
    const { metadata } = await import("@/app/(site)/cenik/page");
    expect(metadata.title).toBe("Ceník – pokladna EET bez měsíčních poplatků");
    const d = metadata.description as string;
    expect(d).toContain("bez měsíčních poplatků");
    expect(d.length).toBeGreaterThanOrEqual(140);
    expect(d.length).toBeLessThanOrEqual(160);
    const { PRICING_FAQ } = await import("@/content/pricing");
    const qs = PRICING_FAQ.map((f) => f.q);
    expect(qs).toContain("Má pokladna nějaké měsíční poplatky?");
    expect(qs).toContain("Kolik uživatelů může pokladnu používat zdarma?");
  });
});

describe("S12b C – pillar /ucetnictvi-bez-chaosu and the Doklady k platbám waitlist", () => {
  it("gate: interest 'doklady' with labels; no migration needed (campaign is varchar)", async () => {
    const { INTERESTS, INTEREST_LABEL, INTEREST_NEXT, INTEREST_REQUEST, isForPos } = await import("@/lib/interests");
    expect(INTERESTS).toContain("doklady");
    expect(INTEREST_LABEL.doklady).toContain("Doklady k platbám");
    expect(INTEREST_NEXT.doklady).toContain("Doklady k platbám");
    expect(INTEREST_REQUEST.doklady).toContain("Doklady k platbám");
    expect(isForPos(["doklady"])).toBe(false);
    const schema = readFileSync(new URL("../../../packages/db/src/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain('campaign: varchar("campaign", { length: 40 }).notNull()');
  });

  it("gate: pillar renders cluster links, honest beta status, FAQPage, form with interest doklady and an unchecked separate consent", async () => {
    const { default: Page, metadata } = await import("@/app/(site)/ucetnictvi-bez-chaosu/page");
    const html = renderToStaticMarkup(Page() as ReactElement);
    for (const slug of S12_GUIDES.slice(1)) expect(html, slug).toContain(`href="/navody/${slug}"`);
    expect(html).toContain("Připravujeme · beta zdarma pro uživatele EvidujZdarma");
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('data-interest-form="doklady"');
    expect(html).toMatch(/<input type="checkbox" class="[^"]*" name="marketing"\/>/);
    expect(html).not.toMatch(/name="marketing"[^>]*checked/);
    const form = src("components/doklady-waitlist-form.tsx");
    expect(form).toContain('interest: "doklady"');
    expect(form).toContain('fetch("/api/preregistrace"');
    expect(metadata.robots).toBeUndefined();
    const d = metadata.description as string;
    expect(d.length).toBeGreaterThanOrEqual(140);
    expect(d.length).toBeLessThanOrEqual(160);
    // tón vůči účetním
    expect(html).not.toMatch(/účetní (často |dělají |dělá )?chyb/i);
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).toContain("https://evidujzdarma.cz/ucetnictvi-bez-chaosu");
  });

  it("gate: linked from /ucetni and the footer; privacy names the new purpose and the version moved", async () => {
    expect(src("app/(site)/ucetni/page.tsx")).toContain('href="/ucetnictvi-bez-chaosu"');
    expect(src("components/site-footer.tsx")).toContain('{ href: "/ucetnictvi-bez-chaosu", label: "Doklady pro účetní bez chaosu" }');
    expect(src("app/(site)/ochrana-osobnich-udaju/page.tsx")).toContain("zájem o Účetní kabinet a o betu Doklady k platbám");
    const legal = await import("@/lib/legal");
    expect(legal.PRIVACY_VERSION).toBe("2026-11-22-s12");
    expect(legal.PRIVACY_DATE_ISO).toBe("2026-11-22");
  });
});
