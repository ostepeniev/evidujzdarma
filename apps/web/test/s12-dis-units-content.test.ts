/**
 * S12 (22. 11. 2026): CSV pro hromadný import evidenčních jednotek do DIS+ (formát GFŘ z 3. 11. 2026), fakta z 22. 11.
 * (pilotní leden podle TZ GFŘ, MOJE eet podle dotazů veřejnosti FS z 18. 11., oprávnění v DIS+), srovnání s MOJE eet,
 * nové koncepty návodů a oprava mazání cookies při odvolání jen jedné kategorie souhlasu.
 */
import { readFileSync } from "node:fs";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COMPARISON_AS_OF, COMPARISON_ROWS } from "@/content/comparison";
import { FACTS, SOURCES, timelineAt } from "@/content/facts";
import { getGuide, isIndexable, isMachineReadable } from "@/content/guides";
import { allowedTags, cookiePrefixesToDelete, makeConsent } from "@/lib/consent";
import { buildDisUnitsCsv, disUnitRow, parseCzAddress, type DisUnitInput } from "@/lib/dis-units-csv";
import { UnitInput } from "@/lib/server/schemas";
import { TRACKING } from "@/lib/tracking-config";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const unit = (over: Partial<DisUnitInput> = {}): DisUnitInput => ({
  label: "Salon",
  type: "stala_provozovna",
  czNace: "9602",
  ruianCode: "21753237",
  address: null,
  locationText: null,
  vehicleType: null,
  vehicleNote: null,
  indirectRepresentation: false,
  ...over,
});
const fields = (u: DisUnitInput) => {
  const r = disUnitRow(u);
  if (!("fields" in r)) throw new Error(r.problems.join(" "));
  return r.fields;
};

describe("S12 – address parser (free text → RÚIAN-like parts)", () => {
  it("street, č. p./č. or., část obce, PSČ with or without a space", () => {
    expect(parseCzAddress("Chebská 38/5, Dvory, 360 06 Karlovy Vary")).toEqual({
      street: "Chebská",
      houseNumber: "38",
      orientationNumber: "5",
      municipality: "Karlovy Vary",
      municipalityPart: "Dvory",
      postalCode: "36006",
    });
    expect(parseCzAddress("Náměstí 5. května 12, 11000 Praha")).toMatchObject({ street: "Náměstí 5. května", houseNumber: "12", postalCode: "11000", municipality: "Praha" });
    expect(parseCzAddress("č. p. 12, 252 26 Kosoř")).toMatchObject({ street: "", houseNumber: "12", municipality: "Kosoř" });
    // obec bez ulic – název obce se jako ulice nepoužije
    expect(parseCzAddress("Kosoř 12, 252 26 Kosoř")).toMatchObject({ street: "", houseNumber: "12" });
  });

  it("other shapes are not guessed", () => {
    for (const a of ["Karlovy Vary", "Masarykova, Karlovy Vary", "Masarykova 12 Karlovy Vary", "", null]) expect(parseCzAddress(a), String(a)).toBeNull();
  });
});

