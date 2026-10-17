/**
 * S2-D – katalog firem: programové stránky obor × obec, vylepšená stránka firmy, bezpečnost procházení, výkon.
 *  - /obor/[obor]/obec/[kód-slug]: H1, počet, seznam po 50, FAQ jen z FACTS, odkazy; index jen s ≥ 5 ověřenými subjekty;
 *  - sitemap /obor/sitemap/{n}.xml jen se stránkami nad prahem a jen z indexovaných krajů;
 *  - stránka firmy: CTA s IČO jen ve fragmentu (žádné ?ico= v HTML), „Podobné firmy v okolí“, „Další firmy na stejné
 *    adrese“ jen u právnických osob a jen s právnickými osobami, FAQ z polí registru;
 *  - OSVČ: ulice se nikde neobjeví (ani když by v DB omylem byla);
 *  - robots.txt: Disallow pro URL s IČO v query, žádná stránka ze STATIC_PAGES zablokovaná;
 *  - render na vyžádání bez ISR (R3.3), cache agregací v paměti.
 * Data: syntetické subjekty „Ukázkov…“ v PGlite se stejnými migracemi jako produkce (vč. 0037).
 * S3: katalog je otevřený; v seznamech jmenovitě jen právnické osoby (OSVČ počtem), OSVČ noindex – testy upravené
 * (nové chování podrobně v s3-catalog.test.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, schema } from "@ez/db";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Mozilla/5.0", "x-real-ip": "198.51.100.90" }) }));
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

/* ─────────────────────────────── syntetická data ─────────────────────────────── */

function icoCheck(first7: string): string {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(first7[i]) * (8 - i);
  const r = sum % 11;
  return `${first7}${r === 0 ? 1 : r === 1 ? 0 : 11 - r}`;
}
let seq = 0;
const nextIco = () => icoCheck(String(9950000 + ++seq));

const KV = { code: 554961, name: "Karlovy Vary", region: 51 };
const CHEB = { code: 554481, name: "Cheb", region: 51 };
const SOKOLOV = { code: 560286, name: "Sokolov", region: 51 };
const OSTROV = { code: 555428, name: "Ostrov", region: 51 };
const MLAZNE = { code: 554642, name: "Mariánské Lázně", region: 51 };
const PRAHA = { code: 554782, name: "Praha", region: 19 };

type Obec = typeof KV;
type FirmInsert = typeof schema.firms.$inferInsert;
const today = new Date().toISOString().slice(0, 10);

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
    dic: natural ? null : "CZ00000000",
    vatPayer: !natural,
    foundedAt: "2015-03-02",
    aresUpdatedAt: today,
    street: natural ? null : `Ukázková ${seq}`,
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

const rows: FirmInsert[] = [];
const kvSalon = (i: number, o: Partial<FirmInsert> = {}) => firm(KV, `Ukázkové kadeřnictví ${String(i).padStart(2, "0")} s.r.o.`, o);
// Karlovy Vary: 6 s.r.o. + 1 OSVČ (= 7 ověřených), 2 s.r.o. a OSVČ na stejné adrese „Hlavní 1“
const SALON_A = kvSalon(1, { street: "Hlavní 1" });
const SALON_B = kvSalon(2);
const BISTRO_SAME_ADDR = firm(KV, "Ukázkové bistro na Hlavní s.r.o.", { street: "Hlavní 1", nace: ["56101"] });
// OSVČ s ulicí v DB (simulace chyby importu) – ulice se nikde nesmí objevit
const OSVC = firm(KV, "Ukázková Kadeřnice Tajná", { isNaturalPerson: true, legalForm: "101", street: "Hlavní 1", dic: null, vatPayer: false });
const OSVC_STREET = "Hlavní 1";
rows.push(SALON_A, SALON_B, kvSalon(3), kvSalon(4), kvSalon(5), kvSalon(6), OSVC, BISTRO_SAME_ADDR);
// nesmí být v seznamech: námitka, zaniklá
rows.push(kvSalon(90, { name: "Ukázkové kadeřnictví s námitkou s.r.o.", noindex: true }), kvSalon(91, { name: "Ukázkové zaniklé kadeřnictví s.r.o.", dissolvedAt: "2024-06-30" }));
// Cheb: 3 → pod prahem
for (let i = 1; i <= 3; i++) rows.push(firm(CHEB, `Ukázkové kadeřnictví Cheb ${i} s.r.o.`));
// Sokolov: 5 v seznamu, ale jen 4 ověřené v ARES → pod prahem (práh se počítá z indexovatelných)
for (let i = 1; i <= 5; i++) rows.push(firm(SOKOLOV, `Ukázkové kadeřnictví Sokolov ${i} s.r.o.`, i === 5 ? { aresUpdatedAt: null } : {}));
// Ostrov: přesně 5 ověřených → na prahu, indexuje se
for (let i = 1; i <= 5; i++) rows.push(firm(OSTROV, `Ukázkové kadeřnictví Ostrov ${i} s.r.o.`));
// Mariánské Lázně: 55 restaurací → 2 strany po 50
for (let i = 1; i <= 55; i++) rows.push(firm(MLAZNE, `Ukázková restaurace ${String(i).padStart(2, "0")} s.r.o.`, { nace: ["56101"] }));
// Praha: kraj mimo postupné spuštění (CATALOG_INDEX_REGIONS=51) → noindex i s 6 subjekty
for (let i = 1; i <= 6; i++) rows.push(firm(PRAHA, `Ukázkové kadeřnictví Praha ${i} s.r.o.`));

