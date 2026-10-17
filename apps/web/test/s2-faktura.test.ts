/**
 * S2 proud C (17. 10. 2026): Faktura zdarma (/faktura-zdarma) – generátor faktur bez registrace. Výpočty (DPH podle sazeb,
 * zaokrouhlení na haléře), QR Platba (SPAYD), fragment #odberatel=IČO (nikdy query), náležitosti podle § 435 OZ a § 29–30a
 * ZDPH, FAQ se zdroji a registrace nástroje (sitemap, /nastroje, patička, llms.txt). Nic se neukládá.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FACTS, SOURCES } from "@/content/facts";
import {
  type Invoice,
  type InvoiceItem,
  addDaysIso,
  dueDateOf,
  fakturaLink,
  invoiceNotices,
  invoiceSpayd,
  invoiceTitle,
  invoiceTotals,
  isSimplified,
  itemBase,
  missingInvoiceFields,
  parseFakturaFragment,
  variableSymbolFrom,
} from "@/lib/faktura";
import { absoluteUrl } from "@/lib/site";
import { STATIC_PAGES } from "@/lib/static-pages";
import { pageText } from "./helpers/render-text";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const item = (name: string, qty: string, price: string, rate: 21 | 12 = 21, unit = "ks"): InvoiceItem => ({ name, qty, unit, price, rate });

/** IČO s platnou kontrolní číslicí, které v ukázkách nepatří skutečné firmě, nezáleží na tom – testuje se jen formát. */
const ICO = "12345679";

const base = (over: Partial<Invoice> = {}): Invoice => ({
  kind: "faktura",
  vatPayer: false,
  number: "2026015",
  issueDate: "2026-10-17",
  taxDate: "2026-10-17",
  dueDays: "14",
  payment: "prevodem",
  account: "19-2000145399/0800",
  vs: "",
  supplier: { name: "Jana Nováková", ico: ICO, dic: "", address: "Hlavní 1, 360 01 Karlovy Vary", registry: "Fyzická osoba zapsaná v živnostenském rejstříku." },
  customer: { name: "Odběratel s.r.o.", ico: "", dic: "", address: "Dlouhá 2, 110 00 Praha" },
  items: [item("Konzultace", "2", "1 500")],
  note: "",
  ...over,
});

describe("S2 faktura – totals and VAT", () => {
  it("gate: lines = qty × unit price on haléře; empty qty = 1; qty 0 or bad price = invalid", () => {
    expect(itemBase(item("Materiál", "3", "33,33"))).toBe(99.99);
    expect(itemBase(item("Práce", "", "450"))).toBe(450);
    expect(itemBase(item("Sleva", "1", "-100"))).toBe(-100);
    expect(itemBase(item("X", "0", "450"))).toBeNull();
    expect(itemBase(item("X", "1", "abc"))).toBeNull();
  });

  it("gate: VAT payer – base per rate, VAT = base × rate rounded to haléře (§ 37 písm. a)), total = base + VAT", () => {
    const t = invoiceTotals([item("Práce", "2", "450"), item("Materiál", "3", "33,33"), item("Kniha", "1", "199,90", 12), item("", "1", "")], true);
    expect(t.recap).toEqual([
      { rate: 21, base: 999.99, vat: 210, total: 1209.99 },
      { rate: 12, base: 199.9, vat: 23.99, total: 223.89 },
    ]);
    expect(t.base).toBe(1199.89);
    expect(t.vat).toBe(233.99);
    expect(t.total).toBe(1433.88);
  });

  it("gate: VAT is rounded once per rate, not per line (3 × 0,50 at 21 % = 0,32, not 3 × 0,11)", () => {
    const t = invoiceTotals([item("A", "1", "0,5"), item("B", "1", "0,5"), item("C", "1", "0,5")], true);
    expect(t.recap).toEqual([{ rate: 21, base: 1.5, vat: 0.32, total: 1.82 }]);
    expect(invoiceTotals([item("A", "1", "2,5")], true).vat).toBe(0.53);
    expect(invoiceTotals([item("A", "1", "0,5")], true).vat).toBe(0.11);
  });

  it("gate: non-payer – no VAT, no recap, total = sum of lines; rates without items are left out", () => {
    expect(invoiceTotals([item("A", "2", "0,1"), item("B", "1", "0,2", 12)], false)).toEqual({ recap: [], base: 0.4, vat: 0, total: 0.4 });
    expect(invoiceTotals([item("A", "1", "100", 12)], true).recap.map((r) => r.rate)).toEqual([12]);
  });
});