describe("S12 – CSV rows per the GFŘ specification (3. 11. 2026)", () => {
  it("gate: 16 fields in the fixed order; with RÚIAN the address fields 8–13 are empty; flags 1/0", () => {
    const f = fields(unit({ indirectRepresentation: true, locationText: "2. patro" }));
    expect(f).toHaveLength(16);
    expect(f).toEqual(["Salon", "S", "9602", "", "1", "1", "21753237", "", "", "", "", "", "", "2. patro", "", ""]);
  });

  it("gate: without RÚIAN the address is split; S and P need it, otherwise a problem", () => {
    expect(fields(unit({ ruianCode: null, address: "Chebská 38/5, Dvory, 360 06 Karlovy Vary" })).slice(6, 13)).toEqual(["", "Chebská", "38", "5", "Karlovy Vary", "Dvory", "36006"]);
    expect(disUnitRow(unit({ ruianCode: null, address: null }))).toEqual({ problems: [expect.stringMatching(/RÚIAN/)] });
    expect(disUnitRow(unit({ type: "osoba", ruianCode: null, address: "Karlovy Vary" }))).toEqual({ problems: [expect.stringMatching(/nejde rozdělit/)] });
  });

  it("gate: unit types map to S/M/A/I/D/P; M, I, D need the free-text location and never carry an address", () => {
    expect(fields(unit({ type: "mobilni_provozovna", locationText: "Tržiště" }))[1]).toBe("M");
    expect(fields(unit({ type: "internetova_stranka", locationText: "https://eshop.cz" })).slice(1, 14)).toEqual(["I", "9602", "", "1", "0", "", "", "", "", "", "", "", "https://eshop.cz"]);
    expect(fields(unit({ type: "osoba" }))[1]).toBe("P");
    expect(fields(unit({ type: "automat", ruianCode: null, locationText: "Fitness, 1. patro" }))[1]).toBe("A");
    for (const type of ["mobilni_provozovna", "internetova_stranka", "dopravni_prostredek"]) {
      expect(disUnitRow(unit({ type, vehicleType: "A" })), type).toEqual({ problems: expect.arrayContaining([expect.stringMatching(/doplňte/)]) });
    }
  });

  it("gate: vehicles need the vehicle type; „J“ needs a note", () => {
    expect(fields(unit({ type: "dopravni_prostredek", locationText: "1KV 2345", vehicleType: "A" })).slice(13)).toEqual(["1KV 2345", "A", ""]);
    expect(disUnitRow(unit({ type: "dopravni_prostredek", locationText: "1KV 2345" }))).toEqual({ problems: [expect.stringMatching(/druh dopravního/)] });
    expect(disUnitRow(unit({ type: "dopravni_prostredek", locationText: "loď", vehicleType: "J" }))).toEqual({ problems: [expect.stringMatching(/upřesnění/)] });
    expect(fields(unit({ type: "dopravni_prostredek", locationText: "Šlapadlo 7", vehicleType: "J", vehicleNote: "šlapadlo" })).slice(14)).toEqual(["J", "šlapadlo"]);
  });

  it("gate: CZ-NACE is mandatory and digits only; RÚIAN digits only", () => {
    expect(disUnitRow(unit({ czNace: null }))).toEqual({ problems: [expect.stringMatching(/CZ-NACE/)] });
    expect(disUnitRow(unit({ czNace: "96.02" }))).toEqual({ problems: [expect.stringMatching(/CZ-NACE/)] });
    expect(disUnitRow(unit({ ruianCode: "1234567890" }))).toEqual({ problems: [expect.stringMatching(/RÚIAN/)] });
    // formulář tečky a mezery vynechá
    expect(UnitInput.parse({ type: "stala_provozovna", label: "X", czNace: "96.02", ruianCode: " 217 53237 " })).toMatchObject({ czNace: "9602", ruianCode: "21753237" });
    expect(UnitInput.safeParse({ type: "stala_provozovna", label: "X", czNace: "abc" }).success).toBe(false);
    expect(UnitInput.safeParse({ type: "stala_provozovna", label: "X", vehicleType: "X" }).success).toBe(false);
  });

  it("gate: no ; or | in text; typographic characters normalised; characters outside ISO 8859-2 are a problem", () => {
    expect(fields(unit({ label: "Salon; „U Jany“ | 1. patro – vchod…" }))[0]).toBe('Salon, "U Jany" / 1. patro - vchod...');
    expect(disUnitRow(unit({ label: "Salon 💇" }))).toEqual({ problems: [expect.stringMatching(/kódování/)] });
    // čeština a slovenština projdou
    expect(fields(unit({ label: "Kadeřnictví Žluťoučký kůň, Ľubica ôäĺ" }))[0]).toBe("Kadeřnictví Žluťoučký kůň, Ľubica ôäĺ");
  });

  it("gate: file – CRLF lines, no header, at most 500 rows; any problem → no file and a list per unit", () => {
    const ok = buildDisUnitsCsv([unit(), unit({ label: "Druhý", ruianCode: "1" })]);
    expect(ok).toEqual({ ok: true, rows: 2, csv: "Salon;S;9602;;1;0;21753237;;;;;;;;;\r\nDruhý;S;9602;;1;0;1;;;;;;;;;\r\n" });
    expect(buildDisUnitsCsv(Array.from({ length: 501 }, () => unit()))).toMatchObject({ ok: false, error: expect.stringMatching(/500/) });
    const bad = buildDisUnitsCsv([unit(), unit({ label: "Bez NACE", czNace: null })]);
    expect(bad).toMatchObject({ ok: false, units: [{ label: "Bez NACE" }] });
    expect(buildDisUnitsCsv([])).toMatchObject({ ok: false });
  });

  it("gate: the format source is the official GFŘ PDF on eet.gov.cz; helper links to RÚIAN and CZ-NACE", () => {
    expect(SOURCES.fsImportJednotekCsv.url).toBe("https://eet.gov.cz/assets/cs/cmsmedia/import_evidencnich_jednotek-popis_strukt.pdf");
    const fieldsUi = read("src/components/setup/unit-dis-fields.tsx");
    expect(fieldsUi).toContain("SOURCES.ruianAdresniMista.url");
    expect(fieldsUi).toContain("SOURCES.czNace.url");
    expect(read("src/components/setup/setup-app.tsx")).toContain('endpoint="/api/ucet/export/dis-jednotky"');
    expect(read("src/components/cabinet/cabinet-app.tsx")).toContain("/api/kabinet/export/dis-jednotky?klient=");
    expect(read("../../packages/db/migrations/0042_s12_units_dis_csv.sql")).toMatch(/ADD COLUMN "cz_nace" varchar\(6\)[\s\S]*"indirect_representation" boolean DEFAULT false NOT NULL/);
  });
});

