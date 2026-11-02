/**
 * S11 – export do POHODY (XML, beta): denní souhrny po evidenčních jednotkách, hotovost → pokladní doklad (vch:voucher,
 * receipt), ostatní platby → interní doklad (int:intDoc), rozpad DPH 21 % = High, 12 % = Low, spropitné = None,
 * vratky záporně, smíšené platby poměrem. Snímek známého dne ověřený proti XSD Stormware (data.xsd, verze 2.0,
 * xmllint – 3. 11. 2026); test hlídá, že se tvar nezmění.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pohodaAmount, pohodaDayDocs, pohodaXml, splitSale, type PohodaSale } from "@/lib/pohoda-xml";

const d = (s: string) => new Date(s);
const SALON = { unitKey: "u1", unitLabel: "Kadeřnictví Na Rohu" };

/** Známý den 2. 11. 2026: prodej hotově, smíšená platba 21 % + 12 %, vratka hotově, QR se spropitným ve 23:30 (ještě týž den v Praze). */
const DAY: PohodaSale[] = [
  { soldAt: d("2026-11-02T08:15:00+01:00"), ...SALON, total: 12100, payments: [{ method: "cash", amount: 12100 }], vatBreakdown: { "21": { base: 10000, vat: 2100 } } },
  {
    soldAt: d("2026-11-02T09:00:00+01:00"),
    ...SALON,
    total: 23300,
    payments: [
      { method: "cash", amount: 10000 },
      { method: "card", amount: 13300 },
    ],
    vatBreakdown: { "21": { base: 10000, vat: 2100 }, "12": { base: 10000, vat: 1200 } },
  },
  { soldAt: d("2026-11-02T10:00:00+01:00"), ...SALON, total: -12100, payments: [{ method: "cash", amount: -12100 }], vatBreakdown: { "21": { base: -10000, vat: -2100 } } },
  { soldAt: d("2026-11-02T23:30:00+01:00"), ...SALON, total: 5500, payments: [{ method: "qr", amount: 5500 }], vatBreakdown: { "21": { base: 4132, vat: 868 } } },
];

const SNAPSHOT = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<dat:dataPack version="2.0" id="ez-12345679-2026-11-02" ico="12345679" application="EvidujZdarma" note="Tržby z EvidujZdarma (souhrn po dnech)" xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd" xmlns:vch="http://www.stormware.cz/schema/version_2/voucher.xsd" xmlns:int="http://www.stormware.cz/schema/version_2/intDoc.xsd" xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">`,
  `<dat:dataPackItem version="2.0" id="EZ20261102-001"><vch:voucher version="2.0"><vch:voucherHeader><vch:voucherType>receipt</vch:voucherType><vch:cashAccount><typ:ids>HP</typ:ids></vch:cashAccount><vch:date>2026-11-02</vch:date><vch:datePayment>2026-11-02</vch:datePayment><vch:dateTax>2026-11-02</vch:dateTax><vch:classificationVAT><typ:classificationVATType>inland</typ:classificationVATType></vch:classificationVAT><vch:text>Tržby hotově 2. 11. 2026 – Kadeřnictví Na Rohu</vch:text><vch:note>EvidujZdarma: 3 tržby (souhrn dne, vratky záporně).</vch:note></vch:voucherHeader><vch:voucherSummary><vch:homeCurrency><typ:priceLow>42.92</typ:priceLow><typ:priceLowVAT>5.15</typ:priceLowVAT><typ:priceHigh>42.92</typ:priceHigh><typ:priceHighVAT>9.01</typ:priceHighVAT></vch:homeCurrency></vch:voucherSummary></vch:voucher></dat:dataPackItem>`,
  `<dat:dataPackItem version="2.0" id="EZ20261102-002"><int:intDoc version="2.0"><int:intDocHeader><int:date>2026-11-02</int:date><int:dateTax>2026-11-02</int:dateTax><int:dateAccounting>2026-11-02</int:dateAccounting><int:classificationVAT><typ:classificationVATType>inland</typ:classificationVATType></int:classificationVAT><int:text>Tržby bezhotovostně (karta, QR, převod, poukazy) 2. 11. 2026 – Kadeřnictví Na Rohu</int:text><int:note>EvidujZdarma: 2 tržby (souhrn dne, vratky záporně).</int:note></int:intDocHeader><int:intDocSummary><int:homeCurrency><typ:priceNone>5.00</typ:priceNone><typ:priceLow>57.08</typ:priceLow><typ:priceLowVAT>6.85</typ:priceLowVAT><typ:priceHigh>98.40</typ:priceHigh><typ:priceHighVAT>20.67</typ:priceHighVAT></int:homeCurrency></int:intDocSummary></int:intDoc></dat:dataPackItem>`,
  `</dat:dataPack>`,
  ``,
].join("\n");

const sum = (a: ReturnType<typeof pohodaDayDocs>[number]["amounts"]) => a.high.base + a.high.vat + a.low.base + a.low.vat + a.third.base + a.third.vat + a.none;