describe("S2 faktura – QR Platba, VS and dates", () => {
  it("gate: SPAYD for an example invoice (IBAN, amount, due date, message, recipient, VS from the number)", () => {
    const inv = base({ vatPayer: true, supplier: { ...base().supplier, dic: "CZ12345679" }, items: [item("Konzultace", "1", "1 000")] });
    const totals = invoiceTotals(inv.items, true);
    expect(totals.total).toBe(1210);
    const r = invoiceSpayd({ account: inv.account, amount: totals.total, vs: variableSymbolFrom(inv.number), dueDate: dueDateOf(inv), number: inv.number, kind: inv.kind, recipient: inv.supplier.name });
    expect(r.spayd).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:1210.00*CC:CZK*DT:20261031*MSG:Faktura 2026015*RN:Jana Novakova*X-VS:2026015");
    expect(r.iban).toBe("CZ6508000000192000145399");
    const z = invoiceSpayd({ account: inv.account, amount: 500, vs: "", dueDate: "", number: "Z-7", kind: "zalohova", recipient: "" });
    expect(z.spayd).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:500.00*CC:CZK*MSG:Zalohova faktura Z-7");
    expect(invoiceSpayd({ account: "124/0100", amount: 100, vs: "", dueDate: "", number: "", kind: "faktura", recipient: "" }).error).toBe("Neplatné číslo účtu nebo IBAN.");
    expect(invoiceSpayd({ account: inv.account, amount: 0, vs: "", dueDate: "", number: "", kind: "faktura", recipient: "" }).error).toMatch(/větší než nula/);
  });

  it("gate: VS = digits of the invoice number, at most 10 (the last ten)", () => {
    expect(variableSymbolFrom("FV-2026/015")).toBe("2026015");
    expect(variableSymbolFrom("2026-12345678901")).toBe("2345678901");
    expect(variableSymbolFrom("ABC")).toBe("");
  });

  it("gate: due date = issue date + days, across months, years and DST; bad days → empty", () => {
    expect(addDaysIso("2026-10-17", 14)).toBe("2026-10-31");
    expect(addDaysIso("2026-12-25", 14)).toBe("2027-01-08");
    expect(addDaysIso("2027-03-20", 14)).toBe("2027-04-03");
    expect(dueDateOf({ issueDate: "2026-10-17", dueDays: "0" })).toBe("2026-10-17");
    expect(dueDateOf({ issueDate: "2026-10-17", dueDays: "abc" })).toBe("");
    expect(dueDateOf({ issueDate: "2026-10-17", dueDays: "400" })).toBe("");
  });
});

describe("S2 faktura – #odberatel fragment (never ?ico=)", () => {
  it("gate: fakturaLink puts the IČO into the fragment and parseFakturaFragment reads it back", () => {
    expect(fakturaLink(ICO)).toBe(`/faktura-zdarma#odberatel=${ICO}`);
    expect(parseFakturaFragment(new URL(fakturaLink(ICO), "https://evidujzdarma.cz").hash)).toEqual({ odberatel: ICO });
    expect(parseFakturaFragment(`#x=1&odberatel=${ICO}`).odberatel).toBe(ICO);
    expect(parseFakturaFragment(`odberatel=${ICO}`).odberatel).toBe(ICO);
  });

  it("gate: only 8 digits with a valid check digit; anything else is ignored", () => {
    for (const h of ["", "#", "#odberatel=", "#odberatel=12345678", "#odberatel=1234567", "#odberatel=123456790", "#odberatel=abc", "#ico=12345679"]) {
      expect(parseFakturaFragment(h).odberatel, h).toBeNull();
    }
  });

  it("gate: the generator reads location.hash in an effect and stores nothing (no storage, no cookies, no ?ico=)", () => {
    const ui = src("components/invoice-generator.tsx");
    expect(ui).toContain("parseFakturaFragment(window.location.hash)");
    expect(ui).toContain('addEventListener("hashchange"');
    for (const s of [ui, src("components/invoice-paper.tsx"), src("lib/faktura.ts"), src("app/(site)/faktura-zdarma/page.tsx")]) {
      expect(s).not.toMatch(/localStorage|sessionStorage|document\.cookie|\?ico=/);
    }
    expect(ui).toContain("window.print()");
    expect(src("components/invoice-paper.tsx")).toContain("doc-paper");
  });
});