describe("S12 – facts of 22. 11. 2026", () => {
  it("gate: January is the pilot month per the GFŘ press release (no enforcement), the obligation stays from 1. 1. 2027", () => {
    expect(FACTS.pilot.summary).toContain("povinnost evidovat ale platí od prvního dne");
    expect(FACTS.pilot.summary).toContain("vymáhat nebude");
    expect(FACTS.pilot.summary).toContain("2. 11. 2026");
    expect(FACTS.pilot.sources[0]).toBe(SOURCES.fsTzPrihlasit);
    expect(timelineAt("2027-01-01").action).toMatch(/vymáhat nebude/);
    expect(timelineAt("2027-01-01").source).toBe(SOURCES.fsDotazPilot);
  });

  it("gate: MOJE eet per the FS answers of 18. 11. 2026; registrations and the 48 h activation with a source", () => {
    for (const s of ["nejvýš 2 evidenční jednotky", "až 4 zaměstnanecké účty", "42 položek", "plátce DPH", "nezveřejnila"]) expect(FACTS.mojeEet.summary).toContain(s);
    expect(FACTS.mojeEet.sources).toContain(SOURCES.fsDotazMojeEet);
    expect(FACTS.registrations.summary).toContain("30 895");
    expect(FACTS.registrations.summary).toContain("velmi hrubý odhad");
    expect(FACTS.registrations.activation).toContain("48 hodin");
    expect(FACTS.disPermissions.summary).toContain("Prohlížení a odesílání všeho");
    expect(FACTS.disPermissions.sources).toContain(SOURCES.fsDotazOpravneni);
  });
});