let t: TestDb;
let catalog: typeof import("@/lib/server/catalog");

beforeAll(async () => {
  delete process.env.CATALOG_INDEX_REGIONS;
  delete process.env.CATALOG_REQUIRE_ARES;
  t = await createTestDb();
  for (let i = 0; i < rows.length; i += 50) await getDb().insert(schema.firms).values(rows.slice(i, i + 50));
  catalog = await import("@/lib/server/catalog");
  catalog.__clearCatalogMemo();
}, 60_000);
afterAll(async () => t?.close());

const obecPage = () => import("@/app/(site)/obor/[obor]/obec/[obec]/page");
async function renderObec(obor: string, obec: string, strana?: string) {
  const { default: Page, generateMetadata } = await obecPage();
  const props = { params: Promise.resolve({ obor, obec }), searchParams: Promise.resolve(strana ? { strana } : {}) } as never;
  const meta = await generateMetadata(props);
  const html = renderToStaticMarkup((await Page(props)) as ReactElement);
  return { meta, html };
}
async function renderFirm(f: FirmInsert) {
  const { default: Page, generateMetadata } = await import("@/app/(site)/firma/[slug]/page");
  const props = { params: Promise.resolve({ slug: `${f.ico}-${f.slug}` }) } as never;
  const meta = await generateMetadata(props);
  const html = renderToStaticMarkup((await Page(props)) as ReactElement);
  return { meta, html };
}

/* ─────────────────────────────── obor × obec ─────────────────────────────── */