describe("S2 faktura – what the document must contain", () => {
  it("gate: § 435 OZ for everyone – name, sídlo, IČO, registry line; complete invoice has nothing missing", () => {
    expect(missingInvoiceFields(base())).toEqual([]);
    const empty = base({ supplier: { name: "", ico: "", dic: "", address: "", registry: "" }, customer: { name: "", ico: "", dic: "", address: "" }, number: "", items: [item("", "1", "")], account: "" });
    expect(missingInvoiceFields(empty)).toEqual([
      "Doplňte jméno a příjmení nebo název dodavatele.",
      "Doplňte sídlo dodavatele.",
      "Doplňte IČO dodavatele.",
      "Doplňte údaj o zápisu dodavatele v obchodním rejstříku nebo v jiné evidenci (§ 435 občanského zákoníku).",
      "Doplňte číslo faktury.",
      "Doplňte odběratele.",
      "Přidejte aspoň jednu položku s cenou.",
      "Doplňte číslo účtu, na který má odběratel zaplatit.",
    ]);
    expect(missingInvoiceFields(base({ supplier: { ...base().supplier, ico: "12345678" } }))).toEqual(["IČO dodavatele nemá platný kontrolní součet."]);
    expect(missingInvoiceFields(base({ payment: "hotove", account: "" }))).toEqual([]);
    expect(missingInvoiceFields(base({ account: "124/0100" }))).toEqual(["Číslo účtu není platné – zkontrolujte předčíslí, číslo a kód banky."]);
    expect(missingInvoiceFields(base({ items: [item("Práce", "1", "100"), item("Sleva", "1", "-200")] }))).toEqual(["Celková částka musí být větší než nula."]);
  });

  it("gate: VAT payer (§ 29 ZDPH) – supplier DIČ, DUZP and customer sídlo are required", () => {
    const p = base({ vatPayer: true, taxDate: "", customer: { ...base().customer, address: "" } });
    expect(missingInvoiceFields(p)).toEqual([
      "Doplňte DIČ dodavatele – plátce DPH ho na faktuře uvádí.",
      "Doplňte datum uskutečnění zdanitelného plnění (DUZP).",
      "Doplňte sídlo odběratele.",
    ]);
    expect(missingInvoiceFields({ ...p, kind: "zalohova", supplier: { ...p.supplier, dic: "CZ12345679" } })).toEqual([]);
  });

  it("gate: zjednodušený daňový doklad (§ 30, § 30a) – no customer only up to 10 000 Kč incl. VAT", () => {
    const noCustomer = base({ vatPayer: true, supplier: { ...base().supplier, dic: "CZ12345679" }, customer: { name: "", ico: "", dic: "", address: "" } });
    const small = { ...noCustomer, items: [item("Služba", "1", "8264,46")] }; // 8 264,46 + 21 % = 10 000,00
    expect(invoiceTotals(small.items, true).total).toBe(10000);
    expect(isSimplified(small, invoiceTotals(small.items, true))).toBe(true);
    expect(invoiceTitle(small, invoiceTotals(small.items, true))).toBe("Zjednodušený daňový doklad");
    expect(missingInvoiceFields(small)).toEqual([]);
    const big = { ...noCustomer, items: [item("Služba", "1", "8264,47")] };
    expect(isSimplified(big, invoiceTotals(big.items, true))).toBe(false);
    expect(missingInvoiceFields(big)).toEqual(["Doplňte odběratele. Bez něj lze vystavit jen zjednodušený daňový doklad do 10 000 Kč (§ 30 zákona o DPH)."]);
    // neplátce zjednodušený daňový doklad nevystavuje – odběratel chybí
    expect(missingInvoiceFields({ ...small, vatPayer: false })).toContain("Doplňte odběratele.");
  });

  it("gate: titles and notices – neplátce, plátce, zálohová faktura is not a tax document", () => {
    const t = { total: 100 };
    expect(invoiceTitle(base(), t)).toBe("Faktura");
    expect(invoiceTitle(base({ vatPayer: true }), t)).toBe("Faktura – daňový doklad");
    expect(invoiceTitle(base({ kind: "zalohova", vatPayer: true }), t)).toBe("Zálohová faktura");
    expect(invoiceNotices(base())).toEqual(["Dodavatel není plátcem DPH."]);
    expect(invoiceNotices(base({ vatPayer: true }))).toEqual([]);
    expect(invoiceNotices(base({ kind: "zalohova", vatPayer: true }))).toEqual([
      "Zálohová faktura je výzvou k platbě, není daňovým dokladem. Daňový doklad k přijaté platbě vystavíme po jejím přijetí.",
    ]);
    expect(invoiceNotices(base({ kind: "zalohova" }))).toEqual(["Dodavatel není plátcem DPH.", "Zálohová faktura je výzvou k platbě, není daňovým dokladem."]);
  });

  it("gate: the A4 paper shows the recap by rate, DUZP only for a tax document, and the registry line", async () => {
    const { InvoicePaper } = await import("@/components/invoice-paper");
    const inv = base({ vatPayer: true, supplier: { ...base().supplier, dic: "CZ12345679" }, items: [item("Práce", "2", "450", 21, "hod"), item("Kniha", "1", "199,90", 12)] });
    const html = renderToStaticMarkup(createElement(InvoicePaper, { inv, totals: invoiceTotals(inv.items, true), dueDate: "2026-10-31", vs: "2026015", iban: "CZ6508000000192000145399", qrSvg: null }));
    const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|\u00a0|\u202f/g, " ").replace(/\s+/g, " ");
    expect(html).toContain('class="doc-paper ');
    expect(text).toContain("Faktura – daňový doklad");
    expect(text).toContain("Datum uskutečnění plnění");
    expect(text).toContain("Rekapitulace DPH");
    expect(text).toContain("21 % 900,00 189,00 1 089,00");
    expect(text).toContain("12 % 199,90 23,99 223,89");
    expect(text).toContain("Celkem k úhradě 1 312,89 Kč");
    expect(text).toContain("CZ65 0800 0000 1920 0014 5399");
    expect(text).toContain("Fyzická osoba zapsaná v živnostenském rejstříku.");
    const z = renderToStaticMarkup(createElement(InvoicePaper, { inv: { ...inv, kind: "zalohova" }, totals: invoiceTotals(inv.items, true), dueDate: "", vs: "", iban: null, qrSvg: null, paper: false }));
    expect(z).not.toContain("Datum uskutečnění plnění");
    expect(z).not.toContain("doc-paper");
    expect(z).toContain("není daňovým dokladem");
  });
});

