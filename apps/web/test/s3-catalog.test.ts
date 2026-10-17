/**
 * S3 – katalog firem otevřený veřejnosti (kraj 51): pravidla LIA, stránka firmy „lépe než FakturujZdarma“, obor × obec,
 * rozcestník obce, sitemapy, SEO/GEO a výkon.
 *  - čisté funkce: obor → návod, věta-shrnutí, fakturační údaje, OSVČ počtem, title ≤ 60 a description 140–160,
 *    zánik po 90 dnech, přepínač CATALOG_INDEX_PERSONS;
 *  - OSVČ: noindex, mimo sitemapu, v seznamech jen počtem, bez DIČ, ulice a provozoven (ani když jsou v DB);
 *  - stránka firmy: souhrn, JSON-LD (Organization, WebPage s dateModified, bez isicV4), CTA jen s fragmentem,
 *    nic do zavřených sekcí (pokladna do 2. 11.), zaniklá firma noindex a po 90 dnech 404;
 *  - sitemapy, robots.txt, llms.txt, MCP bez ?ico=, Cache-Control, migrace 0038.
 * Data: syntetické subjekty „Ukázkov…“ v PGlite se stejnými migracemi jako produkce.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDb, schema } from "@ez/db";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Mozilla/5.0", "x-real-ip": "198.51.100.91" }) }));
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {}, back: () => {} }),
}));

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const text = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const hrefs = (h: string) => [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
const jsonLd = (h: string) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
const NF = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;

/* ─────────────────────────────── syntetická data ─────────────────────────────── */

function icoCheck(first7: string): string {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(first7[i]) * (8 - i);
  const r = sum % 11;
  return `${first7}${r === 0 ? 1 : r === 1 ? 0 : 11 - r}`;
}
let seq = 0;
const nextIco = () => icoCheck(String(9960000 + ++seq));
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());
const daysAgo = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

const KV = { code: 554961, name: "Karlovy Vary", region: 51 };
const CHEB = { code: 554481, name: "Cheb", region: 51 };
type Obec = typeof KV;
type FirmInsert = typeof schema.firms.$inferInsert;

function firm(obec: Obec, name: string, opts: Partial<FirmInsert> = {}): FirmInsert {
  const natural = opts.isNaturalPerson ?? false;
  return {
    ico: nextIco(),
    name,
    slug: name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    legalForm: natural ? "101" : "112",
    isNaturalPerson: natural,
    dic: natural ? null : "CZ00000019",
    vatPayer: !natural,
    foundedAt: "2015-05-03",
    aresUpdatedAt: today,
    street: natural ? null : `Zámecká ${seq}`,
    city: obec.name,
    cityCode: obec.code,
    postalCode: "36001",
    regionCode: obec.region,
    nace: ["96021"],
    eetRelevance: "likely",
    syncedAt: new Date(),
    ...opts,
  };
}

const salons = Array.from({ length: 6 }, (_, i) => firm(KV, `Ukázkový salon ${String(i + 1).padStart(2, "0")} s.r.o.`));
const SALON = salons[0]!;
// OSVČ: v DB omylem i s DIČ odvozeným z rodného čísla, ulicí a provozovnou – nic z toho se nesmí ukázat
const OSVC = firm(KV, "Ukázková Kadeřnice Soukromá", { isNaturalPerson: true, legalForm: "101", dic: "CZ8001011234", street: "Tajná 7", vatPayer: true });
const OSVC2 = firm(KV, "Ukázkový Holič Druhý", { isNaturalPerson: true, legalForm: "101" });
const OSVC3 = firm(KV, "Ukázková Kosmetička Třetí", { isNaturalPerson: true, legalForm: "101" });
const DISSOLVED_RECENT = firm(KV, "Ukázkový zaniklý salon nedávno s.r.o.", { dissolvedAt: daysAgo(30) });
const DISSOLVED_OLD = firm(KV, "Ukázkový zaniklý salon dávno s.r.o.", { dissolvedAt: daysAgo(200) });
const DISSOLVED_OSVC_OLD = firm(KV, "Ukázková Zaniklá Podnikatelka", { isNaturalPerson: true, legalForm: "101", dissolvedAt: daysAgo(120) });
const BISTRO = firm(KV, "Ukázkové bistro u Vřídla s.r.o.", { nace: ["56101"], vatPayer: false, dic: "CZ00000027" });
const DRUZSTVO = firm(CHEB, "Ukázkové družstvo Cheb", { legalForm: "205", nace: ["47110"] });
const ROWS = [...salons, OSVC, OSVC2, OSVC3, DISSOLVED_RECENT, DISSOLVED_OLD, DISSOLVED_OSVC_OLD, BISTRO, DRUZSTVO];
const OSVC_ICP = "9960000001";
const SALON_ICP = "9960000002";