describe("S2-D – obor × obec page", () => {
  it("gate: renders H1, count and the list (Karlovy Vary, 7 subjects; objection and dissolved left out)", async () => {
    const { meta, html } = await renderObec("kadernictvi-a-kosmetika", "554961-karlovy-vary");
    const tx = text(html);
    expect(html).toMatch(/<h1[^>]*>Kadeřnictví a kosmetika Karlovy Vary – firmy a EET 2\.0<\/h1>/);
    expect(tx).toContain("V katalogu je 7 subjektů se sídlem v obci Karlovy Vary");
    for (const f of [SALON_A, SALON_B]) {
      expect(tx).toContain(f.name);
      expect(hrefs(html)).toContain(`/firma/${f.ico}-${f.slug}`);
    }
    // S3: OSVČ jen počtem
    expect(tx).not.toContain(OSVC.name);
    expect(hrefs(html)).not.toContain(`/firma/${OSVC.ico}-${OSVC.slug}`);
    expect(tx).toContain("a další 1 živnostník");
    expect(tx).not.toContain("s námitkou");
    expect(tx).not.toContain("zaniklé kadeřnictví");
    expect(tx).not.toContain(BISTRO_SAME_ADDR.name); // jiný obor
    // EET pro obor: revidovaný návod a jeho shrnutí, kontrola IČO
    expect(hrefs(html)).toContain("/navody/eet-kadernictvi-kosmetika");
    expect(tx).toContain("Stručně z návodu");
    expect(hrefs(html)).toContain("/kontrola-ico");
    // FAQ 3–5 otázek s JSON-LD a zdroji
    const faq = JSON.parse(html.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"FAQPage"[\s\S]*?)<\/script>/)![1]!);
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3);
    expect(faq.mainEntity.length).toBeLessThanOrEqual(6);
    expect(tx).toContain("Zdroje:");
    expect(tx).toContain("1. 1. 2027");
    // indexuje se, kanonická adresa
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe("/obor/kadernictvi-a-kosmetika/obec/554961-karlovy-vary");
    expect(meta.title).toEqual({ absolute: "Kadeřnictví a kosmetika Karlovy Vary – firmy a EET 2.0" });
  });

  it("gate: links – the same obor in other obce of the kraj (only those not thin) and other obory in the same obec", async () => {
    const { html } = await renderObec("kadernictvi-a-kosmetika", "554961-karlovy-vary");
    const links = hrefs(html);
    expect(links).toContain("/obor/kadernictvi-a-kosmetika/obec/555428-ostrov");
    expect(links).toContain("/obor/kadernictvi-a-kosmetika/obec/560286-sokolov"); // 5 v seznamu (stránka existuje, jen noindex)
    expect(links).not.toContain("/obor/kadernictvi-a-kosmetika/obec/554481-cheb"); // 3 – tenká stránka se neodkazuje
    expect(links.some((l) => l.includes("554782"))).toBe(false); // Praha je jiný kraj
    expect(links).toContain("/obor/kadernictvi-a-kosmetika/kraj/karlovarsky");
    // obor×kraj odkazuje na obce
    const { default: KrajPage } = await import("@/app/(site)/obor/[obor]/kraj/[kraj]/page");
    const kraj = renderToStaticMarkup((await KrajPage({ params: Promise.resolve({ obor: "kadernictvi-a-kosmetika", kraj: "karlovarsky" }), searchParams: Promise.resolve({}) } as never)) as ReactElement);
    expect(hrefs(kraj)).toContain("/obor/kadernictvi-a-kosmetika/obec/554961-karlovy-vary");
    expect(hrefs(kraj)).not.toContain("/obor/kadernictvi-a-kosmetika/obec/554481-cheb");
  });

  it("gate: threshold – fewer than 5 indexable subjects (or a kraj outside the rollout) is noindex,follow", async () => {
    for (const [obec, why] of [
      ["554481-cheb", "3 subjects"],
      ["560286-sokolov", "5 listed, 4 verified in ARES"],
      ["554782-praha", "kraj 19 is not indexed"],
    ] as const) {
      const { meta } = await renderObec("kadernictvi-a-kosmetika", obec);
      expect(meta.robots, why).toEqual({ index: false, follow: true });
    }
    expect((await renderObec("kadernictvi-a-kosmetika", "555428-ostrov")).meta.robots).toBeUndefined(); // přesně 5
    expect(catalog.OBEC_MIN_FIRMS).toBe(5);
  });

  it("gate: pagination by 50 – page 2 has the rest, a page past the end is 404", async () => {
    const p1 = await renderObec("restaurace-a-kavarny", "554642-marianske-lazne");
    expect(text(p1.html)).toContain("V katalogu je 55 subjektů");
    expect((text(p1.html).match(/Ukázková restaurace \d\d s\.r\.o\./g) ?? []).length).toBe(50);
    expect(hrefs(p1.html)).toContain("/obor/restaurace-a-kavarny/obec/554642-marianske-lazne?strana=2");
    const p2 = await renderObec("restaurace-a-kavarny", "554642-marianske-lazne", "2");
    expect((text(p2.html).match(/Ukázková restaurace \d\d s\.r\.o\./g) ?? []).length).toBe(5);
    expect(p2.meta.alternates?.canonical).toBe("/obor/restaurace-a-kavarny/obec/554642-marianske-lazne?strana=2");
    await expect(renderObec("restaurace-a-kavarny", "554642-marianske-lazne", "3")).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("gate: URL – unknown obor/obec or an obor with no subjects is 404; empty or other spelling redirects once to the canonical slug", async () => {
    const nf = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;
    await expect(renderObec("neexistuje", "554961-karlovy-vary")).rejects.toThrow(nf);
    await expect(renderObec("kadernictvi-a-kosmetika", "999999-nikde")).rejects.toThrow(nf);
    await expect(renderObec("doprava-taxi", "554961-karlovy-vary")).rejects.toThrow(nf);
    await expect(renderObec("kadernictvi-a-kosmetika", "554961-<script>")).rejects.toThrow(nf);
    const redirect = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/obor\/kadernictvi-a-kosmetika\/obec\/554961-karlovy-vary;308;/) };
    await expect(renderObec("kadernictvi-a-kosmetika", "554961")).rejects.toMatchObject(redirect);
    await expect(renderObec("kadernictvi-a-kosmetika", "554961-carlsbad")).rejects.toMatchObject(redirect);
  });

  it("gate: every obor maps to an indexable reviewed guide or the pillar", async () => {
    const { CATALOG_INDUSTRIES } = await import("@/components/catalog/industry");
    const { getGuide, isIndexable } = await import("@/content/guides");
    for (const i of CATALOG_INDUSTRIES) {
      if (!i.guide) continue;
      const g = getGuide(i.guide.slug);
      expect(g, i.slug).toBeDefined();
      expect(isIndexable(g!), i.slug).toBe(true);
    }
    expect(CATALOG_INDUSTRIES.find((i) => i.slug === "restaurace-a-kavarny")?.guide?.slug).toBe("eet-gastronomie");
    expect(CATALOG_INDUSTRIES.find((i) => i.slug === "maloobchod")?.guide?.slug).toBe("eet-trhy-stanky");
  });
});

