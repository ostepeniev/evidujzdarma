import { describe, expect, it } from "vitest";
import { isValidIco, normalizeIco, parseIcoList } from "../src/ico.ts";
import { czAccountToIban, isValidIban, parseCzAccount, toIban } from "../src/bank.ts";
import { buildSpayd, SpaydError } from "../src/spayd.ts";
import { slugify } from "../src/slug.ts";
import { classifyNace, classifyNaceList } from "../src/nace.ts";
import { mapRzp, mapSubject } from "../src/ares.ts";
import { isNaturalPerson, legalFormShort } from "../src/legal-form.ts";

describe("IČO", () => {
  it("validates checksum", () => {
    expect(isValidIco("27074358")).toBe(true);
    expect(isValidIco("00006947")).toBe(true);
    expect(isValidIco("6947")).toBe(true);
    expect(isValidIco("27074359")).toBe(false);
    expect(isValidIco("00000000")).toBe(false);
    expect(isValidIco("abc")).toBe(false);
    expect(isValidIco("123456789")).toBe(false);
  });
  it("normalizes", () => {
    expect(normalizeIco(" 6947 ")).toBe("00006947");
    expect(normalizeIco("270 74 358")).toBe("27074358");
  });
  it("parses lists", () => {
    const r = parseIcoList("27074358, 00006947\n27074358;123\n");
    expect(r.valid).toEqual(["27074358", "00006947"]);
    expect(r.invalid).toEqual(["123"]);
  });
});

describe("bank accounts", () => {
  it("converts CZ account to IBAN", () => {
    const acc = parseCzAccount("19-2000145399/0800");
    expect(acc).not.toBeNull();
    expect(czAccountToIban(acc!)).toBe("CZ6508000000192000145399");
    expect(toIban("19-2000145399/0800")).toBe("CZ6508000000192000145399");
  });
  it("rejects bad checksum", () => {
    expect(parseCzAccount("19-2000145398/0800")).toBeNull();
  });
  it("validates IBAN", () => {
    expect(isValidIban("CZ65 0800 0000 1920 0014 5399")).toBe(true);
    expect(isValidIban("CZ6608000000192000145399")).toBe(false);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });
});

describe("SPAYD", () => {
  it("builds the reference example", () => {
    const s = buildSpayd({
      account: "CZ5855000000001265098001",
      amount: 480.5,
      message: "Platba za zboží",
      variableSymbol: "1234567890",
    });
    expect(s).toBe("SPD*1.0*ACC:CZ5855000000001265098001*AM:480.50*CC:CZK*MSG:Platba za zbozi*X-VS:1234567890");
  });
  it("escapes asterisks and truncates message", () => {
    const s = buildSpayd({ account: "1265098001/5500", message: "a*b".padEnd(80, "x") });
    expect(s).toContain("MSG:a%2Ab");
    expect(s.split("MSG:")[1]!.length).toBe(60);
  });
  it("rejects invalid input", () => {
    expect(() => buildSpayd({ account: "124/0100" })).toThrow(SpaydError);
    expect(() => buildSpayd({ account: "1265098001/5500", variableSymbol: "12345678901" })).toThrow(SpaydError);
    expect(() => buildSpayd({ account: "1265098001/5500", amount: -1 })).toThrow(SpaydError);
  });
});

describe("slugify", () => {
  it("strips diacritics", () => {
    expect(slugify("Kadeřnictví Šárka s.r.o.")).toBe("kadernictvi-sarka-s-r-o");
    expect(slugify("Ať žije & roste!")).toBe("at-zije-a-roste");
  });
});

describe("CZ-NACE relevance", () => {
  it("prefers longest prefix", () => {
    expect(classifyNace("96020")?.label).toBe("Kadeřnictví a kosmetika");
    expect(classifyNace("494")?.relevance).toBe("unlikely");
    expect(classifyNace("4932")?.relevance).toBe("likely");
  });
  it("aggregates", () => {
    expect(classifyNaceList(["620", "47"]).relevance).toBe("likely");
    expect(classifyNaceList(["620"]).relevance).toBe("unlikely");
    expect(classifyNaceList([]).relevance).toBe("possible");
  });
});

describe("legal form", () => {
  it("detects OSVČ", () => {
    expect(isNaturalPerson("101")).toBe(true);
    expect(isNaturalPerson("112")).toBe(false);
    expect(legalFormShort("112")).toBe("s.r.o.");
  });
});

describe("ARES mapping", () => {
  it("maps subject defensively", () => {
    const s = mapSubject({
      ico: "27074358",
      obchodniJmeno: "Test a.s.",
      pravniForma: "121",
      dic: "CZ27074358",
      datumVzniku: "2003-08-06",
      sidlo: {
        nazevObce: "Praha",
        kodKraje: 19,
        nazevUlice: "Budějovická",
        cisloDomovni: 778,
        cisloOrientacni: 3,
        cisloOrientacniPismeno: "a",
        psc: 14000,
        textovaAdresa: "Budějovická 778/3a, 14000 Praha 4",
      },
      czNace: ["620", "6201"],
      seznamRegistraci: { stavZdrojeDph: "AKTIVNI", stavZdrojeRzp: "AKTIVNI" },
    });
    expect(s.name).toBe("Test a.s.");
    expect(s.address.street).toBe("Budějovická 778/3a");
    expect(s.address.postalCode).toBe("14000");
    expect(s.vatPayer).toBe(true);
    expect(s.registrations.rzp).toBe("AKTIVNI");
    expect(mapSubject(null).ico).toBe("");
  });
  it("collects establishments from nested RŽP data", () => {
    const r = mapRzp({
      zaznamy: [
        {
          primarniZaznam: true,
          zivnosti: [
            {
              predmetPodnikani: "Hostinská činnost",
              druhZivnosti: "R",
              provozovny: [
                {
                  identifikacniCisloProvozovny: "1012345678",
                  sidloProvozovny: { nazevObce: "Karlovy Vary", kodKraje: 51 },
                },
              ],
            },
            {
              predmetPodnikani: "Výroba, obchod a služby",
              provozovny: [{ identifikacniCisloProvozovny: "1012345678" }],
            },
          ],
        },
      ],
    });
    expect(r.trades).toHaveLength(2);
    expect(r.establishments).toHaveLength(1);
    expect(r.establishments[0]!.trades).toEqual(["Hostinská činnost", "Výroba, obchod a služby"]);
    expect(r.establishments[0]!.address.city).toBe("Karlovy Vary");
  });
});
