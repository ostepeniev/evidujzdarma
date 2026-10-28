/**
 * S3-OPEN (17. 10. 2026): co se otevírá vyhledávačům po schválení účetní (Helena Jeřábková) a podle rozhodnutí majitele.
 *  1a) návody sleva-na-dani-za-eet a storno-a-vraceni-eet: revidované, index, sitemap, llms.txt, MCP, odkaz z pilíře;
 *  1b) peněžní kalkulačky (čistá mzda, OSVČ, spropitné): index, sitemap, /nastroje, llms.txt, „Odborná revize“ s datem;
 *  1c) vzor pověření: index, sitemap, /nastroje, llms.txt, odkaz z návodu Tržba za jiného;
 *  2) nápověda /napoveda: index, sitemap, llms.txt už před 2. 11. 2026; poznámka o aktuálnosti jen u článků o ovládání
 *     pokladny (seznam v lib/help-page.ts, těla článků se nemění) a jen dokud je pokladna zavřená; TechArticle s dateModified;
 *  3) faktura: dobrovolné zaškrtávátko „Uvést na faktuře, že je vystavená v EvidujZdarma.cz“ (výchozí nezaškrtnuto),
 *     na faktuře malým písmem „Vystaveno zdarma v EvidujZdarma.cz“ (i při tisku – uvnitř .doc-paper), nic se neukládá.
 */
import { readFileSync } from "node:fs";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";
import { pageText } from "./helpers/render-text";

vi.mock("@/lib/sitemap-registry", () => ({ extraSitemaps: async () => [] }));

// zavřená pokladna simulovaná ze skutečných seznamů – commit otevření 2. 11. test nerozbije (R17.2)
mockLaunch("closed");
afterEach(() => {
  mockLaunch("closed");
});

const NOTE = "Pokladnu EvidujZdarma spouštíme 2. 11. 2026. Návod popisuje, jak bude fungovat; po spuštění ho podle potřeby upřesníme. Aktuální k 17. 10. 2026.";
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));

async function sitemapPaths(): Promise<string[]> {
  const { default: sitemap } = await import("@/app/sitemap");
  const { SITE_URL } = await import("@/lib/site");
  return sitemap().map((e) => e.url.slice(SITE_URL.length) || "/");
}

async function renderHelp(slug?: string): Promise<string> {
  if (!slug) {
    const { default: Hub } = await import("@/app/(site)/napoveda/page");
    return renderToStaticMarkup(createElement(Hub as FC));
  }
  const { default: Page } = await import("@/app/(site)/napoveda/[slug]/page");
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ slug }) } as never)) as ReactElement);
}

