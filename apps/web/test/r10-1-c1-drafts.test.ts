/**
 * R10.1 (рецензія №7, B) – koncepty C1 před revizí Heleny: fakta a jazyk (texty doslovně z recenze).
 */
import { describe, expect, it } from "vitest";
import { FACTS } from "@/content/facts";
import { getGuide } from "@/content/guides";

const json = (slug: string) => JSON.stringify(getGuide(slug));
const blocksText = (slug: string) =>
  getGuide(slug)!
    .sections.flatMap((s) => s.blocks)
    .map((b) => JSON.stringify(b))
    .join("\n");

describe("R10.1 – pokladna-v-mobilu-zdarma", () => {
  const g = () => getGuide("pokladna-v-mobilu-zdarma")!;

  it("gate: lead and summary (verbatim)", () => {
    expect(g().lead).toBe(
      "Od **1. 1. 2027** vám pro EET 2.0 stačí mobil, tablet nebo počítač s pokladní aplikací – i státní MOJE eet je webová aplikace. Pokladna musí o každé kontaktní platbě odeslat Finanční správě datovou zprávu podepsanou vaším pokladním certifikátem a při výpadku signálu ji doposlat nejpozději do 48 hodin.",
    );
    expect(g().summary).toContain("Státní MOJE eet bude od 1. 12. 2026 zdarma – pro nejvýše 2 evidenční jednotky a 2 zaměstnance.");
  });

  it("gate: the law requires sending afterwards, not selling offline; MOJE eet export is 'nezveřejnila' (verbatim)", () => {
    const list = g().sections.find((s) => s.id === "co-musi-umet")!.blocks.find((b) => "ul" in b) as { ul: string[] };
    expect(list.ul).toContain(`**Doposlat tržbu po výpadku spojení.** ${FACTS.offline.summary} Zda pokladna umí prodávat i bez signálu, se liší podle aplikace – viz checklist níže.`);
    expect(list.ul.join("\n")).not.toContain("Fungovat bez signálu");
    expect(blocksText("pokladna-v-mobilu-zdarma")).toContain(
      "Pokud potřebujete víc evidenčních jednotek nebo pokladních, případně jistotu prodeje bez signálu a exportu pro účetní (u MOJE eet je Finanční správa zatím nezveřejnila), porovnejte ji s nezávislými pokladnami – například v našem [srovnání EvidujZdarma a MOJE eet](/srovnani/moje-eet), které uvádí jen zveřejněné údaje.",
    );
    // R17.1: datum spuštění je pevné (2. 11. 2026), text doslovně z рецензії – hlídá r17-1-launch.test.ts
    expect(json("pokladna-v-mobilu-zdarma")).toContain("Spouštíme ji 2. 11. 2026");
    expect(json("pokladna-v-mobilu-zdarma")).not.toContain("1. 12. 2026, předregistrovat");
  });

  it("gate: FAQ about invoices (verbatim)", () => {
    const faq = g().faq!.find((f) => f.q.endsWith("když mi všichni platí převodem na fakturu?"));
    expect(faq?.a).toBe(
      `Ne. ${FACTS.evidenced.notEvidenced} Pokud ale zákazník zaplatí převodem nebo QR kódem přímo u vás, jde o kontaktní platbu. Pokladnu potřebujete jen pro kontaktní platby.`,
    );
  });
});

describe("R10.1 – eet-eshop-dobirka", () => {
  const g = () => getGuide("eet-eshop-dobirka")!;

  it("gate: your own shop or pick-up point; 'převodem předem'; table caption; FAQ refers to COD above", () => {
    expect(g().lead).toContain("typicky při osobním odběru na vaší prodejně nebo vašem výdejním místě.");
    expect(g().description).toContain("Platby přes platební bránu a převodem předem se v EET 2.0 neevidují.");
    expect(g().description.length).toBeLessThanOrEqual(160);
    expect(blocksText("eet-eshop-dobirka")).toContain("na prodejně, na vlastním výdejním místě nebo při vlastním rozvozu");
    const faq = g().faq!.find((f) => f.q === "Potřebuje e-shop pokladnu?")!;
    expect(faq.a).toContain("na prodejně, na vlastním výdejním místě nebo při vlastním rozvozu (k dobírce viz výše)");
    const table = g().sections.flatMap((s) => s.blocks).find((b) => "table" in b) as { table: { caption: string } };
    expect(table.table.caption).toBe("Rozhoduje, zda zákazník platí při osobním kontaktu s vámi nebo ve vaší provozovně, ne kde si zboží objednal.");
    // výdejní místo cizího dopravce (Zásilkovna apod.) je otevřená otázka – text nesmí tvrdit, že se eviduje
    expect(json("eet-eshop-dobirka")).not.toMatch(/na výdejním místě nebo/);
  });
});

describe("R10.1 – eet-trhy-stanky", () => {
  it("gate: exempt activities and EET OFF; 'Letadlo'; table caption (verbatim)", () => {
    const text = blocksText("eet-trhy-stanky");
    expect(text).toContain(
      "Evidujete vždy, když na trhu přijímáte kontaktní platby – i když prodáváte jen několik víkendů v roce. Výjimkou jsou činnosti, které zákon vyjímá (např. prodej kaprů před Vánoci), a režim EET OFF.",
    );
    expect(json("eet-trhy-stanky")).toContain("v režimu Letadlo");
    expect(json("eet-trhy-stanky")).not.toContain("v režimu letadlo");
    const table = getGuide("eet-trhy-stanky")!.sections.flatMap((s) => s.blocks).find((b) => "table" in b) as { table: { caption: string } };
    expect(table.table.caption).toBe("Rozhoduje, zda zákazník platí při osobním kontaktu s vámi nebo ve vaší provozovně, ne způsob platby.");
  });
});

describe("R10.1 – all three drafts", () => {
  it("gate: the certificate is generated ('vygenerujte'), as in the reviewed guides", () => {
    for (const slug of ["pokladna-v-mobilu-zdarma", "eet-eshop-dobirka", "eet-trhy-stanky"]) {
      const t = json(slug);
      expect(t, slug).not.toMatch(/[Vv]ydejte|vydáte/);
      expect(t, slug).toMatch(/[Vv]ygenerujte|vygenerujete/);
    }
  });
});
