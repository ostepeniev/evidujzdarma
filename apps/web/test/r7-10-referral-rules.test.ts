/**
 * R7.10 (рецензія №4; rozhodnutí Ц3; B 5.1, Z6) – akce „Doporučte kolegu“ s pravidly: stránka /pravidla-doporuceni
 * (text doslovně), odkaz u každé zmínky akce, služební e-maily bez akce, kód doporučení bez localStorage.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { operatorLine, SITE } from "@/lib/site";
import { pageText } from "./helpers/render-text";

vi.mock("@/lib/sitemap-registry", () => ({ extraSitemaps: async () => [] }));

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });
}

describe("R7.10 – referral promotion with rules", () => {
  it("gate: /pravidla-doporuceni exists, is in the sitemap and the footer, and carries the rules verbatim with the operator", async () => {
    const { default: Rules } = await import("@/app/(site)/pravidla-doporuceni/page");
    const text = pageText(Rules);
    expect(text).toContain("Pravidla akce Doporučte kolegu");
    expect(text).toContain(`1. Pořadatel. Akci pořádá ${operatorLine()}, provozovatel služby EvidujZdarma.`);
    // R8.2 (рецензія №5): c) končí „, a“ a přibyla d)
    expect(text).toContain("c) do 31. 3. 2027 začne v EvidujZdarma evidovat tržby v ostrém režimu, tedy odešle Finanční správě alespoň jednu tržbu, a");
    expect(text).toContain("d) předregistraci mezitím nezruší.");
    expect(text).toContain(
      "4. Odměna. Každý z vás získá tarif Premium na 3 měsíce zdarma. Premium připravujeme; odměnu připíšeme ke dni jeho spuštění a o spuštění vás budeme informovat e-mailem. Po 3 měsících Premium samo nepřechází do placeného tarifu. Odměny za více doporučených se sčítají, nejvýše na 12 měsíců Premium pro jednoho doporučujícího. Odměnu nelze vyměnit za peníze ani převést na někoho jiného.",
    );
    expect(text).toContain(`8. Kontakt. Dotazy pište na ${SITE.email}.`);
    expect(text).toMatch(/Platí od \d{1,2}\. \d{1,2}\. 2026/);
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().some((e) => new URL(e.url).pathname === "/pravidla-doporuceni")).toBe(true);
    expect(src("components/site-footer.tsx")).toContain("/pravidla-doporuceni");
  });

  it("gate: every mention of the promotion links to the rules", () => {
    for (const p of ["app/(site)/page.tsx", "app/(site)/registrace/potvrzeni/page.tsx", "components/accountant/partner-badge.tsx"]) expect(src(p), p).toContain("/pravidla-doporuceni");
  });

  it("gate: pricing FAQ verbatim", async () => {
    const { PRICING_FAQ } = await import("@/content/pricing");
    expect(PRICING_FAQ.map((f) => f.a)).toContain(
      "Ano – když se přes váš odkaz předregistruje kolega a do 31. 3. 2027 začne s EvidujZdarma evidovat tržby, získáte oba Premium na 3 měsíce zdarma. Odkaz dostanete po potvrzení předregistrace. Podrobnosti najdete v pravidlech akce.",
    );
  });

  it("gate: the transactional prereg-confirm e-mail mentions no referral link", async () => {
    const { renderEmail } = await import("@/lib/emails");
    for (const already of [true, false]) {
      const m = renderEmail("prereg-confirm", { confirmToken: "x".repeat(24), referralCode: "abcdefgh", unsubscribeToken: "y".repeat(24), alreadyConfirmed: already });
      expect(m.text + m.html).not.toMatch(/doporučovací/);
    }
    const fresh = renderEmail("prereg-confirm", { confirmToken: "x".repeat(24), unsubscribeToken: "y".repeat(24) });
    expect(fresh.html).toContain("Jedním kliknutím potvrďte e-mail. Až pokladnu spustíme, pošleme vám odkaz.");
    const again = renderEmail("prereg-confirm", { confirmToken: "x".repeat(24), unsubscribeToken: "y".repeat(24), alreadyConfirmed: true });
    expect(again.text).toContain("Stav předregistrace najdete zde:");
    expect(again.html).toContain("Stav předregistrace najdete zde:");
  });

  it("gate Z6: the referral code is not stored in the browser; the privacy policy says so", async () => {
    for (const f of files(new URL("../src/components", import.meta.url).pathname)) expect(readFileSync(f, "utf8"), f).not.toMatch(/localStorage\.setItem\("ez_ref"/);
    const { default: Zasady } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    expect(pageText(Zasady)).toContain("Pokud přijdete přes odkaz s doporučením, kód doporučení odešleme jen spolu s formulářem předregistrace; do prohlížeče ho neukládáme.");
  });
});
