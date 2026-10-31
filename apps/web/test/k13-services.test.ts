/**
 * К13 (31. 10. 2026, rozhodnutí majitele): placené služby, druhá verze.
 *  1. cena „Nastavení na klíč“ bez DPH + cena s DPH (plátce DPH, 21 %) z jediné konstanty – stránka, ceník, meta, JSON-LD, llms.txt;
 *  2. přesně 3 kroky služby; DIS+ i certifikát dělá klient sám (К12 platí);
 *  3. balíček „Připojení stávající pokladny“ – bez pevné ceny, v ceníku, na stránce, ve formuláři;
 *  4. návod pokladna-z-eet-1-0 jako koncept (noindex, mimo sitemap/llms/MCP);
 *  5. partnerská účetní kancelář na /o-nas, TAX_PARTNER vypnutý; 6. záznam К13 v DECISIONS.
 */
import { readFileSync } from "node:fs";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SOURCES } from "@/content/facts";
import { GUIDES, getGuide, isIndexable } from "@/content/guides";
import { ADDONS } from "@/content/pricing";
import {
  EXISTING_POS_SERVICE,
  SERVICE_CTA_GUIDES,
  SERVICE_PACKAGES,
  SERVICE_PARTNER_LINE,
  SERVICE_VAT_RATE,
  SETUP_PRICE_EX_VAT,
  SETUP_SERVICE,
  SETUP_STEPS,
  TAX_PARTNER,
} from "@/content/services";
import { guideMetadata } from "@/lib/guide-page";
import { absoluteUrl } from "@/lib/site";
import { pageText } from "./helpers/render-text";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const sp = (s: string) => s.replace(/ /g, " ");
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
const sentences = (s: string) => plain(s).split(/(?<=[.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/).filter(Boolean);
const words = (s: string) => plain(s).split(/\s+/).filter(Boolean).length;
const PRICE = "990 Kč bez DPH (1 197,90 Kč s DPH)";

type Ld = { "@type": string; offers?: unknown };
const ldBlocks = (html: string): Ld[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1]!)].flat());