/* ─────────────────────────────── sitemap ─────────────────────────────── */

describe("S2-D – obor × obec sitemap", () => {
  it("gate: only pages above the threshold and only from indexed kraje; registered for robots.txt", async () => {
    const mod = await import("@/app/obor/sitemap");
    expect(await mod.generateSitemaps()).toEqual([{ id: 0 }]);
    const urls = (await mod.default({ id: Promise.resolve("0") })).map((e) => new URL(e.url).pathname);
    expect(urls).toContain("/obor/kadernictvi-a-kosmetika/obec/554961-karlovy-vary");
    expect(urls).toContain("/obor/kadernictvi-a-kosmetika/obec/555428-ostrov");
    expect(urls).toContain("/obor/restaurace-a-kavarny/obec/554642-marianske-lazne");
    for (const thin of ["554481-cheb", "560286-sokolov", "554782-praha"]) expect(urls).not.toContain(`/obor/kadernictvi-a-kosmetika/obec/${thin}`);
    // restaurace v KV: jen 1 bistro → ne
    expect(urls).not.toContain("/obor/restaurace-a-kavarny/obec/554961-karlovy-vary");
    expect(await mod.default({ id: Promise.resolve("1") })).toEqual([]);
    const { catalogSitemapPaths } = await import("@/lib/server/catalog-sitemaps");
    expect(await catalogSitemapPaths()).toContain("/obor/sitemap/0.xml");
  });
});

/* ─────────────────────────────── stránka firmy ─────────────────────────────── */

