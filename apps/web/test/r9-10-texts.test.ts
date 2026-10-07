/**
 * Рецензія №6 (B), texty doslovně:
 *  - R9.10 (B-M2) – kalky „prodán…“ v karanténě; v textech pro uživatele nesmí být /prodan/ vůbec;
 *  - R9.11 (B-M3) – N17: číslo (1 / 2–4 / 5+) a shoda v potvrzení „Odebrat registraci“;
 *  - R9.12 (B-M4–M7) – zásady (PURPOSES[0].data, „Odhlásit odběr“), INTEREST_LABEL.kabinet, webinářový formulář, nastavení.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { FC } from "react";
import { describe, expect, it } from "vitest";
import { INTEREST_LABEL } from "@/lib/interests";
import { removeRegistrationPrompt } from "@/lib/pos/revoked";
import { sendDownRefused } from "@/lib/server/quarantine";
import { pageText } from "./helpers/render-text";

const SRC = new URL("../src", import.meta.url).pathname;
const src = (p: string) => readFileSync(join(SRC, p), "utf8");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
/** Zdroj bez komentářů – v komentářích „tržba prodaná po přepnutí“ zůstat smí, uživatel je nevidí. */
const withoutComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1");
const flat = (s: string) => s.replace(/\s+/g, " ");

describe("R9.10 – no 'prodán…' calques in user-facing texts", () => {
  it("gate: quarantine texts (verbatim)", () => {
    expect(sendDownRefused("production")).toBe("Tržbu z ostrého provozu nelze odeslat v režimu Playground ani v ukázkovém režimu. Přepněte účet zpět, nebo ji vyřiďte ručně.");
    expect(sendDownRefused("playground")).toBe("Tržbu z režimu Playground nelze odeslat v ukázkovém režimu. Přepněte účet zpět, nebo ji vyřiďte ručně.");
    expect(src("lib/server/quarantine.ts")).toContain('"Tuto volbu lze použít jen u tržby ze starého režimu."');
  });

  it("gate: /prodan/i appears nowhere in src outside comments", () => {
    const hits: string[] = [];
    for (const f of files(SRC)) {
      for (const [i, line] of withoutComments(readFileSync(f, "utf8")).split("\n").entries()) if (/prodan/i.test(line)) hits.push(`${f.slice(SRC.length + 1)}:${i + 1}: ${line.trim()}`);
    }
    expect(hits).toEqual([]);
  });
});

describe("R9.11 – N17 plural forms", () => {
  it("gate: closed account – 1, 3, 7 (verbatim)", () => {
    expect(removeRegistrationPrompt(1, false)).toBe("V zařízení je 1 neodeslaná tržba. Zůstane v něm uložená, ale do zrušeného účtu ji už předat nejde. Pokračovat?");
    expect(removeRegistrationPrompt(3, false)).toBe("V zařízení jsou 3 neodeslané tržby. Zůstanou v něm uložené, ale do zrušeného účtu je už předat nejde. Pokračovat?");
    expect(removeRegistrationPrompt(7, false)).toBe("V zařízení je 7 neodeslaných tržeb. Zůstanou v něm uložené, ale do zrušeného účtu je už předat nejde. Pokračovat?");
  });

  it("gate: the canRegister branch has the 2–4 form too", () => {
    expect(removeRegistrationPrompt(3, true)).toBe("V zařízení jsou 3 neodeslané tržby. Zůstanou uložené, ale Finanční správě se odešlou až po nové registraci pokladny. Pokračovat?");
    expect(removeRegistrationPrompt(7, true)).toBe("V zařízení je 7 neodeslaných tržeb. Zůstanou uložené, ale Finanční správě se odešlou až po nové registraci pokladny. Pokračovat?");
    expect(removeRegistrationPrompt(1, true)).toMatch(/^V zařízení je 1 neodeslaná tržba\. Zůstane uložená/);
    expect(src("components/pos/pos-app.tsx")).toContain("removeRegistrationPrompt(waiting, revoked.canRegister)");
  });
});

describe("R9.12 – privacy policy and small texts", () => {
  it("gate: PURPOSES[0].data and the unsubscribe link name (verbatim)", async () => {
    const { default: Zasady } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const z = pageText(Zasady as FC);
    expect(z).toContain(
      "E-mail, nepovinně IČO a název firmy z ARES, obor, počet provozoven, co potřebujete (platební terminál, tiskárna, pomoc s DIS+), kód doporučení, zdroj návštěvy (UTM), u webinářů a Účetního kabinetu, o co máte zájem.",
    );
    expect(z).toContain("Zrušíte-li předregistraci (odkazem „Odhlásit odběr“ v e-mailu)");
    expect(z).not.toContain("(odkazem „Odhlásit“ v e-mailu)");
    // link v e-mailu se tak opravdu jmenuje
    expect(src("lib/emails.ts")).toContain(">Odhlásit odběr</a>");
  });

  it("gate: INTEREST_LABEL.kabinet, webinar form note, settings list (verbatim)", () => {
    expect(INTEREST_LABEL.kabinet).toBe("zájem o Účetní kabinet");
    expect(flat(src("components/accountant/webinar-form.tsx"))).toContain(
      'E-mail a IČO použijeme k vyřízení vaší žádosti (webinář nebo zpráva o spuštění Účetního kabinetu); novinky vám pošleme, jen pokud zaškrtnete souhlas výše. Podrobnosti najdete v{" "} <a href="/ochrana-osobnich-udaju" className="underline"> zásadách ochrany osobních údajů </a> .',
    );
    expect(src("components/setup/setup-app.tsx")).toContain("`• ${p.count}× tržba ${modeIn(p.mode)} (nejstarší");
  });
});