let t: TestDb;
let catalog: typeof import("@/lib/server/catalog");

beforeAll(async () => {
  delete process.env.CATALOG_INDEX_REGIONS;
  delete process.env.CATALOG_REQUIRE_ARES;
  delete process.env.CATALOG_INDEX_PERSONS;
  t = await createTestDb();
  await getDb().insert(schema.firms).values(ROWS);
  await getDb()
    .insert(schema.firmEstablishments)
    .values([
      { icp: OSVC_ICP, ico: OSVC.ico!, name: null, slug: "provozovna-osvc", street: "Tajná 7", city: KV.name, cityCode: KV.code, regionCode: 51, trades: ["Holičství, kadeřnictví"], eetRelevance: "likely", startedAt: "2015-05-03" },
      { icp: SALON_ICP, ico: SALON.ico!, name: "Ukázkový salon u kolonády", slug: "ukazkovy-salon-u-kolonady", street: "Lázeňská 1", city: KV.name, cityCode: KV.code, regionCode: 51, trades: ["Holičství, kadeřnictví"], eetRelevance: "likely", startedAt: "2015-05-03" },
    ]);
  catalog = await import("@/lib/server/catalog");
  catalog.__clearCatalogMemo();
}, 60_000);
afterAll(async () => t?.close());

async function renderFirm(slug: string) {
  const { default: Page, generateMetadata } = await import("@/app/(site)/firma/[slug]/page");
  const props = { params: Promise.resolve({ slug }) } as never;
  const meta = await generateMetadata(props);
  const html = renderToStaticMarkup((await Page(props)) as ReactElement);
  return { meta, html };
}
const slugOf = (f: FirmInsert) => `${f.ico}-${f.slug}`;

async function renderRoute(mod: string, params: Record<string, string>, searchParams: Record<string, string> = {}) {
  const { default: Page, generateMetadata } = await import(mod);
  const props = { params: Promise.resolve(params), searchParams: Promise.resolve(searchParams) } as never;
  const meta = generateMetadata ? await generateMetadata(props) : {};
  const html = renderToStaticMarkup((await Page(props)) as ReactElement);
  return { meta, html };
}

/* ─────────────────────────────── čisté funkce ─────────────────────────────── */

