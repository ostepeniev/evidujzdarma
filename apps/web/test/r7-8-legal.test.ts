/**
 * R7.8 (рецензія №4, B розд. 4) – zásady a podmínky odpovídají kódu. Texty doslovně z recenze.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageText } from "./helpers/render-text";

const { default: Zasady } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
const { default: Podminky } = await import("@/app/(site)/podminky/page");
const zasady = pageText(Zasady);
const podminky = pageText(Podminky);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });
}

describe("R7.8 – privacy policy and terms match the code", () => {
  it("gate Z4: processors name Brevo and its tracking; no absolute 'nepředáváme mimo EU'", () => {
    expect(zasady).toContain(
      "Zpracovatelé – poskytovatel hostingu se servery v Evropské unii a poskytovatel doručování e-mailů Brevo (Sendinblue SAS, 17 rue Salneuve, 75017 Paříž, Francie). Odkazy v e-mailech vedou přes doménu Brevo, která anonymně počítá otevření a prokliky, bez vazby na konkrétního příjemce. Po spuštění placených doplňků také platební partner. Se všemi máme uzavřenou smlouvu o zpracování osobních údajů.",
    );
    expect(zasady).toContain(
      "Údaje ukládáme v Evropské unii. Brevo e-maily odesílá a ukládá na serverech v EU; jeho podpora a někteří jeho subdodavatelé mohou mít k údajům v nezbytném rozsahu přístup i ze zemí mimo EU (USA, Indie), a to na základě standardních smluvních doložek EU, u společností v USA také rámce EU-U.S. Data Privacy Framework. Aktuální seznam zpracovatelů vám na požádání pošleme.",
    );
    expect(zasady).toContain("údaje neprodáváme a ukládáme je v EU");
    expect(zasady).not.toMatch(/nepředáváme mimo/);
  });

  it("gate Z5/Z7: cookies – poll legal basis; every localStorage key in components is explained", () => {
    expect(zasady).toContain("(oprávněný zájem na férovém výsledku ankety, čl. 6 odst. 1 písm. f) GDPR)");
    expect(zasady).toContain("Název kanceláře, který vyplníte v šablonách dopisů pro klienty, zůstává jen ve vašem prohlížeči a na server ho neposíláme.");
    // klíč → věta v zásadách, která ho vysvětluje
    const EXPLAINED: Record<string, string> = { ez_office_name: "Název kanceláře, který vyplníte v šablonách dopisů", ez_ref: "kód doporučení" };
    const root = new URL("../src/components", import.meta.url).pathname;
    for (const f of files(root)) {
      const src = readFileSync(f, "utf8");
      const consts = Object.fromEntries([...src.matchAll(/const (\w+) = "([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
      for (const m of src.matchAll(/localStorage\.setItem\(\s*(?:"([^"]+)"|(\w+))/g)) {
        const key = m[1] ?? consts[m[2]!];
        expect(key, `${f}: neznámý klíč`).toBeTruthy();
        expect(EXPLAINED[key!], `${key} není v zásadách`).toBeTruthy();
        expect(zasady).toContain(EXPLAINED[key!]);
      }
    }
  });

  it("gate Z8: the catalogue is described as being prepared, not published", () => {
    expect(zasady).toContain(
      "Připravujeme katalog firem a provozoven s orientačním vyhodnocením, zda se jich může týkat EET 2.0. Zatím není veřejně přístupný; zveřejníme ho až po posouzení oprávněného zájmu. Údaje přebíráme z veřejných registrů",
    );
    expect(zasady).not.toMatch(/Na webu zveřejňujeme katalog/);
  });

  it("gate Z9: the catalogue data list is the same in the privacy policy and on /namitka and names what /firma shows", async () => {
    const { CATALOG_DATA } = await import("@/content/catalog-data");
    expect(zasady).toContain(CATALOG_DATA);
    const { default: Namitka } = await import("@/app/(site)/namitka/page");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const namitka = renderToStaticMarkup(await Namitka({ searchParams: Promise.resolve({}) } as never)).replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(namitka).toContain(CATALOG_DATA);
    void createElement;
    for (const field of ["DIČ", "plátce DPH", "data vzniku a zániku", "sídlo", "obory činnosti", "provozovny"]) expect(CATALOG_DATA).toContain(field);
  });

  it("gate T1/T3: 6.2 promises no PDF; 11.3 sends the 30/55-day e-mails only with unsent production sales", () => {
    const six = podminky.slice(podminky.indexOf("6.2 "), podminky.indexOf("6.3 "));
    expect(six).not.toMatch(/PDF/);
    expect(podminky).toContain("O stavu účtu provozovatel uživatele informuje e-mailem v den zrušení a – obsahuje-li účet neodeslané ostré tržby – také 30. a 55. den po zrušení.");
  });

  it("versions are raised and dated with the R7 draft", async () => {
    const legal = await import("@/lib/legal");
    expect(legal.TERMS_VERSION > "2026-10-03").toBe(true);
    expect(legal.PRIVACY_VERSION_LABEL).toBe("3. 10. 2026");
    expect(readFileSync(new URL("../src/app/(site)/podminky/page.tsx", import.meta.url), "utf8")).toMatch(/TERMS_VERSION_LABEL/);
  });
});
