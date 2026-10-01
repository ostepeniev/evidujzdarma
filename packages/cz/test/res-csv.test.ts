import { describe, expect, it } from "vitest";
import {
  CsvParser,
  classifyTrades,
  csvRecords,
  csvRows,
  mapResPfNaceRow,
  mapResRow,
  missingResColumns,
  normalizeNaceCode,
  parseCsv,
  parseResDate,
  regionCodeFromOkresLau,
} from "../src/res-csv.ts";

/** Malý vzorek ve formátu res_data.csv (vymyšlené subjekty, IČO s platnou kontrolní číslicí). */
const HEADER =
  "ICO,OKRESLAU,DDATVZN,DDATZAN,ZPZAN,DDATPAKT,FORMA,ROSFORMA,KATPO,NACE,NACE2025,ICZUJ,FIRMA,CISS2010,KODADM,TEXTADR,PSC,OBEC_TEXT,COBCE_TEXT,ULICE_TEXT,TYPCDOM,CDOM,COR,DATPLAT,PRIZNAK";
const FIXTURE = [
  "﻿" + HEADER,
  // s.r.o. v Karlových Varech, název s čárkou a uvozovkami
  '"11111119","CZ0412","2008-06-10","","","2026-08-02","112","112","110","55101","55100","554961","Testovací ""Penzion"", s.r.o.","11002","12345678","","36001","Karlovy Vary","Karlovy Vary","Zahradní","1","12","3a","2026-09-15",""',
  // OSVČ — ulice se nesmí uložit
  '"12345679","CZ0411","2015-03-01","","","2026-09-20","101","101","000","96021","96021","554481","Jana Testovací","14100","87654321","","35002","Cheb","Cheb","Pražská","1","5","","2026-09-15","Z"',
  // zaniklá fyzická osoba (RES uvádí jen IČO a datum zániku)
  '"22222227","","","2020-01-31","","","","","","","","","","","","","","","","","","","","2026-09-15",""',
  // neplatné IČO
  '"12345678","CZ0100","2001-01-01","","","2026-01-01","112","112","","62010","","500054","Neplatná s.r.o.","","","","11000","Praha","Staré Město","Dlouhá","1","1","","2026-09-15",""',
  // bez ulice, číslo evidenční, pseudokód NACE 00
  '"27074358","CZ0413","1999-12-31","","","2026-05-05","121","121","","00","","560286","Obec a.s.","","","","35601","Sokolov","Hrušková","","2","44","","2026-09-15","P"',
].join("\r\n");