describe("S2 faktura – /faktura-zdarma page", () => {
  it("gate: public tool – sitemap, /nastroje, footer, llms.txt; description 140–160; indexable", async () => {
    expect(STATIC_PAGES.map((p) => p.path)).toContain("/faktura-zdarma");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).toContain(absoluteUrl("/faktura-zdarma"));
    expect(src("app/(site)/nastroje/page.tsx")).toContain('href: "/faktura-zdarma"');
    expect(src("components/site-footer.tsx")).toContain('href: "/faktura-zdarma"');
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toContain(`(${absoluteUrl("/faktura-zdarma")})`);
    const { metadata } = await import("@/app/(site)/faktura-zdarma/page");
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe("/faktura-zdarma");
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(140);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
  });

  it("gate: the page renders the generator, the legal requirements, FAQ with the EET answer and law sources", async () => {
    const { default: Page } = await import("@/app/(site)/faktura-zdarma/page");
    const html = renderToStaticMarkup(createElement(Page));
    const text = pageText(Page);
    expect(text).toContain("Faktura zdarma");
    expect(text).toContain("Doplnit z ARES");
    expect(text).toContain("Typ dokladu");
    expect(text).toContain("§ 435 odst. 1 občanského zákoníku");
    expect(text).toContain("Podle § 29 odst. 1 zákona o DPH musí daňový doklad obsahovat");
    expect(text).toContain("Zjednodušený daňový doklad do 10 000 Kč");
    expect(text).toContain("Zálohová faktura (proforma)");
    expect(text).toContain("Musím evidovat platbu za fakturu v EET 2.0?");
    expect(text).toContain(FACTS.evidenced.notEvidenced);
    expect(html).toContain('href="/navody/kontaktni-platba"');
    expect(html).toContain('"@type":"FAQPage"');
    for (const s of [SOURCES.oz435, SOURCES.zdph, SOURCES.zoUcetnictvi, SOURCES.kdoMusi]) expect(html).toContain(`href="${s.url}"`);
    expect(text).toContain("nejde o daňové poradenství");
  });

  it("gate: sources point to the official consolidated law texts", () => {
    expect(SOURCES.oz435.url).toBe("https://www.zakonyprolidi.cz/cs/2012-89#p435");
    expect(SOURCES.zdph.url).toBe("https://www.zakonyprolidi.cz/cs/2004-235#p29");
    expect(SOURCES.zoUcetnictvi.url).toBe("https://www.zakonyprolidi.cz/cs/1991-563#p11");
  });
});