describe("S3 – pure helpers", () => {
  it("gate: obor → návod (pure, with priority and fallbacks); every target is a reviewed guide", async () => {
    const { eetGuideFor, EET_GUIDE_RULES, EET_PILLAR, EET_WHO } = await import("@/lib/catalog-eet");
    const slug = (nace: string[], rel: "likely" | "possible" | "unlikely" = "likely") => eetGuideFor(nace, rel).slug;
    expect(slug(["56101"])).toBe("eet-gastronomie");
    expect(slug(["55100", "56101"])).toBe("eet-ubytovani"); // hotel s restaurací → ubytování
    expect(slug(["96021"])).toBe("eet-kadernictvi-kosmetika");
    expect(slug(["4781"])).toBe("eet-trhy-stanky");
    expect(slug(["47890"])).toBe("eet-trhy-stanky");
    expect(slug(["47910"])).toBe("eet-eshop-dobirka");
    expect(slug(["43210"], "possible")).toBe("eet-remeslnici");
    expect(slug(["47110"])).toBe(EET_PILLAR.slug); // obchod bez vlastního návodu → pilíř
    expect(slug(["62010"], "unlikely")).toBe(EET_WHO.slug); // „spíš ne“ → kdo musí evidovat
    expect(slug([], "possible")).toBe(EET_PILLAR.slug);
    // nedostupný (nerevidovaný) návod nahradí pilíř, nedostupný pilíř „Koho se EET týká“
    expect(eetGuideFor(["56101"], "likely", (s) => s !== "eet-gastronomie").slug).toBe(EET_PILLAR.slug);
    expect(eetGuideFor(["56101"], "likely", (s) => s === EET_WHO.slug).slug).toBe(EET_WHO.slug);
    const { getGuide, isIndexable } = await import("@/content/guides");
    for (const r of [...EET_GUIDE_RULES, EET_PILLAR, EET_WHO]) {
      const g = getGuide(r.slug);
      expect(g, r.slug).toBeDefined();
      expect(isIndexable(g!), r.slug).toBe(true);
    }
  });

  it("gate: the EET verdict is plain Czech and always says that the way of payment decides, not the industry", async () => {
    const { eetVerdict } = await import("@/lib/catalog-eet");
    expect(eetVerdict("likely").title).toBe("Pravděpodobně se týká");
    expect(eetVerdict("possible").title).toBe("Může se týkat");
    expect(eetVerdict("unlikely").title).toBe("Spíš se netýká");
    for (const r of ["likely", "possible", "unlikely"] as const) {
      expect(eetVerdict(r).caveat).toContain("Rozhoduje způsob placení, ne obor.");
      expect(eetVerdict(r).caveat).toContain("ne o právní posouzení");
    }
  });

  it("gate: summary sentence from registry fields only (verbatim), Czech agreement and locative, OSVČ without address", async () => {
    const { firmSummary, cityLocative } = await import("@/lib/catalog-summary");
    const base = { name: "XY s.r.o.", ico: "12345679", legalForm: "112", isNaturalPerson: false, city: "Karlovy Vary", hasSeat: true, foundedAt: "2015-05-03", dissolvedAt: null, nace: ["96021"] };
    expect(firmSummary(base)).toBe(
      "XY s.r.o. (IČO 12345679) je společnost s ručením omezeným se sídlem v Karlových Varech, vznikla 3. 5. 2015. Obor činnosti: CZ-NACE 96021 – Kadeřnictví a kosmetika.",
    );
    expect(firmSummary({ ...base, name: "Družstvo Z", legalForm: "205", city: "Cheb" })).toContain("je družstvo se sídlem v Chebu, vzniklo 3. 5. 2015.");
    expect(firmSummary({ ...base, name: "Spolek S, z.s.", legalForm: "706", city: "Loket" })).toContain("je spolek se sídlem v Lokti, vznikl 3. 5. 2015.");
    expect(firmSummary({ ...base, city: "Dalovice" })).toContain("se sídlem v obci Dalovice");
    expect(cityLocative("Nová Ves")).toBe("v obci Nová Ves");
    expect(firmSummary({ ...base, nace: ["96021", "47110", "56101", "62010"] })).toContain(
      "Obory činnosti: CZ-NACE 96021 – Kadeřnictví a kosmetika; CZ-NACE 47110 – Maloobchod a 2 další.",
    );
    const osvc = firmSummary({ ...base, name: "Jana Ukázková", legalForm: "101", isNaturalPerson: true, hasSeat: false });
    expect(osvc).toBe(
      "Jana Ukázková (IČO 12345679) je fyzická osoba podnikající dle živnostenského zákona, obec sídla Karlovy Vary. Datum vzniku: 3. 5. 2015. Obor činnosti: CZ-NACE 96021 – Kadeřnictví a kosmetika.",
    );
    expect(osvc).not.toMatch(/hlavní obor/i);
  });

  it("gate: billing details – firm with street, PSČ and DIČ; OSVČ only name, obec and IČO (never street or DIČ)", async () => {
    const { billingText, personsCountText } = await import("@/lib/catalog-summary");
    expect(billingText({ name: "XY s.r.o.", ico: "12345679", isNaturalPerson: false, street: "Zámecká 1", postalCode: "36001", city: "Karlovy Vary", dic: "CZ12345679" })).toBe(
      "XY s.r.o.\nZámecká 1\n360 01 Karlovy Vary\nIČO: 12345679\nDIČ: CZ12345679",
    );
    expect(billingText({ name: "Jana Ukázková", ico: "12345679", isNaturalPerson: true, street: "Tajná 7", postalCode: "36001", city: "Karlovy Vary", dic: "CZ8001011234" })).toBe(
      "Jana Ukázková\nKarlovy Vary\nIČO: 12345679",
    );
    expect([1, 3, 37].map((n) => personsCountText(n, true))).toEqual(["a další 1 živnostník", "a další 3 živnostníci", "a dalších 37 živnostníků"]);
    expect(personsCountText(5, false)).toBe("5 živnostníků");
  });

  it("gate: title ≤ 60 (keywords before the brand) and description 140–160 characters", async () => {
    const { fitTitle, fitDescription } = await import("@/lib/catalog-meta");
    expect(fitTitle(["Firmy Aš – katalog a EET 2.0"]).absolute).toBe("Firmy Aš – katalog a EET 2.0 | EvidujZdarma");
    expect(fitTitle(["Kadeřnictví a kosmetika Karlovy Vary – firmy a EET 2.0", "x"]).absolute).toBe("Kadeřnictví a kosmetika Karlovy Vary – firmy a EET 2.0");
    expect(fitTitle(["A".repeat(80)]).absolute.length).toBeLessThanOrEqual(60);
    const d = fitDescription(["Krátká věta."], ["Údaje z ARES a RES ČSÚ.", "Seznam firem s IČO a adresou.", "Zdarma a bez registrace.", "Odhad, zda se firmy týká EET 2.0 od 1. 1. 2027."]);
    expect(d.length).toBeGreaterThanOrEqual(140);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(fitDescription(["slovo ".repeat(60)]).length).toBeLessThanOrEqual(160);
  });

  it("gate: LIA policy – OSVČ noindex unless CATALOG_INDEX_PERSONS=1, dissolved gone after 90 days", async () => {
    const p = await import("@/lib/catalog-policy");
    expect(p.indexPersons({})).toBe(false);
    expect(p.indexPersons({ CATALOG_INDEX_PERSONS: "0" })).toBe(false);
    expect(p.indexPersons({ CATALOG_INDEX_PERSONS: "1" })).toBe(true);
    const opts = { requireAres: true, indexPersons: false };
    const f = { noindex: false, dissolvedAt: null, natural: true, indexRegion: true, verified: true };
    expect(p.catalogNoindexReason(f, opts)).toBe("person");
    expect(p.catalogNoindexReason({ ...f, natural: false }, opts)).toBeNull();
    expect(p.catalogNoindexReason(f, { ...opts, indexPersons: true })).toBeNull();
    expect(p.catalogNoindexReason({ ...f, natural: false, dissolvedAt: "2026-01-01" }, opts)).toBe("dissolved");
    expect(p.isGone("2026-01-01", "2026-03-31")).toBe(false); // 89 dní
    expect(p.isGone("2026-01-01", "2026-04-01")).toBe(false); // 90 dní
    expect(p.isGone("2026-01-01", "2026-04-02")).toBe(true);
    expect(p.isGone(null, "2026-04-02")).toBe(false);
  });
});

