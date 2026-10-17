/**
 * S1 (17. 10. 2026): nástroje Doklad o prodeji (§ 16 zákona o ochraně spotřebitele) a Vzor pověření (§ 10 zákona
 * č. 180/2026 Sb.). Doklad je veřejný nástroj (sitemap, /nastroje, patička, llms.txt); vzor pověření je právní text
 * a do kontroly účetní zůstává noindex, mimo sitemap i rozcestník.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authorizationText, formatCzDate, formatCzk, lineTotal, missingSaleFields, parseCzNumber, saleTotal } from "@/lib/doc-tools";
import { STATIC_PAGES } from "@/lib/static-pages";
import { absoluteUrl } from "@/lib/site";
import { pageText } from "./helpers/render-text";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("S1 – doc-tools (pure)", () => {
  it("gate: Czech numbers, line totals and the sum", () => {
    expect(parseCzNumber("1 234,50")).toBe(1234.5);
    expect(parseCzNumber("99")).toBe(99);
    expect(parseCzNumber("")).toBeNull();
    expect(parseCzNumber("12a")).toBeNull();
    expect(lineTotal({ name: "Káva", qty: "3", price: "45,90" })).toBe(137.7);
    expect(lineTotal({ name: "Káva", qty: "", price: "45" })).toBe(45);
    expect(lineTotal({ name: "Káva", qty: "0", price: "45" })).toBeNull();
    expect(saleTotal([{ name: "A", qty: "2", price: "0,1" }, { name: "B", qty: "1", price: "0,2" }, { name: "", qty: "1", price: "" }])).toBe(0.4);
    expect(nbsp(formatCzk(1234.5))).toBe("1 234,50 Kč");
    expect(formatCzDate("2027-01-01")).toBe("1. 1. 2027");
  });

  it("gate: § 16 essentials are required – seller, IČO, date, item with a price", () => {
    expect(missingSaleFields({ sellerName: "", ico: "", date: "", items: [{ name: "", qty: "1", price: "" }] })).toEqual([
      "Doplňte jméno a příjmení nebo název prodávajícího.",
      "Doplňte IČO prodávajícího.",
      "Doplňte datum prodeje.",
      "Přidejte aspoň jednu položku (zboží nebo službu) s cenou.",
    ]);
    expect(missingSaleFields({ sellerName: "Jana Nováková", ico: "12345678", date: "2026-10-17", items: [{ name: "Střih", qty: "1", price: "350" }] })).toEqual([]);
    expect(missingSaleFields({ sellerName: "J", ico: "1", date: "2026-10-17", items: [{ name: "", qty: "1", price: "350" }] })).toEqual([
      "U každé položky uveďte, o jaké zboží nebo službu jde.",
    ]);
  });

  it("gate: the authorization cites § 10 (both paragraphs) and § 17 odst. 2 písm. c); empty fields stay as ⟨…⟩", () => {
    const party = { name: "", ico: "", eic: "", address: "" };
    const t = authorizationText({ principal: party, agent: party, scope: "", place: "", from: "2027-01-01", to: "", handover: "", noticeDays: "", signPlace: "", signDate: "" });
    expect(t).toContain("podle § 10 zákona č. 180/2026 Sb., o evidenci tržeb");
    expect(t).toContain("§ 17 odst. 2 písm. c)");
    expect(t).toContain("(§ 10 odst. 1)");
    expect(t).toContain("s výjimkou povinnosti evidovat tržbu (§ 10 odst. 2)");
    expect(t).toContain("Pověření platí od 1. 1. 2027 na dobu neurčitou.");
    expect(t).toContain("uplynutím 30 dnů");
    expect(t).toMatch(/⟨IČO⟩/);
    const filled = authorizationText({
      principal: { name: "Petr Masér", ico: "12345678", eic: "CZ8001011234", address: "Karlovy Vary" },
      agent: { name: "Hotel Lázně s.r.o.", ico: "87654321", eic: "CZ87654321", address: "Karlovy Vary" },
      scope: "platby za masáže",
      place: "na recepci hotelu",
      from: "2027-01-01",
      to: "2027-12-31",
      handover: "každé pondělí převodem",
      noticeDays: "14",
      signPlace: "Karlových Varech",
      signDate: "2026-12-15",
    });
    expect(filled).toContain("Pověření platí od 1. 1. 2027 do 31. 12. 2027.");
    expect(filled).toContain("V Karlových Varech dne 15. 12. 2026");
    expect(filled).not.toMatch(/⟨/);
  });
});

describe("S1 – /doklad-o-prodeji", () => {
  it("gate: public tool – sitemap, /nastroje, footer, llms.txt; description 140–160; indexable", async () => {
    expect(STATIC_PAGES.map((p) => p.path)).toContain("/doklad-o-prodeji");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).toContain(absoluteUrl("/doklad-o-prodeji"));
    expect(readFileSync(new URL("../src/app/(site)/nastroje/page.tsx", import.meta.url), "utf8")).toContain('href: "/doklad-o-prodeji"');
    expect(readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8")).toContain('href: "/doklad-o-prodeji"');
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toContain(absoluteUrl("/doklad-o-prodeji"));
    const { metadata } = await import("@/app/(site)/doklad-o-prodeji/page");
    expect(metadata.robots).toBeUndefined();
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(140);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
  });

  it("gate: the page explains § 16 (on request), POK voluntary, VAT payers, data stay in the browser", async () => {
    const { default: Page } = await import("@/app/(site)/doklad-o-prodeji/page");
    const text = pageText(Page);
    expect(text).toContain("Doklad o prodeji zdarma");
    expect(text).toContain("Pokud o doklad zákazník požádá, vydává se podle § 16 zákona o ochraně spotřebitele");
    expect(text).toContain("POK na dokladu uvádět nemusíte");
    expect(text).toContain("daňovým dokladem podle zákona o DPH ale není");
    expect(text).toContain("Doklad se skládá přímo ve vašem prohlížeči");
    expect(text).toContain("Doplnit z ARES");
  });
});

describe("S1 – /vzor-povereni (before the accountant's review)", () => {
  it("gate: noindex, not in the sitemap, the tools hub or llms.txt", async () => {
    const { metadata } = await import("@/app/(site)/vzor-povereni/page");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(STATIC_PAGES.map((p) => p.path)).not.toContain("/vzor-povereni");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).not.toContain(absoluteUrl("/vzor-povereni"));
    expect(readFileSync(new URL("../src/app/(site)/nastroje/page.tsx", import.meta.url), "utf8")).not.toContain("/vzor-povereni");
    const { llmsTxt, llmsFullTxt } = await import("@/lib/llms");
    expect(llmsTxt()).not.toContain("/vzor-povereni");
    expect(llmsFullTxt()).not.toContain("/vzor-povereni");
  });

  it("gate: the page says it is a pomůcka, links the guide and keeps § 10 odst. 2 liability", async () => {
    const { default: Page } = await import("@/app/(site)/vzor-povereni/page");
    const text = pageText(Page);
    expect(text).toContain("Vzor je pomůcka, ne právní služba.");
    expect(text).toContain("Tržba za jiného");
    expect(text).toContain("POVĚŘENÍ K EVIDOVÁNÍ TRŽEB");
    expect(text).toContain("zůstává odpovědný za povinnost evidovat tržbu");
  });
});

describe("S1 – print CSS", () => {
  it("gate: the POS receipt rule only hides the page when a receipt is on it (QR and tools print, not a blank page)", () => {
    const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    expect(css).toContain("body:where(:has(.receipt-paper)) *");
    expect(css).toContain("body:where(:has(.doc-paper)) *");
    expect(css).not.toMatch(/^\s{2}body \* \{/m);
  });
});

describe("S1 – /checklist-eet", () => {
  it("gate: public tool in the sitemap, /nastroje, footer and llms.txt; 8 steps matching the pillar's 'Co musíte udělat'", async () => {
    const { CHECKLIST } = await import("@/content/checklist");
    const { getGuide } = await import("@/content/guides");
    expect(STATIC_PAGES.map((p) => p.path)).toContain("/checklist-eet");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().map((e) => e.url)).toContain(absoluteUrl("/checklist-eet"));
    expect(readFileSync(new URL("../src/app/(site)/nastroje/page.tsx", import.meta.url), "utf8")).toContain('href: "/checklist-eet"');
    expect(readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8")).toContain('href: "/checklist-eet"');
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toContain(absoluteUrl("/checklist-eet"));
    const pillar = getGuide("eet-2-0-kompletni-pruvodce")!;
    const blocks = pillar.sections.find((s) => s.id === "co-udelat")!.blocks;
    const ol = (blocks.find((b) => "ol" in b) as { ol: string[] }).ol;
    expect(CHECKLIST).toHaveLength(ol.length);
    for (const when of ["Od 1. 11. 2026", "Hned poté", "Od 1. 1. 2027", "V prosinci 2026"]) {
      expect(CHECKLIST.some((s) => s.when === when), when).toBe(true);
      expect(ol.some((x) => x.startsWith(`**${when}:**`)), when).toBe(true);
    }
    expect(JSON.stringify(blocks)).toContain("(/checklist-eet)");
    const { metadata } = await import("@/app/(site)/checklist-eet/page");
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(140);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
  });

  it("gate: the page renders all steps, says nothing is stored and has HowTo JSON-LD", async () => {
    const { default: Page } = await import("@/app/(site)/checklist-eet/page");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain('"@type":"HowTo"');
    const text = pageText(Page);
    expect(text).toContain("Hotovo 0 z 8");
    expect(text).toContain("Přihlaste se v DIS+ k evidenci tržeb");
    expect(text).toContain("Odškrtnutí platí jen v otevřené stránce.");
  });
});
