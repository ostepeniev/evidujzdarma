/**
 * S5-SLUŽBY (26. 10. 2026, rozhodnutí majitele): placená technická pomoc „Nastavení EET na klíč“.
 *  - 990 Kč, písemně, bez telefonu; poptávka formulářem nebo e-mailem na ahoj@;
 *  - daňovou část (EET ON/OFF, přihlášení k EET OFF) nenabízíme, dokud nemáme partnerskou daňovou poradkyni
 *    (zákon č. 523/1992 Sb.) – TAX_PARTNER.enabled = false;
 *  - trychtýř: kalkulačka EET OFF, stránky „EET pro …“, praktické návody, patička, ceník, llms.txt;
 *  - dva nové návody jako koncepty (noindex do revize, Ф9).
 */
import { readFileSync } from "node:fs";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SOURCES } from "@/content/facts";
import { GUIDES, getGuide, isIndexable } from "@/content/guides";
import { ADDONS, STATUS_LABEL } from "@/content/pricing";
import { SERVICE_CTA_GUIDES, SERVICE_FAQ, SETUP_SERVICE, TAX_PARTNER, setupIncludes } from "@/content/services";
import { SITUATIONS, situationRows } from "@/content/guides/eet-on-nebo-off-modelove-situace";
import { calculateEetOff } from "@/lib/eet-off";
import { guideMetadata } from "@/lib/guide-page";
import { STATIC_PAGES } from "@/lib/static-pages";
import { SITE, absoluteUrl } from "@/lib/site";
import { pageText } from "./helpers/render-text";