describe("К13 – price without and with VAT from one constant", () => {
  it("gate: 990 Kč bez DPH, 21 %, 1 197,90 Kč s DPH – computed, not typed twice", () => {
    expect(SETUP_PRICE_EX_VAT).toBe(990);
    expect(SERVICE_VAT_RATE).toBe(21);
    expect(SETUP_SERVICE.price).toBe(SETUP_PRICE_EX_VAT);
    expect(SETUP_SERVICE.priceInclVat).toBe(1197.9);
    expect(sp(SETUP_SERVICE.priceLabel)).toBe(PRICE);
    expect(sp(SETUP_SERVICE.priceInclVatLabel)).toBe("1 197,90 Kč s DPH");
    // bez komentářů – v kódu se cena s DPH nikde nepíše natvrdo
    const s = src("content/services.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(s).not.toContain("1197");
    expect(s).not.toContain("1 197");
  });

  it("gate: the page shows both prices, meta has them, JSON-LD Offer = price with VAT + priceSpecification", async () => {
    const mod = await import("@/app/(site)/nastaveni-na-klic/page");
    const t = sp(pageText(mod.default as FC));
    expect(t).toContain("990 Kč bez DPH");
    expect(t).toContain("1 197,90 Kč s DPH");
    expect(t).toContain(PRICE);
    const desc = sp(mod.metadata.description!);
    expect(desc).toContain(PRICE);
    expect(desc.length).toBeGreaterThanOrEqual(140);
    expect(desc.length).toBeLessThanOrEqual(160);
    const title = (mod.metadata.title as { absolute: string }).absolute;
    expect(title).toBe("Nastavení EET na klíč za 990 Kč bez DPH");
    const service = ldBlocks(renderToStaticMarkup(createElement(mod.default as FC))).find((b) => b["@type"] === "Service")!;
    expect(service.offers).toMatchObject({
      price: "1197.90",
      priceCurrency: "CZK",
      priceSpecification: [
        { "@type": "PriceSpecification", price: 1197.9, valueAddedTaxIncluded: true },
        { "@type": "PriceSpecification", price: 990, valueAddedTaxIncluded: false },
      ],
    });
  });

  it("gate: /cenik – card with both prices, Offer with VAT; the individual package has no Offer", async () => {
    const { default: Pricing } = await import("@/app/(site)/cenik/page");
    const html = renderToStaticMarkup(createElement(Pricing as FC));
    const t = sp(pageText(Pricing as FC));
    expect(t).toContain("990 Kč bez DPH");
    expect(t).toContain("1 197,90 Kč s DPH");
    expect(t).toContain(EXISTING_POS_SERVICE.name);
    expect(t).toContain(EXISTING_POS_SERVICE.priceNote);
    const product = ldBlocks(html).find((b) => b["@type"] === "Product") as { offers: { name: string; price: string; priceSpecification?: unknown }[] };
    const setup = product.offers.find((o) => o.name === "Nastavení na klíč")!;
    expect(setup.price).toBe("1197.90");
    expect(JSON.stringify(setup.priceSpecification)).toContain('"valueAddedTaxIncluded":true');
    expect(product.offers.find((o) => o.name === EXISTING_POS_SERVICE.name)).toBeUndefined();
  });

  it("gate: llms.txt and the funnel texts carry the full price label", async () => {
    const { llmsTxt } = await import("@/lib/llms");
    const l = sp(llmsTxt());
    expect(l).toContain(PRICE);
    expect(l).toContain(`[${EXISTING_POS_SERVICE.name}](${absoluteUrl("/nastaveni-na-klic#stavajici-pokladna")})`);
    for (const f of ["app/(site)/navody/[slug]/page.tsx", "app/(site)/kalkulacka-eet-off/page.tsx", "app/(site)/eet-pro/[obor]/page.tsx"]) {
      expect(src(f), f).toContain("SETUP_SERVICE.priceLabel");
      expect(src(f), f).not.toMatch(/990 Kč/);
    }
  });
});

describe("К13 – three steps, the certificate stays with the client", () => {
  it("gate: exactly 3 steps in the owner's order", () => {
    expect(SETUP_STEPS.map((s) => s.title)).toEqual([
      "DIS+ a EET: přihlášení k evidenci a evidenční jednotky",
      "Připojení certifikátu (klíče) a zkušební spuštění",
      "Kontrola nastavení pokladny",
    ]);
    expect(SETUP_STEPS[1]!.text).toContain("soubor .p12 ani heslo nám neposíláte");
    const addon = ADDONS.find((a) => a.id === "nastaveni")!;
    expect(addon.bullets).toHaveLength(3);
  });
});

describe("К13 – package 'Připojení stávající pokladny'", () => {
  it("gate: no fixed price, three options, in the pricing add-ons with status order", () => {
    expect(EXISTING_POS_SERVICE.priceNote).toBe("cenu potvrdíme předem podle systému, bez DPH");
    expect(EXISTING_POS_SERVICE.options).toHaveLength(3);
    expect(JSON.stringify(EXISTING_POS_SERVICE.options)).toContain("heslo nám neposíláte");
    const a = ADDONS.find((x) => x.id === EXISTING_POS_SERVICE.id)!;
    expect(a).toMatchObject({ price: null, status: "order", cta: { href: "/nastaveni-na-klic#stavajici-pokladna" } });
  });

  it("gate: section on /nastaveni-na-klic with the options, the guide link and the 'why cheaper' block", async () => {
    const { default: Page } = await import("@/app/(site)/nastaveni-na-klic/page");
    const html = renderToStaticMarkup(createElement(Page as FC));
    const t = pageText(Page as FC);
    expect(html).toContain('id="stavajici-pokladna"');
    for (const o of EXISTING_POS_SERVICE.options) expect(t).toContain(o.title);
    expect(html).toContain('href="/navody/pokladna-z-eet-1-0"');
    expect(t).toContain("Proč může být EvidujZdarma pro malé podnikatele levnější");
    expect(t).toContain("Žádné placené výjezdy servisního technika");
    expect(t).toContain(SERVICE_PARTNER_LINE);
  });

  it("gate: the form offers both packages and the current cash register; the API validates the package", () => {
    expect(SERVICE_PACKAGES.map((p) => p.id)).toEqual(["nastaveni", "pripojeni"]);
    const f = src("components/service-order-form.tsx");
    expect(f).toContain("SERVICE_PACKAGES.map");
    expect(f).toContain('name="currentPos"');
    expect(f).toContain("package: pkg");
    const r = src("app/api/poptavka/route.ts");
    expect(r).toContain("z.enum([SETUP_SERVICE.id, EXISTING_POS_SERVICE.id])");
    expect(r).toContain("Současná pokladna:");
    for (const guard of ["isJsonRequest(req)", "rateLimit(`poptavka:${ip}`", "rateLimit(`poptavka-from:", "if (body.website)"]) expect(r).toContain(guard);
  });
});

describe("К13 – guide pokladna-z-eet-1-0 (draft)", () => {
  const g = getGuide("pokladna-z-eet-1-0")!;

  it("gate: draft – reviewedBy null, noindex, out of the sitemap, llms.txt and MCP; linked from the service", async () => {
    expect(GUIDES).toContain(g);
    expect(g.reviewedBy).toBeNull();
    expect(g.basis).toBeUndefined();
    expect(isIndexable(g)).toBe(false);
    expect(guideMetadata(g).robots).toEqual({ index: false, follow: true });
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).not.toContain(absoluteUrl(`/navody/${g.slug}`));
    const { llmsTxt, llmsFullTxt } = await import("@/lib/llms");
    expect(llmsTxt()).not.toContain(`/navody/${g.slug})`);
    expect(llmsFullTxt()).not.toContain(`/navody/${g.slug}`);
    const { publicGuides } = await import("@/lib/mcp/guides");
    expect(publicGuides().map((x) => x.slug)).not.toContain(g.slug);
    expect(SERVICE_CTA_GUIDES).toContain(g.slug);
  });

  it("gate: shape – title ≤ 60, description 140–160, lead 2–3 sentences / 40–60 words with 1. 1. 2027, 3–5 summary, ≥ 4 FAQ, HowTo ≥ 3", () => {
    const ALL_SOURCES = new Set<string>(Object.values(SOURCES).map((s) => s.url));
    expect(g.title.length).toBeLessThanOrEqual(60);
    expect(g.description.length, String(g.description.length)).toBeGreaterThanOrEqual(140);
    expect(g.description.length, String(g.description.length)).toBeLessThanOrEqual(160);
    expect(sentences(g.lead).length, JSON.stringify(sentences(g.lead))).toBeGreaterThanOrEqual(2);
    expect(sentences(g.lead).length).toBeLessThanOrEqual(3);
    expect(words(g.lead), String(words(g.lead))).toBeGreaterThanOrEqual(40);
    expect(words(g.lead), String(words(g.lead))).toBeLessThanOrEqual(60);
    expect(g.lead).toMatch(/1\. 1\. 2027/);
    expect(g.summary.length).toBeGreaterThanOrEqual(3);
    expect(g.summary.length).toBeLessThanOrEqual(5);
    expect(g.faq!.length).toBeGreaterThanOrEqual(4);
    expect(g.howTo!.steps.length).toBeGreaterThanOrEqual(3);
    for (const s of g.sources) expect(ALL_SOURCES.has(s.url), s.url).toBe(true);
    for (const r of g.related) expect(isIndexable(getGuide(r)!), r).toBe(true);
    expect(g.changelog?.[0]).toEqual({ date: "2026-10-31", text: "Nový návod – čeká na odbornou revizi." });
  });

  it("gate: content – the three options, the supplier checklist, DIS+ steps, the comparison link and both services", () => {
    const t = JSON.stringify(g);
    for (const o of EXISTING_POS_SERVICE.options) expect(t).toContain(o.title);
    for (const x of ["Podporuje pokladna EET 2.0?", "Je potřeba aktualizace?", "Kolik to bude stát?"]) expect(t).toContain(x);
    for (const x of ["(/navody/eet-2-0-vs-eet-1-0)", "(/nastaveni-na-klic)", "(/nastaveni-na-klic#stavajici-pokladna)", "(/navody/jak-aktivovat-dis-a-certifikat)"]) expect(t).toContain(x);
    expect(t).toContain("nová certifikační autorita EET v2.0");
  });
});

describe("К13 – partner and decision record", () => {
  it("gate: /o-nas names the partner accounting firm; TAX_PARTNER stays off", async () => {
    expect(SERVICE_PARTNER_LINE).toBe(
      "Partnerská účetní kancelář: Leader Business Consulting Group s.r.o., IČO 24181412, Praha 6 – pomáhá se složitějším nastavením pokladen.",
    );
    const { default: About } = await import("@/app/(site)/o-nas/page");
    expect(pageText(About as FC)).toContain(SERVICE_PARTNER_LINE);
    expect(TAX_PARTNER.enabled).toBe(false);
  });

  it("gate: DECISIONS К13 records price with VAT, 3 steps, the new package, the draft guide and the partner", () => {
    const d = readFileSync(new URL("../../../docs/DECISIONS.md", import.meta.url), "utf8");
    const k13 = d.split("\n").find((l) => l.startsWith("- К13 · 2026-10-31 · В · "));
    expect(k13).toBeDefined();
    for (const x of ["990 Kč bez DPH", "1 197,90 Kč s DPH", "Připojení stávající pokladny", "pokladna-z-eet-1-0", "24181412", "TAX_PARTNER"]) expect(k13).toContain(x);
  });
});