/* ─────────────────────────────── stránka firmy ─────────────────────────────── */

describe("S3 – firm page", () => {
  it("gate: firm – indexed, summary, copyable IČO/DIČ, map and registry links, JSON-LD Organization + WebPage (dateModified = ARES), no isicV4", async () => {
    const { meta, html } = await renderFirm(slugOf(SALON));
    const tx = text(html);
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe(`/firma/${slugOf(SALON)}`);
    const title = (meta.title as { absolute: string }).absolute;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain(`IČO ${SALON.ico}`);
    expect(String(meta.description).length).toBeGreaterThanOrEqual(140);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(tx).toContain(`${SALON.name} (IČO ${SALON.ico}) je společnost s ručením omezeným se sídlem v Karlových Varech, vznikla 3. 5. 2015.`);
    expect(tx).toContain("Kopírovat IČO");
    expect(tx).toContain("Kopírovat DIČ");
    expect(tx).toContain("Plátce DPH");
    expect(tx).toContain(`Údaje z ARES k`);
    const links = hrefs(html);
    expect(links.some((h) => h.startsWith("https://mapy.com/cs/zakladni?q="))).toBe(true);
    expect(links).toContain(`https://ares.gov.cz/ekonomicke-subjekty?ico=${SALON.ico}`);
    expect(links).toContain(`https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${SALON.ico}`);
    // EET panel + nejvhodnější návod + ověření podle IČO (fragment)
    expect(tx).toContain("EET 2.0 a tato firma");
    expect(tx).toContain("Rozhoduje způsob placení, ne obor.");
    expect(links).toContain("/navody/eet-kadernictvi-kosmetika");
    expect(links).toContain(`/kontrola-ico#ico=${SALON.ico}`);
    // drobečková navigace kraj → obec → obor
    expect(links).toContain("/firmy/kraj/karlovarsky");
    expect(links).toContain("/firmy/obec/554961-karlovy-vary");
    expect(links).toContain("/obor/kadernictvi-a-kosmetika/obec/554961-karlovy-vary");
    // provozovna právnické osoby
    expect(links).toContain(`/provozovna/${SALON_ICP}-ukazkovy-salon-u-kolonady`);
    const ld = jsonLd(html);
    const org = ld.find((x) => x["@type"] === "Organization")!;
    expect(org).toMatchObject({ name: SALON.name, legalName: SALON.name, identifier: { propertyID: "IČO", value: SALON.ico }, vatID: SALON.dic, foundingDate: "2015-05-03" });
    expect(org.address).toMatchObject({ "@type": "PostalAddress", streetAddress: SALON.street, addressLocality: "Karlovy Vary", addressCountry: "CZ" });
    expect(org).not.toHaveProperty("isicV4");
    expect(org).not.toHaveProperty("naics");
    expect(ld.find((x) => x["@type"] === "WebPage")).toMatchObject({ dateModified: today, mainEntity: { "@id": `${String(org["@id"])}` } });
    expect(ld.some((x) => x["@type"] === "FAQPage")).toBe(true);
    expect(ld.some((x) => x["@type"] === "BreadcrumbList")).toBe(true);
  });

  it("gate: CTAs carry the IČO only in a fragment and nothing links into still-closed sections (pokladna until 2. 11.)", async () => {
    const { isClosed } = await import("@/lib/launch");
    for (const f of [SALON, OSVC, BISTRO]) {
      const { html } = await renderFirm(slugOf(f));
      const internal = hrefs(html).filter((h) => h.startsWith("/"));
      expect(internal.filter((h) => /[?&](ico|icp|odberatel)=/.test(h.split("#")[0]!)), f.name).toEqual([]);
      expect(internal.filter((h) => isClosed(h.split(/[?#]/)[0]!)), f.name).toEqual([]);
      expect(internal).toContain(`/faktura-zdarma#odberatel=${f.ico}`);
      // „Je to vaše firma?“ → předregistrace s IČO (po otevření pokladny se text přepne přes isClosed)
      expect(internal).toContain(`/#registrace&ico=${f.ico}`);
      expect(text(html)).not.toMatch(isClosed("/pokladna") ? /a evidujte v pokladně zdarma/ : /předregistrujte se k pokladně/);
    }
  });

  it("gate: OSVČ – page exists but noindex,follow; no street, DIČ, provozovny or personal JSON-LD even if they are in the DB", async () => {
    const { meta, html } = await renderFirm(slugOf(OSVC));
    const tx = text(html);
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(html).not.toContain("Tajná 7");
    expect(html).not.toContain("CZ8001011234");
    expect(tx).not.toContain("Provozovny");
    expect(hrefs(html).some((h) => h.startsWith("/provozovna/"))).toBe(false);
    expect(hrefs(html).some((h) => h.startsWith("https://or.justice.cz"))).toBe(false);
    expect(hrefs(html).some((h) => h.startsWith("https://mapy.com"))).toBe(false);
    expect(tx).toContain("obec sídla Karlovy Vary");
    expect(tx).toContain("Vystavit fakturu tomuto podnikateli");
    const org = jsonLd(html).find((x) => x["@type"] === "Organization")!;
    expect(org).not.toHaveProperty("foundingDate");
    expect(org).not.toHaveProperty("vatID");
    expect(org).not.toHaveProperty("taxID");
    expect(org.address).toEqual({ "@type": "PostalAddress", addressLocality: "Karlovy Vary", addressCountry: "CZ" });
    // provozovna OSVČ (údaj živnostenského rejstříku o fyzické osobě) nemá stránku
    const { default: Est } = await import("@/app/(site)/provozovna/[slug]/page");
    await expect(Est({ params: Promise.resolve({ slug: `${OSVC_ICP}-provozovna-osvc` }) } as never)).rejects.toThrow(NF);
  });

  it("gate: dissolved – out of lists at once, page noindex; 90+ days after dissolution the page is gone (404)", async () => {
    const recent = await renderFirm(slugOf(DISSOLVED_RECENT));
    expect(recent.meta.robots).toEqual({ index: false, follow: true });
    expect(text(recent.html)).toContain("Zaniklý subjekt");
    await expect(renderFirm(slugOf(DISSOLVED_OLD))).rejects.toThrow(NF);
    await expect(renderFirm(slugOf(DISSOLVED_OSVC_OLD))).rejects.toThrow(NF);
    const { items } = await catalog.listFirms({ cityCode: KV.code });
    expect(items.map((i) => i.ico)).not.toContain(DISSOLVED_RECENT.ico);
    expect((await catalog.searchFirmsByName("zaniklý salon")).length).toBe(0);
  });
});

/* ─────────────────────────────── seznamy ─────────────────────────────── */

describe("S3 – lists show legal persons by name, OSVČ only by count", () => {
  it("gate: obor × obec – stats tiles, PO list, OSVČ count + IČO search, ItemList with PO only, title ≤ 60", async () => {
    const { meta, html } = await renderRoute("@/app/(site)/obor/[obor]/obec/[obec]/page", { obor: "kadernictvi-a-kosmetika", obec: "554961-karlovy-vary" });
    const tx = text(html);
    expect((meta.title as { absolute: string }).absolute.length).toBeLessThanOrEqual(60);
    expect(String(meta.description).length).toBeGreaterThanOrEqual(140);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    for (const label of ["Subjektů v oboru", "Firmy (právnické osoby)", "Živnostníci (OSVČ)", "Nové za 12 měsíců"]) expect(tx).toContain(label);
    expect(tx).toContain(SALON.name);
    for (const o of [OSVC, OSVC2, OSVC3]) expect(tx).not.toContain(o.name);
    expect(tx).toContain("a další 3 živnostníci");
    const form = html.match(/<form[^>]*role="search"[^>]*>[\s\S]*?<\/form>/g)?.find((f) => f.includes('placeholder="IČO (8 číslic)"'));
    expect(form).toMatch(/action="\/firmy"/);
    expect(form).toMatch(/method="get"/);
    expect(form).toMatch(/name="q"/);
    const list = jsonLd(html).find((x) => x["@type"] === "ItemList") as { itemListElement: { name: string }[] };
    expect(list.itemListElement.map((i) => i.name)).toContain(SALON.name);
    expect(list.itemListElement.map((i) => i.name)).not.toContain(OSVC.name);
    expect(tx).toContain(`Kolik podnikatelů v oboru „Kadeřnictví, kosmetika, barber“ sídlí v obci Karlovy Vary?`);
  });

  it("gate: obec hub /firmy/obec/… – indexed with ≥ 10 verified subjects, links to obor × obec, PO only, ItemList", async () => {
    const { meta, html } = await renderRoute("@/app/(site)/firmy/obec/[obec]/page", { obec: "554961-karlovy-vary" });
    const tx = text(html);
    expect(meta.robots).toBeUndefined(); // 6 salonů + 3 OSVČ + bistro + nedávno zaniklý mimo = 10 ověřených
    expect(meta.alternates?.canonical).toBe("/firmy/obec/554961-karlovy-vary");
    expect(hrefs(html)).toContain("/obor/kadernictvi-a-kosmetika/obec/554961-karlovy-vary");
    expect(tx).toContain(BISTRO.name);
    expect(tx).not.toContain(OSVC.name);
    expect(tx).toContain("a další 3 živnostníci");
    // malá obec (Cheb, 1 subjekt) – stránka existuje, ale noindex
    const cheb = await renderRoute("@/app/(site)/firmy/obec/[obec]/page", { obec: "554481-cheb" });
    expect(cheb.meta.robots).toEqual({ index: false, follow: true });
    await expect(renderRoute("@/app/(site)/firmy/obec/[obec]/page", { obec: "999999-nikde" })).rejects.toThrow(NF);
  });

  it("gate: kraj page lists obce with counts and PO only; name search finds firms, never OSVČ", async () => {
    const { html } = await renderRoute("@/app/(site)/firmy/kraj/[kraj]/page", { kraj: "karlovarsky" });
    expect(hrefs(html)).toContain("/firmy/obec/554961-karlovy-vary");
    expect(text(html)).toContain(SALON.name);
    expect(text(html)).not.toContain(OSVC.name);
    expect((await catalog.searchFirmsByName("Ukázková Kadeřnice")).map((x) => x.ico)).toEqual([]);
    expect((await catalog.searchFirmsByName("Ukázkový salon")).length).toBeGreaterThan(0);
  });
});

/* ─────────────────────────────── sitemapy, robots, AI ─────────────────────────────── */

describe("S3 – sitemaps, robots.txt, llms.txt, MCP", () => {
  it("gate: firm sitemap – only indexable legal persons in kraj 51 (no OSVČ, no dissolved), lastmod = ARES; switch CATALOG_INDEX_PERSONS", async () => {
    const mod = await import("@/app/firma/sitemap");
    const entries = await mod.default({ id: Promise.resolve("0") });
    const paths = entries.map((e) => new URL(e.url).pathname);
    expect(paths).toContain(`/firma/${slugOf(SALON)}`);
    for (const f of [OSVC, OSVC2, DISSOLVED_RECENT, DISSOLVED_OLD]) expect(paths).not.toContain(`/firma/${slugOf(f)}`);
    expect(entries.find((e) => e.url.endsWith(slugOf(SALON)))?.lastModified).toBe(today);
    const est = await import("@/app/provozovna/sitemap");
    const estPaths = (await est.default({ id: Promise.resolve("0") })).map((e) => new URL(e.url).pathname);
    expect(estPaths).toContain(`/provozovna/${SALON_ICP}-ukazkovy-salon-u-kolonady`);
    expect(estPaths.some((p) => p.includes(OSVC_ICP))).toBe(false);
    process.env.CATALOG_INDEX_PERSONS = "1";
    try {
      expect((await catalog.indexableFirmsChunk(0)).map((r) => r.ico)).toContain(OSVC.ico);
      // provozovny OSVČ ani s přepínačem ne (údaje živnostenského rejstříku o fyzických osobách)
      expect((await catalog.indexableEstablishmentsChunk(0)).map((r) => r.icp)).not.toContain(OSVC_ICP);
    } finally {
      delete process.env.CATALOG_INDEX_PERSONS;
    }
    const lists = await import("@/app/firmy/sitemap");
    const listPaths = (await lists.default()).map((e) => new URL(e.url).pathname);
    expect(listPaths).toContain("/firmy/obec/554961-karlovy-vary");
    expect(listPaths).not.toContain("/firmy/obec/554481-cheb");
  });

  it("gate: robots.txt lists the catalogue sitemaps and does not block the catalogue; /firmy?q= stays disallowed", async () => {
    const { default: robots } = await import("@/app/robots");
    const r = await robots();
    const maps = ([] as string[]).concat(r.sitemap ?? []);
    expect(maps.some((s) => s.endsWith("/firmy/sitemap.xml"))).toBe(true);
    expect(maps.some((s) => s.endsWith("/firma/sitemap/0.xml"))).toBe(true);
    for (const rule of [r.rules].flat()) {
      const dis = ([] as string[]).concat(rule.disallow ?? []);
      expect(dis.filter((d) => /^\/(firmy|firma|obor|provozovna)[$/]/.test(d))).toEqual([]);
      expect(dis).toContain("/firmy?q=");
    }
  });

  it("gate: llms.txt has the catalogue section; MCP and llms never build ?ico= links", async () => {
    const { llmsTxt } = await import("@/lib/llms");
    const l = llmsTxt();
    expect(l).toContain("## Katalog firem");
    expect(l).toContain("eet_check_ico");
    expect(l).toContain("OSVČ");
    expect(l).not.toMatch(/\?ico=/);
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    for (const f of walk(join(ROOT, "src/lib/mcp"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/kontrola-ico\?ico=/);
  });

  it("gate: guides link the main KV industries to catalogue pages that exist", async () => {
    const { GUIDE_CATALOG_LINKS } = await import("@/components/catalog/guide-catalog-links");
    const { getGuide } = await import("@/content/guides");
    const { catalogIndustry } = await import("@/components/catalog/industry");
    expect(Object.keys(GUIDE_CATALOG_LINKS).sort()).toEqual(["eet-gastronomie", "eet-kadernictvi-kosmetika", "eet-trhy-stanky", "eet-ubytovani"]);
    for (const [g, ind] of Object.entries(GUIDE_CATALOG_LINKS)) {
      expect(getGuide(g), g).toBeDefined();
      expect(catalogIndustry(ind), ind).toBeDefined();
    }
    expect(read("src/app/(site)/navody/[slug]/page.tsx")).toContain("<GuideCatalogLinks slug={g.slug} />");
  });
});

/* ─────────────────────────────── výkon ─────────────────────────────── */

describe("S3 – performance", () => {
  it("gate: shared cache only for DB pages; the live ARES view is private; nginx microcache file and migration 0038", async () => {
    const { catalogCacheHeaders, CATALOG_CACHE_CONTROL } = await import("@/lib/catalog-cache");
    expect(CATALOG_CACHE_CONTROL).toBe("public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    const h = catalogCacheHeaders(false);
    expect(h.at(-1)).toEqual({ source: "/firma/:ico(\\d{8})", headers: [{ key: "Cache-Control", value: "private, no-store" }] });
    const sql = readFileSync(join(ROOT, "../../packages/db/migrations/0038_catalog_legal_indexes.sql"), "utf8").replace(/^--.*$/gm, "");
    expect(sql.match(/CREATE INDEX IF NOT EXISTS/g)?.length).toBe(2);
    expect(sql).not.toMatch(/CONCURRENTLY/);
    const idx = (await t.pg.query<{ indexname: string; indexdef: string }>("select indexname, indexdef from pg_indexes where tablename = 'firms'")).rows;
    expect(idx.find((i) => i.indexname === "firms_listable_legal_region_name")?.indexdef).toMatch(/\(region_code, name\) WHERE .*is_natural_person = false/);
    expect(idx.find((i) => i.indexname === "firms_listable_legal_city_name")?.indexdef).toMatch(/\(city_code, name\) WHERE .*is_natural_person = false/);
    expect(read("../../infra/nginx/evidujzdarma.conf")).toContain("location ~ ^/(pokladna|prihlaseni|kabinet|pozvanka|u)(/|$) {");
  });

  it("gate: the load test script needs no dependencies and reports p50/p95", () => {
    const src = readFileSync(join(ROOT, "../worker/src/catalog/loadtest.ts"), "utf8");
    expect(src).not.toMatch(/from "(?!\.\/|node:)/);
    expect(src).toContain("p95");
    expect(JSON.parse(readFileSync(join(ROOT, "../worker/package.json"), "utf8")).scripts["catalog:loadtest"]).toBe("tsx src/catalog/loadtest.ts");
  });
});