const NEW_GUIDES = ["eet-on-nebo-off-modelove-situace", "kdo-pomuze-s-eet"] as const;
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
const sentences = (s: string) => plain(s).split(/(?<=[.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/).filter(Boolean);
const words = (s: string) => plain(s).split(/\s+/).filter(Boolean).length;
const PHONE = /\+?420[\s\d]{9,}|tel:/;

describe("S5 – the service and its price", () => {
  it("gate: owner's decision – 990 Kč, written, payment after completion; the pricing add-on agrees", () => {
    expect(SETUP_SERVICE.price).toBe(990);
    expect(SETUP_SERVICE.priceLabel).toBe("990 Kč");
    expect(SETUP_SERVICE.payment).toContain("až po dokončení");
    const a = ADDONS.find((x) => x.id === "nastaveni")!;
    expect(a).toMatchObject({ price: 990, priceLabel: "990 Kč", status: "order", cta: { href: "/nastaveni-na-klic" } });
    expect(a.text).toContain("bez telefonování");
    expect(STATUS_LABEL.order).toBe("Lze objednat");
  });

  it("gate: no tax advice is sold – TAX_PARTNER off, the notice cites the reason", () => {
    expect(TAX_PARTNER.enabled).toBe(false);
    expect(TAX_PARTNER.notice).toContain("daňové poradenství");
    expect(TAX_PARTNER.notice).toContain("jen daňový poradce");
    expect(SERVICE_FAQ.find((f) => f.q.includes("EET OFF"))!.a).toContain(TAX_PARTNER.notice);
  });

  it("gate: we never ask for the DIS+ login or the certificate file (návod jak-aktivovat-dis-a-certifikat)", () => {
    const all = [...setupIncludes(), ...SERVICE_FAQ.map((f) => f.a)].join(" ");
    expect(all).toContain("přihlašovací údaje nikomu nedávejte – ani nám");
    expect(all).toContain("soubor certifikátu (.p12) a jeho heslo");
    expect(setupIncludes().join(" ")).not.toMatch(/za vás/);
  });
});

describe("S5 – the page /nastaveni-na-klic", () => {
  it("gate: metadata – title ≤ 60, description 140–160, canonical", async () => {
    const { metadata } = await import("@/app/(site)/nastaveni-na-klic/page");
    const title = (metadata.title as { absolute: string }).absolute;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(metadata.description!.length).toBeGreaterThanOrEqual(140);
    expect(metadata.description!.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("/nastaveni-na-klic");
  });

  it("gate: price, steps, deadlines, the tax notice, the form and the e-mail – and no phone number", async () => {
    const { default: Page } = await import("@/app/(site)/nastaveni-na-klic/page");
    const html = renderToStaticMarkup(createElement(Page as FC));
    const t = pageText(Page as FC);
    for (const s of ["990 Kč", "Jak to probíhá", "Termíny, které hlídáme", "11. 1. 2027", "1. 11. 2026", TAX_PARTNER.notice, "Poptat nastavení na klíč", SITE.email]) {
      expect(t, s).toContain(s);
    }
    expect(html).toContain('data-service-order="form"');
    expect(html).toContain('href="/kalkulacka-eet-off"');
    expect(html).toContain(`mailto:${SITE.email}`);
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain('"price":"990"');
    expect(html).not.toMatch(PHONE);
  });

  it("gate: the page is in STATIC_PAGES, the sitemap and llms.txt", async () => {
    expect(STATIC_PAGES.find((p) => p.path === "/nastaveni-na-klic")).toMatchObject({ modified: "2026-10-26" });
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).toContain(absoluteUrl("/nastaveni-na-klic"));
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toContain("(https://evidujzdarma.cz/nastaveni-na-klic)");
    expect(llmsTxt()).toContain("Daňové poradenství (EET ON/OFF) neposkytujeme.");
  });

  it("gate: the order form posts to /api/poptavka, has no phone field and reports service_order to Clarity", () => {
    const f = src("components/service-order-form.tsx");
    expect(f).toContain('fetch("/api/poptavka"');
    expect(f).not.toMatch(/type="tel"|name="phone"/);
    expect(f).toContain('clarityEvent("service_order")');
    expect(src("lib/clarity-event.ts")).toContain('"service_order"');
  });
});

describe("S5 – the funnel leads to the page", () => {
  it("gate: calculator, obor landings, guides, footer and pricing link to /nastaveni-na-klic", async () => {
    const { default: Calc } = await import("@/app/(site)/kalkulacka-eet-off/page");
    expect(renderToStaticMarkup(createElement(Calc as FC))).toMatch(/data-service-cta="calculator"[\s\S]*?href="\/nastaveni-na-klic"/);
    expect(src("app/(site)/eet-pro/[obor]/page.tsx")).toMatch(/href="\/nastaveni-na-klic"[^>]*data-service-cta="obor"/);
    expect(src("app/(site)/navody/[slug]/page.tsx")).toMatch(/SERVICE_CTA_GUIDES\.includes\(g\.slug\)/);
    expect(src("components/site-footer.tsx")).toContain('{ href: "/nastaveni-na-klic", label: "Nastavení EET na klíč" }');
    for (const slug of SERVICE_CTA_GUIDES) expect(getGuide(slug), slug).toBeTruthy();
  });
});

describe("S5 – privacy policy", () => {
  it("gate: a purpose row for the order, PRIVACY_VERSION 2026-10-26-s5", async () => {
    const { default: Privacy } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const t = pageText(Privacy as FC);
    expect(t).toContain("Poptávka služby Nastavení EET na klíč");
    expect(t).toContain("zvláštní databázi poptávek nevedeme");
    const { PRIVACY_VERSION, PRIVACY_DATE_ISO } = await import("@/lib/legal");
    expect(PRIVACY_VERSION).toBe("2026-10-26-s5");
    expect(PRIVACY_DATE_ISO).toBe("2026-10-26");
  });
});

describe("S5 – two new guides (drafts until the review)", () => {
  it("gate: drafts – reviewedBy null, noindex, out of the sitemap, llms.txt and MCP; registered in GUIDES", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = sitemap().map((e) => e.url);
    const { llmsTxt, llmsFullTxt } = await import("@/lib/llms");
    const { publicGuides } = await import("@/lib/mcp/guides");
    for (const slug of NEW_GUIDES) {
      const g = getGuide(slug)!;
      expect(GUIDES).toContain(g);
      expect(g.reviewedBy, slug).toBeNull();
      expect(isIndexable(g), slug).toBe(false);
      expect(guideMetadata(g).robots, slug).toEqual({ index: false, follow: true });
      expect(urls, slug).not.toContain(absoluteUrl(`/navody/${slug}`));
      expect(llmsTxt(), slug).not.toContain(`/navody/${slug})`);
      expect(llmsFullTxt(), slug).not.toContain(`/navody/${slug}`);
      expect(publicGuides().map((x) => x.slug), slug).not.toContain(slug);
    }
  });

  it("gate: shape – title ≤ 60, description 140–160, lead 2–3 sentences / 40–60 words with 1. 1. 2027, 3–5 summary, ≥ 4 FAQ, HowTo ≥ 3", () => {
    const ALL_SOURCES = new Set<string>(Object.values(SOURCES).map((s) => s.url));
    for (const slug of NEW_GUIDES) {
      const g = getGuide(slug)!;
      expect(g.title.length, `${slug} title`).toBeLessThanOrEqual(60);
      expect(g.description.length, `${slug} description ${g.description.length}`).toBeGreaterThanOrEqual(140);
      expect(g.description.length, `${slug} description ${g.description.length}`).toBeLessThanOrEqual(160);
      expect(sentences(g.lead).length, `${slug} lead sentences ${JSON.stringify(sentences(g.lead))}`).toBeGreaterThanOrEqual(2);
      expect(sentences(g.lead).length, `${slug} lead sentences`).toBeLessThanOrEqual(3);
      expect(words(g.lead), `${slug} lead words`).toBeGreaterThanOrEqual(40);
      expect(words(g.lead), `${slug} lead words`).toBeLessThanOrEqual(60);
      expect(g.lead).toMatch(/1\. 1\. 2027/);
      expect(g.summary.length).toBeGreaterThanOrEqual(3);
      expect(g.summary.length).toBeLessThanOrEqual(5);
      expect(g.faq!.length).toBeGreaterThanOrEqual(4);
      expect(g.howTo!.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of g.sources) expect(ALL_SOURCES.has(s.url), `${slug} ${s.url}`).toBe(true);
      for (const r of g.related) expect(isIndexable(getGuide(r)!), `${slug} → ${r}`).toBe(true);
      expect(g.changelog?.[0]).toEqual({ date: "2026-10-26", text: "Nový návod – čeká na odbornou revizi." });
    }
  });

  it("gate: model situations use the calculator – 4 × evidence, 1 × EET OFF, all eligible", () => {
    const verdicts = SITUATIONS.map((s) => {
      const r = calculateEetOff(s.input);
      expect(r.eligible, s.who).toBe(true);
      return r.eligible ? r.verdict : null;
    });
    expect(verdicts.filter((v) => v === "evidence")).toHaveLength(4);
    expect(verdicts.filter((v) => v === "eet-off")).toHaveLength(1);
    expect(situationRows().map((r) => r[3])).toEqual(["Evidovat (EET ON)", "Evidovat (EET ON)", "Evidovat (EET ON)", "Evidovat (EET ON)", "EET OFF"]);
    expect(JSON.stringify(getGuide("eet-on-nebo-off-modelove-situace"))).toContain("U čtyř z pěti situací vychází evidence levněji");
  });

  it("gate: the tax-advice guide cites zákon č. 523/1992 Sb. and keeps the certificate private", () => {
    const g = getGuide("kdo-pomuze-s-eet")!;
    expect(g.sources).toContain(SOURCES.zakonDanPoradenstvi);
    const t = JSON.stringify(g);
    expect(t).toContain("Soustavně a za úplatu ho smí poskytovat jen daňový poradce");
    expect(t).toContain("nikomu neposílejte e-mailem");
  });
});

describe("S5 – decision record", () => {
  it("gate: DECISIONS К12 records the service, the price and the tax-advice limit", () => {
    const d = readFileSync(new URL("../../../docs/DECISIONS.md", import.meta.url), "utf8");
    const k12 = d.split("\n").find((l) => l.startsWith("- К12 "));
    expect(k12).toBeDefined();
    for (const x of ["990 Kč", "523/1992", "TAX_PARTNER", "/api/poptavka", "Хелен"]) expect(k12).toContain(x);
  });
});
