/**
 * R14 (docs/tasks/2026-10-09-r14.md) – konverze předregistrace a drobné SEO. Texty doslovně.
 *  R14.1 blok „Proč je to zdarma?“ na úvodní stránce + otázka v PRICING_FAQ (karta 3 už v podobě z R15.3);
 *  R14.2 formulář s IČO z /kontrola-ico a z /?ico=; R14.3 nepovinná pole v rozbalovacím bloku;
 *  R14.4 „Ukázka“ na ilustraci pokladny; R14.5 tlačítko dole na telefonu; R14.6 sameAs; R14.7 lastmod a adresa
 *  úvodní stránky; R14.8 title a h1 dvou návodů. Tlačítka v obou stavech isClosed("/pokladna").
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Metadata } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ");

const WHY = {
  title: "Proč je to zdarma? A kde je háček?",
  intro: "Ptáte se správně. Tady je, jak to funguje.",
  cards: [
    {
      title: "Základ zdarma navždy",
      text: "Evidence tržeb, účtenka e-mailem i QR kódem, práce bez signálu, až 5 uživatelů a 3 evidenční jednotky. Ne na zkoušku, ale trvale. Co přesně znamená „navždy“, najdete v podmínkách.",
    },
    {
      title: "Vydělávat chceme na doplňcích",
      text: "Kdo bude chtít víc, si připlatí: Premium za 149 Kč měsíčně (účtenky SMS, exporty), platební terminál nebo nastavení na klíč. Doplňky připravujeme a nikdo je nemusí.",
    },
    { title: "Nežijeme z reklamy ani z vašich dat", text: "Na webu nemáme reklamu ani sledovací cookies a vaše údaje nikomu neprodáváme." },
  ],
  guarantee: "Bez závazku a bez platební karty.",
};
const CTA = { closed: "Předregistrovat se zdarma", open: "Začít zdarma" };

const openRegister = () =>
  vi.doMock("@/lib/launch", async (orig) => {
    const real = await orig<typeof import("@/lib/launch")>();
    return { ...real, isClosed: (p: string) => (p === "/pokladna" ? false : real.isClosed(p)) };
  });

async function homeHtml() {
  const { default: Home } = await import("@/app/(site)/page");
  return renderToStaticMarkup(createElement(Home as FC));
}

afterEach(() => {
  vi.doUnmock("@/lib/launch");
  vi.resetModules();
  delete process.env.ARES_MOCK;
});

describe("R14.1 – „Proč je to zdarma?“ on the home page", () => {
  it("gate: the block (verbatim) sits under the first screen, before the MOJE eet comparison; links to čl. 6 and /cenik", async () => {
    const html = await homeHtml();
    const t = text(html);
    for (const s of [WHY.title, WHY.intro, ...WHY.cards.flatMap((c) => [c.title, c.text]), WHY.guarantee]) expect(t).toContain(s);
    const at = t.indexOf(WHY.title);
    expect(at).toBeGreaterThan(t.indexOf("Evidence tržeb EET 2.0 zdarma."));
    expect(at).toBeLessThan(t.indexOf("Férové srovnání se státní aplikací MOJE eet"));
    expect(html).toMatch(/<a [^>]*href="\/podminky#zdarma"[^>]*>v podmínkách<\/a>/);
    expect(html).toMatch(/<a [^>]*href="\/cenik"[^>]*>Premium<\/a>/);
    const block = html.slice(html.indexOf(WHY.title), html.indexOf("Férové srovnání"));
    expect(block).toMatch(new RegExp(`<a [^>]*href="/#registrace"[^>]*>${CTA.closed}</a>`));
  });

  it("gate: open register – the button says „Začít zdarma“ (SERVICE_COPY)", async () => {
    vi.resetModules();
    openRegister();
    const { SERVICE_COPY } = await import("@/lib/site");
    expect(SERVICE_COPY.startCta).toEqual({ label: CTA.open, href: "/#registrace" });
    const html = await homeHtml();
    const block = html.slice(html.indexOf(WHY.title), html.indexOf("Férové srovnání"));
    expect(block).toContain(`>${CTA.open}</a>`);
    expect(block).not.toContain(CTA.closed);
  });

  it("gate: PRICING_FAQ and its FAQPage have the question with cards 1–3 as one paragraph", async () => {
    const { PRICING_FAQ, PLANS } = await import("@/content/pricing");
    const item = PRICING_FAQ.find((f) => f.q === "Proč je pokladna zdarma a kde je háček?");
    expect(item?.a).toBe(WHY.cards.map((c) => c.text).join(" "));
    // cena v kartě 2 = ceník
    expect(WHY.cards[1]!.text).toContain(`Premium za ${PLANS.find((p) => p.name === "Premium")!.priceLabel} měsíčně`);
    const { default: Cenik } = await import("@/app/(site)/cenik/page");
    const html = renderToStaticMarkup(createElement(Cenik as FC));
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]!).join("");
    expect(ld).toContain("Proč je pokladna zdarma a kde je háček?");
    expect(ld).toContain(JSON.stringify(item!.a).slice(1, -1));
  });
});

describe("R14.2 – from the IČO check to the pre-registration", () => {
  const FORM_H = "Chcete evidovat zdarma?";
  const formText = (ico: string) => `Předregistrujte se k bezplatné pokladně. IČO ${ico} už máme vyplněné.`;
  async function icoPage(ico: string) {
    process.env.ARES_MOCK = "1";
    const { default: Page } = await import("@/app/(site)/kontrola-ico/page");
    return renderToStaticMarkup((await Page({ searchParams: Promise.resolve({ ico }) } as never)) as ReactElement);
  }

  it("gate: a found subject → the form with the IČO filled in (verbatim heading and text)", async () => {
    const html = await icoPage("12345679");
    expect(text(html)).toContain(FORM_H);
    expect(text(html)).toContain(formText("12345679"));
    expect(html).toMatch(/<input[^>]*id="pr-ico"[^>]*value="12345679"/);
  });

  it("gate: IČO does not exist (invalid or not in ARES) → no form", async () => {
    for (const ico of ["12345678", "27082440"]) {
      const html = await icoPage(ico);
      expect(text(html), ico).not.toContain(FORM_H);
      expect(html, ico).not.toContain('id="pr-email"');
    }
  });

  it("gate: /?ico= – only a valid 8-digit IČO is taken over, anything else is ignored", async () => {
    const { icoFromSearch } = await import("@/components/prereg-form");
    expect(icoFromSearch("?ico=12345679")).toBe("12345679");
    expect(icoFromSearch("?utm_source=x&ico=27082440")).toBe("27082440");
    for (const bad of ["", "?ico=", "?ico=1234567", "?ico=123456790", "?ico=12345678", "?ico=1234567a", "?ico=%3Cscript%3E", "?ico= 12345679"]) {
      expect(icoFromSearch(bad), bad).toBe("");
    }
    // úvodní stránka zůstává statická (čte ?ico= až v prohlížeči)
    const src = readFileSync(new URL("../src/app/(site)/page.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/searchParams/);
    expect(readFileSync(new URL("../src/components/prereg-form.tsx", import.meta.url), "utf8")).toMatch(/icoFromSearch\(window\.location\.search\)/);
  });
});

describe("R14.3 – optional fields in a collapsed block", () => {
  it("gate: e-mail and IČO visible; provozovny, obor and needs inside a closed <details> „Upřesnit, s čím pomoct (nepovinné)“", async () => {
    const { PreregForm } = await import("@/components/prereg-form");
    const html = renderToStaticMarkup(createElement(PreregForm));
    const m = html.match(/<details([^>]*)>([\s\S]*?)<\/details>/);
    expect(m).toBeTruthy();
    expect(m![1]).not.toMatch(/\bopen\b/);
    expect(text(m![2]!)).toContain("Upřesnit, s čím pomoct (nepovinné)");
    for (const name of ["establishments", "industry", "needs"]) expect(m![2], name).toContain(`name="${name}"`);
    const outside = html.replace(m![0], "");
    for (const name of ["email", "ico", "marketing"]) expect(outside, name).toContain(`name="${name}"`);
    expect(outside).not.toContain('name="industry"');
  });
});

describe("R14.4 – the register illustration", () => {
  it("gate: visible label „Ukázka“ on top; „✓ Tržba zaevidována“ instead of „Potvrzeno Finanční správou“", async () => {
    const { PosPreview } = await import("@/components/pos-preview");
    const html = renderToStaticMarkup(createElement(PosPreview));
    const t = text(html);
    expect(t.trim().startsWith("Ukázka")).toBe(true);
    expect(html).not.toMatch(/sr-only[^>]*>Ukázka/);
    expect(t).toContain("✓ Tržba zaevidována");
    expect(t).not.toContain("Potvrzeno Finanční správou");
  });
});

describe("R14.5 – sticky button on the phone", () => {
  it("gate: closed → „Předregistrovat se zdarma“ → /#registrace, only below 640 px, with a spacer so it covers nothing", async () => {
    const { MobileCta } = await import("@/components/mobile-cta");
    const html = renderToStaticMarkup(createElement(MobileCta));
    expect(html).toMatch(new RegExp(`<a [^>]*href="/#registrace"[^>]*>${CTA.closed}</a>`));
    expect(html).toMatch(/class="[^"]*\bfixed\b[^"]*\bsm:hidden\b/);
    expect(html).toMatch(/data-mobile-cta-spacer="true"/);
  });

  it("gate: open → „Začít zdarma“", async () => {
    vi.resetModules();
    openRegister();
    const { MobileCta } = await import("@/components/mobile-cta");
    const html = renderToStaticMarkup(createElement(MobileCta));
    expect(html).toContain(`>${CTA.open}</a>`);
    expect(html).not.toContain(CTA.closed);
  });

  it("gate: on marketing pages only – the (site) layout has it, the app layout (pokladna, kabinet, přihlášení) not; hides when #registrace is in view", async () => {
    const { default: SiteLayout } = await import("@/app/(site)/layout");
    expect(renderToStaticMarkup(createElement(SiteLayout as FC<{ children: null }>, { children: null }))).toContain("data-mobile-cta");
    expect(readFileSync(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8")).not.toMatch(/MobileCta/);
    const src = readFileSync(new URL("../src/components/mobile-cta.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/IntersectionObserver/);
    expect(src).toMatch(/getElementById\("registrace"\)/);
  });
});

describe("R14.6 – sameAs", () => {
  it("gate: the organisation has 4 profiles incl. Instagram and Threads", async () => {
    const { organizationLd } = await import("@/lib/jsonld");
    const sameAs = (organizationLd() as { sameAs: string[] }).sameAs;
    expect(sameAs).toHaveLength(4);
    expect(sameAs).toEqual(expect.arrayContaining(["https://www.instagram.com/evidujzdarma/", "https://www.threads.com/@evidujzdarma"]));
  });
});

describe("R14.7 – sitemap lastmod and the home page address", () => {
  /** Sloučená metadata kořenového layoutu a stránky funkcí accumulateMetadata z Next (jako při renderu). */
  async function merged(page: Metadata, pathname: string) {
    const req = createRequire(import.meta.url);
    const path = req.resolve("next/dist/lib/metadata/resolve-metadata.js");
    const fromNext = createRequire(path);
    const so = fromNext.resolve("server-only");
    fromNext.cache[so] = { id: so, filename: so, loaded: true, exports: {} } as never;
    const { accumulateMetadata } = fromNext(path) as {
      accumulateMetadata: (...a: unknown[]) => Promise<{ alternates?: { canonical?: { url: string } | null } | null; openGraph?: { url?: URL | string } | null }>;
    };
    const root = (await import("@/app/layout")).metadata;
    return accumulateMetadata(pathname, [[root, null], [null, null], [page, null]], Promise.resolve(pathname), { trailingSlash: false, isStaticMetadataRouteFile: false });
  }

  it("gate: canonical, og:url and the sitemap loc of the home page are all https://evidujzdarma.cz/", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const loc = sitemap()[0]!.url;
    expect(loc).toBe("https://evidujzdarma.cz/");
    const html = await homeHtml();
    const meta = await merged((await import("@/app/(site)/page")).metadata, "/");
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
    if (meta.alternates?.canonical) canonicals.push(meta.alternates.canonical.url);
    const ogUrls = [...html.matchAll(/<meta property="og:url" content="([^"]+)"/g)].map((m) => m[1]);
    if (meta.openGraph?.url) ogUrls.push(String(meta.openGraph.url));
    expect(canonicals).toEqual([loc]);
    expect(ogUrls).toEqual([loc]);
  });

  it("gate: lastmod is the real content date – guides by their date, myths by asOf, the rest by a constant per page (not one shared date)", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const { GUIDES, guideModified, isIndexable } = await import("@/content/guides");
    const { MYTHS } = await import("@/content/myths");
    const map = new Map(sitemap().map((e) => [e.url.replace("https://evidujzdarma.cz", ""), String(e.lastModified)]));
    // každý návod má lastmod = svou datu změny (dnes mají všechny ověřené návody tutéž – revize 7. 10.), takže návody
    // s různými daty mají různý lastmod
    const guides = GUIDES.filter(isIndexable);
    for (const g of guides) expect(map.get(`/navody/${g.slug}`), g.slug).toBe(guideModified(g));
    expect(map.get("/co-se-o-eet-pise-spatne")).toBe(MYTHS.map((m) => m.asOf).reduce((a, b) => (b > a ? b : a)));
    expect(map.get("/navody")).toBe(guides.map((g) => guideModified(g)).reduce((a, b) => (b > a ? b : a)));
    const { PRIVACY_DATE_ISO, TERMS_DATE_ISO } = await import("@/lib/legal");
    expect(map.get("/ochrana-osobnich-udaju")).toBe(PRIVACY_DATE_ISO);
    expect(map.get("/podminky")).toBe(TERMS_DATE_ISO);
    const statics = (await import("@/lib/static-pages")).STATIC_PAGES.map((p) => map.get(p.path === "/" ? "/" : p.path));
    expect(statics.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? ""))).toBe(true);
    expect(new Set(statics).size).toBeGreaterThan(3);
    const today = new Date().toISOString().slice(0, 10);
    expect(statics.every((d) => d! <= today)).toBe(true);
  });
});

describe("R14.8 – „EET“ queries in the titles of two guides", () => {
  it("gate: title and h1 verbatim, slugs unchanged", async () => {
    const { getGuide } = await import("@/content/guides");
    expect(getGuide("koho-se-eet-tyka")).toMatchObject({
      title: "Kdo musí mít EET 2.0 od roku 2027 a kdo má výjimku",
      h1: "Kdo musí mít EET 2.0 a kdo má výjimku",
    });
    expect(getGuide("eet-2-0-kompletni-pruvodce")).toMatchObject({
      title: "Co je EET 2.0: kompletní průvodce na rok 2027",
      h1: "Co je EET 2.0 a co udělat do 1. 1. 2027",
    });
  });
});