describe("CSV parser", () => {
  it("parses quoted fields, escaped quotes, CRLF and BOM", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""",\r\n"multi\nline",2,3\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', ""],
      ["multi\nline", "2", "3"],
    ]);
  });

  it("handles LF, CR, missing trailing newline and blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\r3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(parseCsv('""\n')).toEqual([[""]]);
    expect(parseCsv("a;b\n1;2", { delimiter: ";" })).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("treats a quote inside an unquoted field literally", () => {
    expect(parseCsv('ab"c,d')).toEqual([['ab"c', "d"]]);
  });

  it("gives identical results for any chunking", () => {
    const whole = parseCsv(FIXTURE);
    for (let size = 1; size <= 7; size++) {
      const p = new CsvParser();
      const out: string[][] = [];
      for (let i = 0; i < FIXTURE.length; i += size) p.push(FIXTURE.slice(i, i + size), out);
      p.end(out);
      expect(out).toEqual(whole);
    }
    expect(whole).toHaveLength(6);
    expect(whole[1]![12]).toBe('Testovací "Penzion", s.r.o.');
  });

  it("streams bytes split inside multi-byte UTF-8 characters", async () => {
    const bytes = new TextEncoder().encode(FIXTURE);
    async function* chunks() {
      for (let i = 0; i < bytes.length; i += 3) yield bytes.subarray(i, i + 3);
    }
    const rows: string[][] = [];
    for await (const r of csvRows(chunks())) rows.push(r);
    expect(rows).toEqual(parseCsv(FIXTURE));
  });
});

describe("RES mapping", () => {
  async function records() {
    async function* src() {
      yield FIXTURE;
    }
    let header: string[] = [];
    const out: Record<string, string>[] = [];
    for await (const r of csvRecords(src(), { onHeader: (h) => (header = h) })) out.push(r);
    return { header, out };
  }

  it("reads the header without BOM and checks required columns", async () => {
    const { header } = await records();
    expect(header[0]).toBe("ICO");
    expect(missingResColumns(header)).toEqual([]);
    expect(missingResColumns(["ICO", "FIRMA"])).toContain("DDATVZN");
  });

  it("maps a legal person with full address", async () => {
    const { out } = await records();
    const f = mapResRow(out[0]!)!;
    expect(f).toMatchObject({
      ico: "11111119",
      name: 'Testovací "Penzion", s.r.o.',
      slug: "testovaci-penzion-s-r-o",
      legalForm: "112",
      isNaturalPerson: false,
      foundedAt: "2008-06-10",
      dissolvedAt: null,
      street: "Zahradní 12/3a",
      city: "Karlovy Vary",
      cityCode: 554961,
      postalCode: "36001",
      regionCode: 51,
      nace: ["55101"],
      eetRelevance: "likely",
      snapshotDate: "2026-09-15",
    });
  });

  it("never keeps the street of a natural person", async () => {
    const { out } = await records();
    const f = mapResRow(out[1]!)!;
    expect(f.isNaturalPerson).toBe(true);
    expect(f.street).toBeNull();
    expect(f.city).toBe("Cheb");
    expect(f.regionCode).toBe(51);
    expect(f.changeFlag).toBe("Z");
    expect(mapResRow(out[1]!, { keepNaturalPersonStreet: true })!.street).toBe("Pražská 5");
  });

  it("returns dissolved subjects with dissolvedAt and empty name", async () => {
    const { out } = await records();
    const f = mapResRow(out[2]!)!;
    expect(f.dissolvedAt).toBe("2020-01-31");
    expect(f.name).toBe("");
    expect(f.regionCode).toBeNull();
  });

  it("rejects invalid IČO", async () => {
    const { out } = await records();
    expect(mapResRow(out[3]!)).toBeNull();
  });

  it("builds street from city part and evidence number, drops NACE 00", async () => {
    const { out } = await records();
    const f = mapResRow(out[4]!)!;
    expect(f.street).toBe("Hrušková č. ev. 44");
    expect(f.nace).toEqual([]);
    expect(f.eetRelevance).toBe("possible");
    expect(f.regionCode).toBe(51);
  });

  it("parses dates and codes defensively", () => {
    expect(parseResDate("2026-09-15")).toBe("2026-09-15");
    expect(parseResDate("1.2.2003")).toBe("2003-02-01");
    expect(parseResDate("20030201")).toBe("2003-02-01");
    expect(parseResDate("garbage")).toBeNull();
    expect(parseResDate("")).toBeNull();
    expect(normalizeNaceCode("47.11")).toBe("4711");
    expect(normalizeNaceCode("G")).toBeNull();
    expect(regionCodeFromOkresLau("CZ0100")).toBe(19);
    expect(regionCodeFromOkresLau("cz0642")).toBe(116);
    expect(regionCodeFromOkresLau("3403")).toBeNull();
  });

  it("maps res_pf_nace rows for CZ-NACE only", () => {
    expect(mapResPfNaceRow({ ICO: "11111119", ZDRUD: "411", KODCIS: "80004", HODN: "56101" })).toEqual({ ico: "11111119", nace: "56101" });
    expect(mapResPfNaceRow({ ICO: "11111119", ZDRUD: "411", KODCIS: "80143", HODN: "56101" })).toBeNull();
    expect(mapResPfNaceRow({ ICO: "11111119", ZDRUD: "", KODCIS: "", HODN: "" })).toBeNull();
  });
});

describe("trades heuristic", () => {
  it("classifies RŽP trade names", () => {
    expect(classifyTrades(["Hostinská činnost"])).toBe("likely");
    expect(classifyTrades(["Holičství, kadeřnictví"])).toBe("likely");
    expect(classifyTrades(["Truhlářství, podlahářství"])).toBe("possible");
    expect(classifyTrades(["Vedení účetnictví"])).toBe("unlikely");
    expect(classifyTrades(["Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona"])).toBeNull();
    expect(classifyTrades(["Vedení účetnictví", "Pedikúra, manikúra"])).toBe("likely");
  });
});