describe("S2 faktura – /faktura-vzor (filled samples)", () => {
  it("gate: in the sitemap, linked from the generator, description 140–160, indexable", async () => {
    expect(STATIC_PAGES.map((p) => p.path)).toContain("/faktura-vzor");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).toContain(absoluteUrl("/faktura-vzor"));
    expect(src("app/(site)/faktura-zdarma/page.tsx")).toContain('href="/faktura-vzor"');
    const { metadata } = await import("@/app/(site)/faktura-vzor/page");
    expect(metadata.robots).toBeUndefined();
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(140);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
  });

  it("gate: two samples with fictional data (IČO and account fail the checksum), no .doc-paper, VAT recap for the payer", async () => {
    const { isValidIco } = await import("@ez/cz/ico");
    const { toIban } = await import("@ez/cz/bank");
    expect(isValidIco("12345678")).toBe(false);
    expect(isValidIco("87654321")).toBe(false);
    expect(toIban("123456789/0800")).toBeNull();
    const { default: Page } = await import("@/app/(site)/faktura-vzor/page");
    const html = renderToStaticMarkup(createElement(Page));
    const text = pageText(Page);
    expect(html).not.toContain("doc-paper");
    expect(text).toContain("Vzor faktury pro neplátce DPH");
    expect(text).toContain("Vzor faktury plátce DPH (daňový doklad)");
    expect(text).toContain("Dodavatel není plátcem DPH.");
    expect(text).toContain("Rekapitulace DPH");
    // 2 × 1 800 (12 %) a 2 × 600 − 200 (21 %): 3 600 + 432 = 4 032; 1 000 + 210 = 1 210; celkem 5 242
    const cells = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|\u00a0|\u202f/g, " ").replace(/\s+/g, " ");
    expect(cells).toContain("12 % 3 600,00 432,00 4 032,00");
    expect(cells).toContain("21 % 1 000,00 210,00 1 210,00");
    expect(cells).toContain("Celkem k úhradě 5 242,00 Kč");
    expect(text).toContain("Údaje jsou vymyšlené.");
    expect(html).toContain('href="/faktura-zdarma"');
  });
});
