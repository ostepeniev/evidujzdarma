/**
 * R4 – drobné obsahové opravy z rецензії №1, C «Дрібне» 1–3, 8–18, 20, 21 (texty podle návrhu recenzenta).
 * Body 4–7 a 19 (předmět účtenky, logo, taxID, /pokladna, OG a favicon) jsou hotové z dřívějška.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPARISON_ROWS } from "@/content/comparison";
import { GUIDES } from "@/content/guides";
import { renderEmail } from "@/lib/emails";
import * as assessment from "@/lib/eet-assessment";
import { calculateEetOff } from "@/lib/eet-off";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const guide = (slug: string) => JSON.stringify(GUIDES.find((g) => g.slug === slug));

describe("C Дрібне 1–2 – Czech plural of provozovna", () => {
  it("gate: 1 / 2–4 / 5+ establishments", () => {
    const f = assessment as unknown as { establishmentsIs?: (n: number) => string; establishmentsHave?: (n: number) => string };
    expect(typeof f.establishmentsIs).toBe("function");
    expect([1, 3, 7].map(f.establishmentsIs!)).toEqual(["je 1 provozovna", "jsou 3 provozovny", "je 7 provozoven"]);
    expect([1, 3, 7].map(f.establishmentsHave!)).toEqual(["1 provozovnu", "3 provozovny", "7 provozoven"]);
  });
});

describe("C Дрібне 3 – DIS+ is not 'spuštěné'", () => {
  it("gate: the DIS+ e-mail talks about the evidence of sales in DIS+", () => {
    const e = renderEmail("dis-launch", { unsubscribeToken: "u".repeat(24) });
    expect(e.subject).toBe("Evidence tržeb v DIS+ je spuštěná – návod krok za krokem");
    expect(e.text).toContain("Finanční správa zpřístupnila v DIS+ přihlášení k evidenci tržeb.");
    expect(e.text + e.html).not.toMatch(/DIS\+ je spuštěné/);
  });
});

describe("C Дрібне 8, 9, 17 – landing page", () => {
  const page = src("app/(site)/page.tsx");
  it("gate: dates, POK wording and sources", () => {
    expect(page).toContain("co udělat od 1. 11., do 1. 12. a do 1. 1.");
    expect(page).toContain("Na účtence může být i kód POK od Finanční správy (není povinný).");
    expect(page).not.toContain("Účtenka s kódem od Finanční správy.");
    expect(page).toContain("tiskové zprávy Finanční správy a Ministerstva financí");
  });
});

describe("C Дрібне 10–14 – guides, comparison, quiz, IČO page", () => {
  it("gate: the law requires sending, not confirmation; switching off the device does not delete data", () => {
    const g = guide("eet-bez-internetu");
    expect(g).toContain("musí být tržba odeslána.");
    expect(g).not.toContain("odeslána a potvrzená");
    expect(g).toContain("Nemažte data prohlížeče ani neodinstalujte aplikaci, dokud fronta neodeslaných tržeb není prázdná");
    expect(g).not.toMatch(/nevypínejte/i);
  });

  it("gate: comparison, quiz and the IČO page wording", () => {
    expect(COMPARISON_ROWS.some((r) => r.ours === "Klíč uložený v zařízení + PIN pro každou pokladní")).toBe(true);
    expect(src("app/(site)/musim-evidovat/page.tsx")).toContain("Můžu místo evidence platit přirážku?");
    expect(guide("koho-se-eet-tyka")).not.toMatch(/evidenci vyhnout/);
    const ico = src("app/(site)/kontrola-ico/page.tsx");
    expect(ico).toContain("Odpověď z ARES krátce (24 hodin) ukládáme do mezipaměti; k žádnému profilu ji nepřiřazujeme.");
  });
});

describe("C Дрібне 15 – tools show when the facts were verified", () => {
  it("gate: calculator, quiz, units wizard and IČO check show 'Ověřeno k'", () => {
    for (const p of ["kalkulacka-eet-off", "musim-evidovat", "evidencni-jednotky", "kontrola-ico"]) {
      expect(src(`app/(site)/${p}/page.tsx`), p).toMatch(/<FactsVerified|Ověřeno k/);
    }
  });
});

describe("C Дрібне 16, 18, 20, 21", () => {
  it("gate: guides lead, canonical inheritance, Oznámení, EET OFF eligibility", () => {
    expect(src("app/(site)/navody/page.tsx")).not.toContain("s odkazy na zákon");
    expect(src("app/layout.tsx")).not.toMatch(/canonical\s*:/);
    // canonical i og:url z jednoho helperu (R9.13)
    expect(src("app/(site)/page.tsx")).toContain('canonicalMeta("/")');
    expect(src("app/(site)/kalkulacka-eet-off/page.tsx")).toContain("Oznámení do 11. 1. 2027.");
    expect(calculateEetOff({ band: 0, income: 500_000 } as never)).toMatchObject({ eligible: false, reason: "EET OFF je jen pro fyzické osoby v 1. pásmu paušálního režimu." });
  });
});
