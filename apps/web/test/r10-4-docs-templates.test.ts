/**
 * R10.4 (рецензія №7):
 *  - docs/revize-danovy-poradce.md: návod je indexovaný s `reviewedBy: REVIEWER.name`; funkci bere z REVIEWER_TITLE
 *    a mění ji jen kontrolor (žádné „daňový poradce č. …“);
 *  - e-maily k webináři a kabinetu nejsou obchodní sdělení: varianta B v R9.7 slibuje, že termín webináře a zprávu
 *    o kabinetu pošleme i po „Odhlásit jen novinky“ – takové šablony tedy nesmí být v MARKETING_TEMPLATES.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTEREST_NEXT } from "@/lib/interests";
import { MARKETING_TEMPLATES } from "@/lib/server/mail";

describe("R10.4 – documents and marketing templates", () => {
  it("gate: the adviser checklist tells to fill reviewedBy with REVIEWER.name, the title comes from REVIEWER_TITLE", () => {
    const doc = readFileSync(new URL("../../../docs/revize-danovy-poradce.md", import.meta.url), "utf8");
    expect(doc).toContain("`reviewedBy: REVIEWER.name`");
    expect(doc).toContain("REVIEWER_TITLE");
    expect(doc).not.toMatch(/reviewedBy: "Ім'я, daňový poradce/);
  });

  it("gate: no webinar, kabinet or interest e-mail is a marketing template (R9.7 variant B stays true)", () => {
    const interestish = [...MARKETING_TEMPLATES].filter((t) => /webinar|webinář|kabinet|interest|app-ready/i.test(t));
    expect(interestish).toEqual([]);
    expect([...MARKETING_TEMPLATES]).toEqual(["dis-launch"]);
    // to, co B slibuje, jsou právě tyto zprávy
    expect(INTEREST_NEXT.webinar).toMatch(/pošleme/);
    expect(INTEREST_NEXT.kabinet).toMatch(/dáme vědět/);
  });

  it("the rule is written next to MARKETING_TEMPLATES", () => {
    const src = readFileSync(new URL("../src/lib/server/mail.ts", import.meta.url), "utf8");
    const at = src.indexOf("export const MARKETING_TEMPLATES");
    expect(src.slice(Math.max(0, at - 600), at)).toMatch(/webinář[\s\S]*kabinet[\s\S]*R9\.7/);
  });
});