describe("S3-OPEN 1a – guides sleva-na-dani-za-eet and storno-a-vraceni-eet reviewed", () => {
  const SLUGS = ["sleva-na-dani-za-eet", "storno-a-vraceni-eet"] as const;
  const S6_MODIFIED: Record<(typeof SLUGS)[number], string> = { "sleva-na-dani-za-eet": "2026-10-17", "storno-a-vraceni-eet": "2026-10-28" };

  it("gate: reviewedBy, changelog 2026-10-17 on top, indexable, robots not set, reviewedBy in JSON-LD", async () => {
    const { getGuide, guideModified, isIndexable } = await import("@/content/guides");
    const { guideJsonLd, guideMetadata } = await import("@/lib/guide-page");
    const { REVIEWER } = await import("@/lib/site");
    for (const slug of SLUGS) {
      const g = getGuide(slug)!;
      expect(g.reviewedBy, slug).toBe(REVIEWER.name);
      // S6-FS (28. 10. 2026) doplnilo storno podle prezentace MF a FS – záznam nad revizí, datum změny 28. 10.
      expect(g.changelog?.filter((c) => c.date <= "2026-10-17")[0], slug).toEqual({ date: "2026-10-17", text: "Návod prošel odbornou revizí (Helena Jeřábková)." });
      expect(guideModified(g), slug).toBe(S6_MODIFIED[slug]);
      expect(isIndexable(g), slug).toBe(true);
      expect(guideMetadata(g).robots, slug).toBeUndefined();
      expect(guideJsonLd(g).find((x) => x["@type"] === "Article"), slug).toHaveProperty("reviewedBy");
    }
  });

  it("gate: in the sitemap (lastmod 2026-10-17), llms.txt, llms-full.txt and the MCP index; the guide page shows the reviewer", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const { absoluteUrl } = await import("@/lib/site");
    const { llmsTxt, llmsFullTxt } = await import("@/lib/llms");
    const { publicGuides } = await import("@/lib/mcp/guides");
    const { default: GuidePage } = await import("@/app/(site)/navody/[slug]/page");
    for (const slug of SLUGS) {
      const e = sitemap().find((x) => x.url === absoluteUrl(`/navody/${slug}`));
      expect(e, slug).toBeTruthy();
      expect(String(e!.lastModified), slug).toBe(S6_MODIFIED[slug]);
      expect(llmsTxt(), slug).toContain(`(${absoluteUrl(`/navody/${slug}`)})`);
      expect(llmsFullTxt(), slug).toContain(`URL: ${absoluteUrl(`/navody/${slug}`)}`);
      expect(publicGuides().map((g) => g.slug), slug).toContain(slug);
      const html = renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug }) } as never)) as ReactElement);
      expect(html, slug).toMatch(/Odborná revize: <a [^>]*href="\/o-nas#odborna-revize"[^>]*>Helena Jeřábková<\/a>, účetní/);
      expect(html, slug).not.toContain("Před odbornou revizí");
    }
  });

  it("gate: the pillar links both (in its text) and logs it; related links only to indexable guides", async () => {
    const { GUIDES, getGuide, isIndexable } = await import("@/content/guides");
    const pillar = getGuide("eet-2-0-kompletni-pruvodce")!;
    const text = JSON.stringify(pillar.sections);
    for (const slug of SLUGS) expect(text, slug).toContain(`](/navody/${slug})`);
    expect(pillar.changelog?.[0]).toEqual({ date: "2026-10-17", text: "Doplněny odkazy na návody o slevě na dani a o stornu." });
    for (const g of GUIDES) for (const r of g.related) expect(isIndexable(getGuide(r)!), `${g.slug} → ${r}`).toBe(true);
    expect(getGuide("eet-off")!.related).toContain("sleva-na-dani-za-eet");
    expect(getGuide("eet-a-pausalni-dan")!.related).toContain("sleva-na-dani-za-eet");
    expect(getGuide("musim-vydavat-uctenku")!.related).toContain("storno-a-vraceni-eet");
  });
});

describe("S3-OPEN 1b/1c – money calculators and the authorization template", () => {
  const MONEY = ["/kalkulacka-cista-mzda", "/kalkulacka-osvc", "/kalkulacka-spropitne"];

  it("gate: index (no robots), in the sitemap, /nastroje and llms.txt", async () => {
    const paths = await sitemapPaths();
    const { llmsTxt } = await import("@/lib/llms");
    const { absoluteUrl } = await import("@/lib/site");
    const { default: Tools } = await import("@/app/(site)/nastroje/page");
    const hub = renderToStaticMarkup(createElement(Tools as FC));
    for (const p of [...MONEY, "/vzor-povereni", "/kalkulacka-eet-off"]) {
      const mod = (await import(`@/app/(site)${p}/page`)) as { metadata: { robots?: unknown } };
      expect(mod.metadata.robots, p).toBeUndefined();
      expect(paths, p).toContain(p);
      expect(llmsTxt(), p).toContain(`(${absoluteUrl(p)})`);
      expect(hrefs(hub), p).toContain(p);
    }
  });

  it("gate: the money calculators and the template show „Odborná revize: Helena Jeřábková, účetní · 17. 10. 2026“", async () => {
    for (const p of [...MONEY, "/vzor-povereni"]) {
      const mod = (await import(`@/app/(site)${p}/page`)) as { default: FC };
      expect(pageText(mod.default), p).toContain("Odborná revize: Helena Jeřábková, účetní · 17. 10. 2026");
    }
  });

  it("gate: the guide Tržba za jiného links /vzor-povereni (rendered)", async () => {
    const { default: GuidePage } = await import("@/app/(site)/navody/[slug]/page");
    const html = renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: "trzba-za-jineho" }) } as never)) as ReactElement);
    expect(hrefs(html)).toContain("/vzor-povereni");
  });
});