describe("S12 – /srovnani/moje-eet", () => {
  it("gate: rows carry the official limits, dated; our differences (offline, units, export, API, cabinet)", () => {
    expect(COMPARISON_AS_OF).toBe("22. 11. 2026");
    const row = (f: string) => COMPARISON_ROWS.find((r) => r.feature === f)!;
    expect(row("Evidenční jednotky").state).toBe("Nejvýš 2");
    expect(row("Uživatelé").state).toBe("Až 4 zaměstnanecké účty");
    expect(row("Katalog zboží a služeb").state).toBe("Nejvýš 42 položek");
    expect(row("Export pro účetní").state).toMatch(/PDF/);
    expect(row("Účetní kabinet").ours).toMatch(/import jednotek do DIS\+/);
    expect(row("Napojení e-shopu, rezervací, hotelového systému (API)").ours).toMatch(/EET API/);
  });

  it("gate: title and description target „MOJE eet“; FAQ JSON-LD; fair section kept", async () => {
    const mod = await import("@/app/(site)/srovnani/moje-eet/page");
    const title = String(mod.metadata.title);
    expect(title.startsWith("MOJE eet")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
    const desc = String(mod.metadata.description);
    expect(desc).toContain("MOJE eet");
    expect(desc.length).toBeGreaterThanOrEqual(120);
    expect(desc.length).toBeLessThanOrEqual(170);
    const html = renderToStaticMarkup(createElement(mod.default as FC));
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain("Hodí se MOJE eet pro plátce DPH?");
    expect(html).toContain("MOJE eet je dobrá volba, když");
    expect(html).toContain("Stav k 22. 11. 2026");
  });
});

describe("S12 – new draft guides", () => {
  it("gate: three drafts (noindex, not machine readable) with official sources", () => {
    for (const [slug, src] of [
      ["nezobrazuje-se-aktivovat-eet", SOURCES.fsDotazOpravneni],
      ["poukazy-a-vouchery-eet", SOURCES.fsDotazPoukazy],
      ["doplnkovy-prodej-eet", SOURCES.kdoMusi],
    ] as const) {
      const g = getGuide(slug)!;
      expect(g, slug).toBeTruthy();
      expect(g.reviewedBy, slug).toBeNull();
      expect(isIndexable(g), slug).toBe(false);
      expect(isMachineReadable(g), slug).toBe(false);
      expect(g.sources, slug).toContain(src);
      expect(g.changelog?.[0], slug).toEqual({ date: "2026-11-22", text: "Nový návod – čeká na odbornou revizi." });
    }
    const aktivace = JSON.stringify(getGuide("nezobrazuje-se-aktivovat-eet"));
    for (const s of ["Prohlížení a odesílání všeho", "48 hodin", "/nastaveni-na-klic", "Pro účetní", "/ucetni#import-jednotek"]) expect(aktivace).toContain(s);
  });

  it("gate: spropitné cites the FS Q&A of 19. 10. 2026 and stays an official-basis guide", () => {
    const g = getGuide("spropitne-a-eet")!;
    expect(g.basis).toBe("official");
    expect(g.sources).toContain(SOURCES.fsDotazSpropitne);
    expect(g.changelog?.[0]?.date).toBe("2026-11-22");
  });

  it("gate: /ucetni links the permissions guide and explains the CSV import", async () => {
    const { default: Page } = await import("@/app/(site)/ucetni/page");
    const html = renderToStaticMarkup(createElement(Page as FC));
    expect(html).toContain('id="import-jednotek"');
    expect(html).toContain('href="/navody/nezobrazuje-se-aktivovat-eet"');
    expect(html).toContain("Stáhnout CSV pro import do DIS+");
  });
});

describe("S12 – consent: analytics-only keeps Clarity and GA4; revoking one category deletes only its cookies", () => {
  it("gate: analytics-only consent loads GA4 (gtag) and Clarity, not Meta", () => {
    expect(allowedTags(makeConsent(true, false), TRACKING)).toEqual(["gtag", "clarity"]);
    expect(allowedTags(makeConsent(false, true), TRACKING)).toEqual(["meta"]);
  });

  it("gate: revoking marketing keeps _ga and Clarity cookies; revoking analytics keeps _fbp", () => {
    const all = { analytics: true, marketing: true };
    expect(cookiePrefixesToDelete(all, { analytics: true, marketing: false })).toEqual(["_gcl_", "_fbp", "_fbc"]);
    expect(cookiePrefixesToDelete(all, { analytics: false, marketing: true })).toEqual(["_ga", "_gid", "_gat", "_clck", "_clsk"]);
    expect(cookiePrefixesToDelete(null, { analytics: false, marketing: false })).toEqual([]);
    expect(read("src/components/consent/consent-manager.tsx")).toContain("deleteThirdPartyCookies(cookiePrefixesToDelete(prev, c))");
  });
});