describe("S2-D – firm page", () => {
  it("gate: CTAs carry the IČO only in a fragment – no ?ico= / &ico= / ?icp= in any internal href", async () => {
    const { html } = await renderFirm(SALON_A);
    const links = hrefs(html);
    const { isClosed } = await import("@/lib/launch");
    expect(links).toContain(`/#registrace&ico=${SALON_A.ico}`);
    expect(text(html)).toContain(isClosed("/pokladna") ? "Pokladna zdarma – předregistrace" : "Začít evidovat zdarma");
    expect(links).toContain(`/kontrola-ico#ico=${SALON_A.ico}`);
    expect(links).toContain(`/namitka#ico=${SALON_A.ico}`);
    expect(text(html)).toContain("Je to vaše firma?");
    // „Vystavit fakturu této firmě“ jen když je generátor faktur zveřejněný (proud S2-C), vždy s fragmentem
    const { fakturaLink, hasFakturaPage } = await import("@/lib/faktura-link");
    expect(fakturaLink(SALON_A.ico!)).toBe(`/faktura-zdarma#odberatel=${SALON_A.ico}`);
    expect(links.includes(`/faktura-zdarma#odberatel=${SALON_A.ico}`)).toBe(hasFakturaPage());
    expect(text(html).includes("Vystavit fakturu této firmě")).toBe(hasFakturaPage());
    // žádný interní odkaz s IČO/IČP v query (oficiální záznam v ARES je cizí web)
    // (část za „#“ je fragment – ten se na server neposílá a roboti ho neprocházejí)
    // (S3: odkazy na cizí weby – ARES, Veřejný rejstřík justice.cz – nesou IČO v query, to je jejich adresa)
    const bad = links.filter((h) => h.startsWith("/") && /[?&](ico|icp|odberatel)=/.test(h.split("#")[0]!));
    expect(links.filter((h) => h.startsWith("https://ares.gov.cz/")).length).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  it("gate: „Podobné firmy v okolí“ – same obor in the same obec, neighbours by name, link to the obor × obec page", async () => {
    const { html } = await renderFirm(SALON_B);
    const tx = text(html);
    expect(tx).toContain("Podobné firmy v obci Karlovy Vary");
    const section = html.slice(html.indexOf('id="podobne-firmy"'), html.indexOf("</section>", html.indexOf('id="podobne-firmy"')));
    expect(text(section)).not.toContain(SALON_B.name); // ne sama sebe
    expect(text(section)).toContain("Ukázkové kadeřnictví 03 s.r.o."); // soused v abecedě
    expect(text(section)).not.toContain(BISTRO_SAME_ADDR.name); // jiný obor
    expect(text(section)).not.toContain("Cheb"); // jiná obec
    expect(hrefs(section)).toContain("/obor/kadernictvi-a-kosmetika/obec/554961-karlovy-vary");
  });

  it("gate: „Další firmy na stejné adrese“ – legal persons only, on both sides; the OSVČ at the same address is never listed", async () => {
    const { html } = await renderFirm(SALON_A);
    expect(text(html)).toContain("Na stejné adrese");
    const section = html.slice(html.indexOf('id="stejna-adresa"'), html.indexOf("</section>", html.indexOf('id="stejna-adresa"')));
    expect(text(section)).toContain(BISTRO_SAME_ADDR.name);
    expect(text(section)).not.toContain(OSVC.name);
    const other = await catalog.sameAddressFirms({ ico: BISTRO_SAME_ADDR.ico!, isNaturalPerson: false, legalForm: "112", street: "Hlavní 1", cityCode: KV.code });
    expect(other.items.map((x) => x.ico)).toEqual([SALON_A.ico]);
    // OSVČ (i s neznámou formou = fail-closed) sekci nemá vůbec
    expect((await catalog.sameAddressFirms({ ico: OSVC.ico!, isNaturalPerson: true, legalForm: "101", street: "Hlavní 1", cityCode: KV.code })).items).toEqual([]);
    expect((await catalog.sameAddressFirms({ ico: "00000000", isNaturalPerson: false, legalForm: null, street: "Hlavní 1", cityCode: KV.code })).items).toEqual([]);
  });

  it("gate: OSVČ – the street never appears (firm page, its FAQ and JSON-LD, obor × obec page, neighbours' pages)", async () => {
    const own = await renderFirm(OSVC);
    expect(own.html).not.toContain(OSVC_STREET);
    expect(text(own.html)).not.toContain("Na stejné adrese");
    expect(text(own.html)).toContain("U podnikajících fyzických osob uvádíme jen obec sídla – ne adresu, DIČ ani provozovny.");
    expect(text(own.html)).not.toMatch(/Kde sídlí/);
    const obec = await renderObec("kadernictvi-a-kosmetika", "554961-karlovy-vary");
    expect(obec.html).not.toContain(OSVC_STREET);
    // stránka sousední s.r.o.: OSVČ ani v „Podobné firmy“ (S3: jen právnické osoby), ani ve „stejné adrese“
    const neighbour = await renderFirm(SALON_B);
    expect(text(neighbour.html)).not.toContain(OSVC.name);
    const similar = neighbour.html.slice(neighbour.html.indexOf('id="podobne-firmy"'), neighbour.html.indexOf("</section>", neighbour.html.indexOf('id="podobne-firmy"')));
    expect(similar).not.toContain(OSVC_STREET);
  });

  it("gate: FAQ (5–8 questions) from registry fields; EET answer says „pravděpodobně“ and links the IČO check by fragment", async () => {
    const { html } = await renderFirm(SALON_A);
    const faq = JSON.parse(html.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"FAQPage"[\s\S]*?)<\/script>/)![1]!);
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(5);
    expect(faq.mainEntity.length).toBeLessThanOrEqual(8);
    const qa = Object.fromEntries(faq.mainEntity.map((m: { name: string; acceptedAnswer: { text: string } }) => [m.name, m.acceptedAnswer.text]));
    expect(qa[`Jaké IČO má ${SALON_A.name}?`]).toContain(SALON_A.ico);
    expect(qa[`Je ${SALON_A.name} plátce DPH?`]).toMatch(/^Ano\. Podle ARES k /);
    expect(qa[`Kde sídlí ${SALON_A.name}?`]).toContain("Hlavní 1, 360 01 Karlovy Vary"); // S3: PSČ ve tvaru „360 01“
    expect(qa[`Od kdy existuje ${SALON_A.name}?`]).toContain("2. 3. 2015");
    const eet = qa[`Musí ${SALON_A.name} evidovat tržby (EET 2.0)?`];
    expect(eet).toMatch(/pravděpodobně ano/);
    expect(eet).toContain("orientační odhad, ne o právní posouzení");
    expect(qa[`Může ${SALON_A.name} využít EET OFF?`]).toMatch(/^Ne\. Režim je jen pro fyzické osoby\./);
    expect(hrefs(html)).toContain(`/kontrola-ico#ico=${SALON_A.ico}`);
  });

  it("gate: pure helpers – Czech plural and the OSVČ variant of the FAQ (no seat question, EET OFF depends on paušál)", async () => {
    const { firmFaq, pluralCs } = await import("@/lib/catalog-faq");
    const forms: [string, string, string] = ["provozovnu", "provozovny", "provozoven"];
    expect([1, 2, 4, 5, 11, 0].map((n) => pluralCs(n, forms))).toEqual(["provozovnu", "provozovny", "provozovny", "provozoven", "provozoven", "provozoven"]);
    const { items } = firmFaq(
      { ico: "12345679", name: "Jana Ukázková", isNaturalPerson: true, dic: null, vatPayer: false, foundedAt: "2020-01-01", dissolvedAt: null, seat: "Tajná 1, Praha", establishments: 2, eetRelevance: "possible", matched: [], sourceDate: "2026-10-15", sourceKind: "ares" },
      { kontrolaIco: "/kontrola-ico#ico=12345679" },
    );
    expect(items.some((i) => /sídlí/.test(i.q))).toBe(false);
    expect(JSON.stringify(items)).not.toContain("Tajná");
    expect(items.find((i) => /provozoven/.test(i.q))?.a).toContain("2 aktivní provozovny");
    expect(items.find((i) => /EET OFF/.test(i.q))?.a).toContain("z veřejných registrů nezjistíme");
    expect(items.find((i) => /evidovat tržby/.test(i.q))?.link?.href).toBe("/kontrola-ico#ico=12345679");
  });
});

