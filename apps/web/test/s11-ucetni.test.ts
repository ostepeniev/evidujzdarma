/**
 * S11 – stránka pro účetní po otevření pokladny: hero a CTA, „Co vám ušetříme“, Nastavení na klíč s doslovnou větou
 * o odměně, balíček pro klienty místo webináře, kód kanceláře v kabinetu, pravidla odměny, funkční cookie ez_ucetni_ref
 * (jen z parametru na /nastaveni-na-klic), události přes clarityEvent, zásady a verze.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";
import { pageText } from "./helpers/render-text";

vi.mock("@/lib/sitemap-registry", () => ({ extraSitemaps: async () => [] }));

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const DISCLOSURE = "Za každé dokončené nastavení klienta, kterého doporučíte, dostanete 200 Kč. Cena pro klienta se tím nezvyšuje.";

afterEach(() => {
  vi.doUnmock("@/lib/launch");
  vi.resetModules();
});

describe("S11 – /ucetni", () => {
  it("gate: hero, CTAs, savings, setup block with the verbatim disclosure, package for clients, no webinar", async () => {
    mockLaunch("open");
    const { default: Ucetni } = await import("@/app/(site)/ucetni/page");
    const html = renderToStaticMarkup(createElement(Ucetni));
    const text = pageText(Ucetni);
    expect(text).toContain("EET 2.0 pro vaše klienty. Pokladna zdarma, nastavení za nás.");
    expect(text).toContain("Účetní kabinet zdarma a bez limitu klientů. Nastavení DIS+ a pokladního certifikátu za vaše klienty uděláme my.");
    expect(html).toMatch(/<a class="btn-primary" href="\/kabinet">Založit kabinet zdarma<\/a>/);
    expect(html).toContain('href="#nastaveni-na-klic">Poslat klientovi odkaz na nastavení</a>');
    expect(text).toContain("Co vám ušetříme");
    expect(text).toContain("990 Kč bez DPH, platí klient");
    expect(text).toContain("Do EET jde jen celková částka – v kabinetu máte i rozpis DPH.");
    expect(text).toContain("11. 1. 2027");
    expect(text).toContain("Nastavení na klíč pro vaše klienty");
    expect(text).toContain("/nastaveni-na-klic?ref=");
    expect(text).toContain(DISCLOSURE);
    expect(text).toContain("Balíček pro klienty");
    expect(html).toContain('href="/ucetni/pro-klienty"');
    expect(text).not.toMatch(/webinář/i);
    expect(text).not.toMatch(/kód dostanete po předregistraci|po předregistraci/);
    expect(text).toContain(`20 % z plateb klientů`);
    expect(text).toContain("200 Kč za každé dokončené nastavení");
    expect(text).toContain("Pohoda XML (beta)");
    expect(text).not.toMatch(/Pohod[^.]*připravujeme/);
    // bez jmen konkurence a bez strašení pokutami
    expect(text).not.toMatch(/pokut|sankc|Dotykačka|Storyous|Money S3 je|eKasa/i);
    expect(src("app/(site)/ucetni/page.tsx")).toContain('<ClarityOnView name="acc_lp_view" />');
  });

  it("gate: the client one-pager is a real page in the sitemap; the badge points to the setup page with the office code", async () => {
    const { default: OnePager } = await import("@/app/(site)/ucetni/pro-klienty/page");
    const text = pageText(OnePager);
    expect(text).toContain("EET 2.0 v kostce");
    expect(text).toContain("11. 1. 2027");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(sitemap().some((e) => new URL(e.url).pathname === "/ucetni/pro-klienty")).toBe(true);
    const { partnerBadgeHtml } = await import("@/components/accountant/partner-badge");
    expect(partnerBadgeHtml("abc12345")).toContain('href="https://evidujzdarma.cz/nastaveni-na-klic?ref=abc12345"');
    expect(src("components/accountant/partner-badge.tsx")).toContain("najdete ho v Účetním");
  });

  it("gate: the kabinet shows the personal link, the disclosure, the referred orders table and copies via clarityEvent", () => {
    const app = src("components/cabinet/cabinet-app.tsx");
    expect(app).toContain("Doporučená nastavení");
    expect(app).toContain("ACCOUNTANT_REWARD_DISCLOSURE");
    expect(app).toContain('clarityEvent("acc_ref_link_copy")');
    expect(app).toContain("setupReferralPath(code)");
  });

  it("gate: reward rules on /pravidla-doporuceni#ucetni with the disclosure", async () => {
    const { default: Rules } = await import("@/app/(site)/pravidla-doporuceni/page");
    const html = renderToStaticMarkup(createElement(Rules));
    expect(html).toContain('id="ucetni"');
    const text = pageText(Rules);
    expect(text).toContain(`2. Odměna. ${DISCLOSURE}`);
    expect(text).toContain("do 90 dnů");
    expect(text).toContain("Platí od 3. 11. 2026.");
  });
});

describe("S11 – referral cookie and analytics", () => {
  it("gate: the cookie is functional, 90 days, limited to /nastaveni-na-klic, set only from ?ref on that page", async () => {
    const { setupRefCookie, setupRefFromCookie, isPartnerCode } = await import("@/lib/setup-ref");
    expect(setupRefCookie("abc12345", true)).toBe("ez_ucetni_ref=abc12345; Max-Age=7776000; Path=/nastaveni-na-klic; SameSite=Lax; Secure");
    expect(setupRefFromCookie("a=b; ez_ucetni_ref=abc12345")).toBe("abc12345");
    expect(setupRefFromCookie("ez_ucetni_ref=<x>")).toBeNull();
    expect(isPartnerCode("ABC")).toBe(false);
    // jediné místo, kde se cookie zapisuje
    const writers = ["components/service-order-form.tsx"];
    expect(src(writers[0]!)).toMatch(/document\.cookie = setupRefCookie\(fromUrl/);
    for (const f of ["components/cabinet/cabinet-app.tsx", "app/(site)/ucetni/page.tsx", "components/accountant/partner-badge.tsx"]) expect(src(f), f).not.toContain("document.cookie");
  });

  it("gate: the three events exist only via the consent-aware clarityEvent helper", () => {
    const ev = src("lib/clarity-event.ts");
    for (const e of ["acc_lp_view", "acc_ref_link_copy", "setup_order_ref"]) expect(ev).toContain(`"${e}"`);
    expect(src("components/service-order-form.tsx")).toContain('if (ref) clarityEvent("setup_order_ref");');
    expect(src("components/clarity-on-view.tsx")).toContain("clarityEvent(name)");
    for (const f of ["components/clarity-on-view.tsx", "components/cabinet/cabinet-app.tsx", "components/service-order-form.tsx"]) expect(src(f), f).not.toMatch(/window\.(gtag|fbq|clarity)/);
  });

  it("gate: the order form tells the client they came via an accountant and that the price is the same", () => {
    expect(src("components/service-order-form.tsx")).toContain("Přišli jste přes odkaz účetní kanceláře. Za dokončené nastavení od nás kancelář dostane");
  });
});

describe("S11 – privacy policy", () => {
  it("gate: cookie ez_ucetni_ref, stored order records with the office code, PRIVACY_VERSION 2026-11-03-s11", async () => {
    const { default: Zasady } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const text = pageText(Zasady);
    expect(text).toContain("kód kanceláře uložíme do funkční cookie ez_ucetni_ref na 90 dní, platné jen pro tuto stránku");
    expect(text).toContain("záznam poptávky (e-mail, IČO, název firmy, počet provozoven, stav vyřízení) ukládáme");
    expect(text).toContain("Záznam poptávky 12 měsíců od poslední změny jejího stavu.");
    expect(text).not.toContain("zvláštní databázi poptávek nevedeme");
    const legal = await import("@/lib/legal");
    expect(legal.PRIVACY_VERSION).toBe("2026-11-03-s11");
    expect(legal.PRIVACY_VERSION_LABEL).toBe("3. 11. 2026");
    expect(legal.PRIVACY_DATE_ISO).toBe("2026-11-03");
    expect(legal.RETENTION.serviceOrderMonths).toBe(12);
  });
});