describe("S3-OPEN 2 – help open before 2. 11. 2026", () => {
  it("gate: the index switch is gone; every help page is in the sitemap and llms.txt while the cash register is closed", async () => {
    const content = await import("@/content/napoveda");
    expect("helpIndexable" in content).toBe(false);
    expect("HELP_CLOSED_NOTE" in content).toBe(false);
    const { isClosed } = await import("@/lib/launch");
    expect(isClosed("/pokladna")).toBe(true);
    const paths = await sitemapPaths();
    expect(paths).toContain("/napoveda");
    for (const a of content.HELP_ARTICLES) expect(paths, a.slug).toContain(`/napoveda/${a.slug}`);
    // indexované stránky neodkazují do uzavřených sekcí a sitemap je nemá
    for (const p of paths) expect(isClosed(p), p).toBe(false);
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toMatch(/\[Nápověda k pokladně\]\(https:\/\/evidujzdarma\.cz\/napoveda\): jak bude v pokladně EvidujZdarma \(spouštíme ji 2\. 11\. 2026\)/);
  });

  it("gate: every article is classified exactly once (app vs general); the note text is verbatim", async () => {
    const { HELP_ARTICLES } = await import("@/content/napoveda");
    const { HELP_APP_ARTICLES, HELP_GENERAL_ARTICLES, HELP_LAUNCH_NOTE } = await import("@/lib/help-page");
    const all = HELP_ARTICLES.map((a) => a.slug).sort();
    expect([...HELP_APP_ARTICLES, ...HELP_GENERAL_ARTICLES].sort()).toEqual(all);
    expect(new Set([...HELP_APP_ARTICLES, ...HELP_GENERAL_ARTICLES]).size).toBe(all.length);
    expect(HELP_LAUNCH_NOTE).toBe(NOTE);
    expect(HELP_GENERAL_ARTICLES).toEqual(["podpora"]);
  });

  it("gate: closed – the note on the hub and app articles, not on general ones; every article shows „Aktualizováno“", async () => {
    const { HELP_ARTICLES } = await import("@/content/napoveda");
    const { isAppHelpArticle, helpLaunchNote } = await import("@/lib/help-page");
    expect(helpLaunchNote()).toBe(NOTE);
    expect(await renderHelp()).toContain(NOTE);
    for (const a of HELP_ARTICLES) {
      const html = await renderHelp(a.slug);
      expect(html.includes(NOTE), a.slug).toBe(isAppHelpArticle(a.slug));
      expect(helpLaunchNote(a.slug), a.slug).toBe(isAppHelpArticle(a.slug) ? NOTE : null);
      expect(html, a.slug).toContain(`Aktualizováno: <time dateTime="${a.updated}">`);
      expect(html, a.slug).toContain(`"dateModified":"${a.updated}"`);
    }
  });

  it("gate: open – no note anywhere, „Aktualizováno“ stays", async () => {
    mockLaunch("open");
    const { HELP_ARTICLES } = await import("@/content/napoveda");
    const { helpLaunchNote } = await import("@/lib/help-page");
    expect(helpLaunchNote()).toBeNull();
    expect(await renderHelp()).not.toContain(NOTE);
    for (const a of HELP_ARTICLES.slice(0, 3)) {
      expect(helpLaunchNote(a.slug), a.slug).toBeNull();
      const html = await renderHelp(a.slug);
      expect(html, a.slug).not.toContain(NOTE);
      expect(html, a.slug).toContain(`Aktualizováno: <time dateTime="${a.updated}">`);
    }
  });

  it("gate: JSON-LD – TechArticle for every article, HowTo only with steps", async () => {
    const { HELP_ARTICLES } = await import("@/content/napoveda");
    const { helpJsonLd } = await import("@/lib/help-page");
    for (const a of HELP_ARTICLES) {
      const types = helpJsonLd(a).map((x) => x["@type"]);
      expect(types, a.slug).toEqual(a.steps?.length ? ["TechArticle", "HowTo"] : ["TechArticle"]);
    }
  });

  it("the note lives in lib/help-page.ts, not in the article bodies (the POKLADNA stream edits those)", () => {
    for (const f of ["zaciname", "prodej", "uctenky", "odesilani", "provoz", "ucetni", "ucet"]) {
      expect(src(`content/napoveda/${f}.ts`), f).not.toContain("Aktuální k 17. 10. 2026");
    }
    expect(src("lib/help-page.ts")).toContain("HELP_APP_ARTICLES");
  });
});