/* ─────────────────────────────── procházení robotů ─────────────────────────────── */

describe("S2-D – crawl safety", () => {
  it("gate: fragment helpers – links, parsing, validation", async () => {
    const h = await import("@/lib/hash-params");
    expect(h.kontrolaIcoHref("12345679")).toBe("/kontrola-ico#ico=12345679");
    expect(h.registraceHref("12345679")).toBe("/#registrace&ico=12345679");
    expect(h.registraceHref()).toBe("/#registrace");
    expect(h.parseHash("#registrace&ico=12345679")).toMatchObject({ anchor: "registrace" });
    expect(h.icoFromHash("#registrace&ico=12345679")).toBe("12345679");
    expect(h.icoFromHash("#ico=12345679")).toBe("12345679");
    for (const bad of ["", "#ico=", "#ico=12345678", "#ico=1234567", "#ico=%3Cscript%3E", "#registrace"]) expect(h.icoFromHash(bad), bad).toBeNull();
    expect(h.withHashIco("/pokladna/nastaveni", "#registrace&ico=12345679")).toBe("/pokladna/nastaveni?ico=12345679");
    expect(h.withHashIco("/pokladna/nastaveni", "#registrace")).toBe("/pokladna/nastaveni");
    expect(h.withHashIco("/pokladna", "#ico=12345679")).toBe("/pokladna");
    const { objectionPath, obecSlug, parseObecSlug } = await import("@/components/catalog/paths");
    expect(objectionPath({ ico: "12345679", icp: "1001234567" })).toBe("/namitka#ico=12345679&icp=1001234567");
    expect(obecSlug({ code: 554642, name: "Mariánské Lázně" })).toBe("554642-marianske-lazne");
    expect(parseObecSlug("554642-marianske-lazne")).toEqual({ code: 554642, suffix: "marianske-lazne" });
    expect(parseObecSlug("abc")).toBeNull();
  });

  it("gate: the targets read the fragment – kontrola IČO (old ?ico= links still work on the server), námitka, předregistrace, přihlášení", async () => {
    const page = read("src/app/(site)/kontrola-ico/page.tsx");
    expect(page).toContain("<IcoHashRedirect />");
    expect(page).toMatch(/robots: ico \? \{ index: false, follow: true \} : undefined/);
    expect(read("src/components/ico-hash-redirect.tsx")).toMatch(/icoFromHash\(window\.location\.hash\)/);
    expect(read("src/components/catalog/objection-form.tsx")).toMatch(/parseHash\(window\.location\.hash\)/);
    expect(read("src/components/prereg-form.tsx")).toMatch(/icoFromHash\(window\.location\.hash\)/);
    expect(read("src/components/pos/login-form.tsx")).toMatch(/withHashIco\(redirectTo, window\.location\.hash\)/);
    // kontrola IČO bez parametru se vykreslí (formulář + čtení fragmentu)
    const { default: Kontrola } = await import("@/app/(site)/kontrola-ico/page");
    const html = renderToStaticMarkup((await Kontrola({ searchParams: Promise.resolve({}) } as never)) as ReactElement);
    expect(html).toContain('id="hero-ico"');
  });

  it("gate: no link in pages or components builds an IČO query string (only the form submit and the ARES deep link do)", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    const offenders: string[] = [];
    for (const f of [...walk(join(ROOT, "src/app")), ...walk(join(ROOT, "src/components"))].filter((x) => /\.tsx?$/.test(x))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/href=\{?[`"'][^`"'\n]*[?&](ico|icp)=/g)) offenders.push(`${f.slice(ROOT.length)}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it("gate: robots.txt disallows IČO query URLs for every bot and still blocks no STATIC_PAGES path", async () => {
    const { default: robots } = await import("@/app/robots");
    const { STATIC_PAGES } = await import("@/lib/static-pages");
    const { QUERY_ID_DISALLOW } = await import("@/lib/robots-rules");
    // Google/Bing/Seznam: „*“ = libovolný řetězec, „$“ = konec
    const re = (rule: string) => new RegExp(`^${rule.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$|\$$/, "$")}`);
    const blocks = (rule: string, path: string) => re(rule).test(path);
    const r = await robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const dis = ([] as string[]).concat(rule.disallow ?? []);
      for (const d of QUERY_ID_DISALLOW) expect(dis, String(rule.userAgent)).toContain(d);
      expect(STATIC_PAGES.flatMap((p) => dis.filter((d) => blocks(d, p.path)).map((d) => `${p.path} <- ${d}`))).toEqual([]);
      for (const p of ["/kontrola-ico?ico=12345679", "/?ico=12345679", "/namitka?ico=12345679&icp=1", "/namitka?icp=1001234567", "/firmy?q=x&ico=12345679", "/firmy?q=12345679"]) {
        expect(dis.some((d) => blocks(d, p)), p).toBe(true);
      }
      for (const p of ["/kontrola-ico", "/namitka", "/", "/navody/eet-off", "/qr-platba?castka=100"]) expect(dis.some((d) => blocks(d, p)), p).toBe(false);
    }
  });
});

/* ─────────────────────────────── výkon ─────────────────────────────── */

describe("S2-D – rendering strategy for 1M+ pages", () => {
  it("gate: all catalog pages render on demand (force-dynamic, no ISR revalidate on disk)", () => {
    for (const f of [
      "src/app/(site)/obor/[obor]/obec/[obec]/page.tsx",
      "src/app/(site)/obor/[obor]/kraj/[kraj]/page.tsx",
      "src/app/(site)/firmy/page.tsx",
      "src/app/(site)/firmy/kraj/[kraj]/page.tsx",
      "src/app/(site)/firmy/nove/[mesic]/page.tsx",
      "src/app/(site)/firmy/obec/[obec]/page.tsx",
      "src/app/(site)/firma/[slug]/page.tsx",
      "src/app/(site)/provozovna/[slug]/page.tsx",
      "src/app/obor/sitemap.ts",
    ]) {
      const s = read(f);
      expect(s, f).toContain('export const dynamic = "force-dynamic"');
      expect(s, f).not.toMatch(/export const revalidate|generateStaticParams/);
    }
  });

  it("gate: list pages get a short shared-cache header only once the catalogue is open (never behind basic auth)", async () => {
    const { catalogCacheHeaders, CATALOG_LIST_CACHE_CONTROL } = await import("@/lib/catalog-cache");
    expect(catalogCacheHeaders(true)).toEqual([]);
    const open = catalogCacheHeaders(false);
    // S3: i stránky firem v katalogu a provozovny; živý náhled /firma/{IČO} až poslední (přepíše na private)
    expect(open.map((h) => h.source)).toEqual(["/firmy/:path*", "/obor/:path*", "/provozovna/:path*", "/firma/:slug", "/firma/:ico(\\d{8})"]);
    expect(CATALOG_LIST_CACHE_CONTROL).toMatch(/s-maxage=\d+/);
    expect(CATALOG_LIST_CACHE_CONTROL).toMatch(/max-age=0/);
    expect(read("next.config.ts")).toContain("...catalogCacheHeaders()");
  });

  it("gate: aggregates are cached in memory (one query per kraj), the new queries have their indexes (migration 0037)", async () => {
    // agregace (regulární výraz) a seznam (EXISTS) počítají obor stejně
    expect((await catalog.listFirms({ cityCode: KV.code, nacePrefixes: ["9602"] })).total).toBe(7);
    expect((await catalog.listFirms({ cityCode: SOKOLOV.code, nacePrefixes: ["9602"] })).total).toBe(5);
    const a = await catalog.regionObecStats(51);
    const b = await catalog.regionObecStats(51);
    expect(a).toBe(b);
    expect(a.get(KV.code)?.industries["kadernictvi-a-kosmetika"]).toMatchObject({ listable: 7, indexable: 7, legal: 6 });
    expect(a.get(SOKOLOV.code)?.industries["kadernictvi-a-kosmetika"]).toMatchObject({ listable: 5, indexable: 4, legal: 5 });
    expect((await catalog.regionObecStats(19)).get(PRAHA.code)?.industries["kadernictvi-a-kosmetika"]).toMatchObject({ listable: 6, indexable: 0 });
    const idx = (await t.pg.query<{ indexname: string; indexdef: string }>("select indexname, indexdef from pg_indexes where tablename = 'firms'")).rows;
    const def = (n: string) => idx.find((i) => i.indexname === n)?.indexdef ?? "";
    expect(def("firms_listable_city_name")).toMatch(/\(city_code, name\) WHERE \(\(noindex = false\) AND \(dissolved_at IS NULL\)\)/);
    expect(def("firms_legal_address")).toMatch(/\(city_code, street\) WHERE .*is_natural_person = false/);
  });
});