describe("S11 – Pohoda XML (beta)", () => {
  it("gate: snapshot of a known day (validated against the Stormware XSD v2.0)", () => {
    expect(pohodaXml(DAY, { ico: "12345679" })).toBe(SNAPSHOT);
  });

  it("gate: one cash receipt and one internal document per day and unit; totals equal the payments to the haléř", () => {
    const docs = pohodaDayDocs(DAY);
    expect(docs.map((x) => [x.date, x.group, x.total, x.count])).toEqual([
      ["2026-11-02", "cash", 10000, 3],
      ["2026-11-02", "cashless", 18800, 2],
    ]);
    for (const x of docs) expect(sum(x.amounts)).toBe(x.total);
  });

  it("gate: a refund lowers the day (negative), a day with only a refund gives negative amounts", () => {
    const xml = pohodaXml([DAY[2]!], { ico: "12345679" });
    expect(xml).toContain("<typ:priceHigh>-100.00</typ:priceHigh><typ:priceHighVAT>-21.00</typ:priceHighVAT>");
    expect(xml).toContain("<vch:voucherType>receipt</vch:voucherType>");
  });

  it("gate: a mixed payment is split by payment share; each part sums exactly", () => {
    const parts = splitSale({ ...DAY[1]!, payments: [{ method: "cash", amount: 7777 }, { method: "card", amount: 15523 }] });
    const cash = parts.cash!;
    const rest = parts.cashless!;
    expect(cash.high.base + cash.high.vat + cash.low.base + cash.low.vat + cash.none).toBe(7777);
    expect(rest.high.base + rest.high.vat + rest.low.base + rest.low.vat + rest.none).toBe(15523);
    expect(cash.high.vat + rest.high.vat).toBe(2100);
    expect(cash.low.base + rest.low.base).toBe(10000);
  });

  it("gate: days and units are separate documents; the Prague day decides (23:30 CET is the same day, 00:30 the next)", () => {
    const docs = pohodaDayDocs([
      { ...DAY[0]!, soldAt: d("2026-11-02T22:59:00Z") },
      { ...DAY[0]!, soldAt: d("2026-11-02T23:30:00Z") },
      { ...DAY[0]!, unitKey: "u2", unitLabel: "Stánek" },
    ]);
    expect(docs.map((x) => `${x.date} ${x.unitLabel}`)).toEqual(["2026-11-02 Kadeřnictví Na Rohu", "2026-11-02 Stánek", "2026-11-03 Kadeřnictví Na Rohu"]);
  });

  it("gate: a non-VAT payer gets everything in priceNone with nonSubsume and no dateTax", () => {
    const xml = pohodaXml(
      DAY.map((s) => ({ ...s, vatBreakdown: null })),
      { ico: "12345679", cashAccount: "P1" },
    );
    expect(xml).toContain("<vch:cashAccount><typ:ids>P1</typ:ids></vch:cashAccount>");
    expect(xml).toContain("<typ:classificationVATType>nonSubsume</typ:classificationVATType>");
    expect(xml).not.toContain("dateTax");
    expect(xml).not.toMatch(/priceHigh|priceLow/);
    expect(xml).toContain("<typ:priceNone>100.00</typ:priceNone>");
    expect(xml).toContain("<typ:priceNone>188.00</typ:priceNone>");
  });

  it("gate: other non-zero VAT rates go to price3, 0 % to priceNone; text is XML-escaped", () => {
    const xml = pohodaXml(
      [{ soldAt: d("2026-11-02T12:00:00+01:00"), unitKey: "x", unitLabel: "A & B <stánek>", total: 2150, payments: [{ method: "cash", amount: 2150 }], vatBreakdown: { "15": { base: 1000, vat: 150 }, "0": { base: 1000, vat: 0 } } }],
      { ico: "12345679" },
    );
    expect(xml).toContain("<typ:priceNone>10.00</typ:priceNone><typ:price3>10.00</typ:price3><typ:price3VAT>1.50</typ:price3VAT>");
    expect(xml).toContain("A &amp; B &lt;stánek&gt;");
  });

  it("amount format: dot, two decimals, minus sign", () => {
    expect([pohodaAmount(0), pohodaAmount(5), pohodaAmount(123456), pohodaAmount(-2100)]).toEqual(["0.00", "0.05", "1234.56", "-21.00"]);
  });

  it("gate: UI labels 'Pohoda XML (beta)'; 'připravujeme' stays only for Money S3 / ABRA", () => {
    const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
    for (const f of ["components/cabinet/cabinet-app.tsx", "components/setup/setup-app.tsx"]) {
      expect(src(f), f).toContain("Pohoda XML (beta)");
      // v jedné větě s Pohodou už „připravujeme“ není; Money S3 a ABRA ano
      expect(src(f), f).not.toMatch(/Pohod[^.;]*připravujeme/i);
      expect(src(f), f).toMatch(/Money[^.]*připravujeme/);
    }
    expect(src("components/cabinet/cabinet-app.tsx")).toContain("/api/kabinet/export/pohoda?klient=");
    expect(src("components/setup/setup-app.tsx")).toContain("/api/ucet/export/pohoda?od=");
  });
});

describe("S11 – Pohoda XML: empty period", () => {
  it("gate: no documents → error (an empty dat:dataPack is not valid against data.xsd)", () => {
    expect(() => pohodaXml([], { ico: "12345679" })).toThrow(RangeError);
    expect(pohodaDayDocs([{ ...DAY[0]!, total: 0, payments: [], vatBreakdown: null }])).toEqual([]);
  });
});