describe("S3-OPEN 3 – invoice: optional „Vystaveno zdarma v EvidujZdarma.cz“", () => {
  it("gate: the invoice paper prints the credit only when asked – small, inside .doc-paper, no link", async () => {
    const { InvoicePaper, INVOICE_CREDIT } = await import("@/components/invoice-paper");
    const { invoiceTotals } = await import("@/lib/faktura");
    expect(INVOICE_CREDIT).toBe("Vystaveno zdarma v EvidujZdarma.cz");
    const inv = {
      kind: "faktura",
      vatPayer: false,
      number: "2026015",
      issueDate: "2026-10-17",
      taxDate: "2026-10-17",
      dueDays: "14",
      payment: "hotove",
      account: "",
      vs: "",
      supplier: { name: "Jan Novák", ico: "12345679", dic: "", address: "Hlavní 1, 110 00 Praha", registry: "" },
      customer: { name: "", ico: "", dic: "", address: "" },
      items: [{ name: "Oprava", qty: "1", unit: "ks", price: "1000", rate: 21 }],
      note: "",
    } as const;
    const props = { inv: inv as never, totals: invoiceTotals(inv.items as never, false), dueDate: "2026-10-31", vs: "2026015", iban: null, qrSvg: null };
    const off = renderToStaticMarkup(createElement(InvoicePaper, props));
    expect(off).not.toContain("EvidujZdarma");
    const on = renderToStaticMarkup(createElement(InvoicePaper, { ...props, credit: true }));
    expect(on).toMatch(/^<div class="doc-paper /);
    expect(on).toMatch(/<p class="[^"]*text-\[11px\][^"]*">Vystaveno zdarma v EvidujZdarma\.cz<\/p><\/div>$/);
    expect(on).not.toMatch(/<a[^>]*>[^<]*Vystaveno/);
  });

  it("gate: the generator has the checkbox, unchecked by default, and the invoice preview has no credit by default", async () => {
    const { InvoiceGenerator } = await import("@/components/invoice-generator");
    const html = renderToStaticMarkup(createElement(InvoiceGenerator));
    expect(html).toContain("Uvést na faktuře, že je vystavená v EvidujZdarma.cz");
    const box = html.match(/<input id="fa-credit"[^>]*>/)?.[0];
    expect(box).toBeTruthy();
    expect(box).toContain('type="checkbox"');
    expect(box).not.toMatch(/checked/);
    expect(html).not.toContain("Vystaveno zdarma v EvidujZdarma.cz");
    expect(src("components/invoice-generator.tsx")).toContain("const [credit, setCredit] = useState(false);");
  });

  it("gate: nothing is stored – no browser storage or cookies in the touched components", () => {
    for (const f of ["components/invoice-generator.tsx", "components/invoice-paper.tsx", "components/review-note.tsx", "components/help-blocks.tsx", "lib/help-page.ts"]) {
      expect(src(f), f).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    }
  });
});
