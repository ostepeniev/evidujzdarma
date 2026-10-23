/**
 * S4-COOKIES (23. 10. 2026): vlastní souhlas s cookies (lib/consent.ts, components/consent/*).
 *  - bez ID značek se nic nemění: lišta se neukáže, CSP je stejná, zásady říkají „nepoužíváme“;
 *  - náhled /?cookies=preview ukáže lištu, ale nic neuloží ani nenačte;
 *  - první vrstva: jen „Souhlasím“ a „Nastavení“ (rozhodnutí majitele, DECISIONS К10), přepínač FIRST_LAYER_REJECT;
 *  - přepínače v nastavení vypnuté, před souhlasem žádný cizí skript, po souhlasu Consent Mode „granted“.
 */
import { readFileSync } from "node:fs";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  CONSENT_VERSION,
  FIRST_LAYER_REJECT,
  acceptAll,
  allowedTags,
  bannerMode,
  consentCategories,
  consentCookieString,
  gtagConsentUpdate,
  makeConsent,
  parseConsent,
  readCookie,
  rejectAll,
  serializeConsent,
} from "@/lib/consent";
import { configuredTracking, TRACKING, type TrackingConfig } from "@/lib/tracking-config";
import { siteCsp, trackingCspSources } from "@/lib/site-csp";
import { CookieBannerView, CookieSettingsView } from "@/components/consent/cookie-views";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";

const EMPTY: TrackingConfig = { GA4_ID: "", GOOGLE_ADS_ID: "", META_PIXEL_ID: "", SKLIK_RTG_ID: "" };
const FULL: TrackingConfig = { GA4_ID: "G-ABC123XYZ9", GOOGLE_ADS_ID: "AW-1234567890", META_PIXEL_ID: "123456789012345", SKLIK_RTG_ID: "123456" };
const OLD_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const day = new Date("2026-10-23T10:00:00Z");

afterEach(() => {
  vi.doUnmock("@/lib/tracking-config");
  vi.resetModules();
});

describe("S4-COOKIES – nothing changes until a tag ID is filled in", () => {
  it("gate: all IDs are empty now → no tags, no banner, CSP byte-identical to S3", () => {
    expect(TRACKING).toEqual(EMPTY);
    expect(configuredTracking().any).toBe(false);
    expect(bannerMode("", "")).toEqual({ show: false });
    expect(siteCsp()).toBe(OLD_CSP);
    expect(siteCsp(EMPTY)).toBe(OLD_CSP);
  });

  it("gate: the production next.config sends exactly siteCsp()", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { default: nextConfig } = await import("../next.config");
    const rules = await nextConfig.headers!();
    vi.unstubAllEnvs();
    const csp = rules.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toBe(OLD_CSP);
  });

  it("gate: an invalid ID behaves as empty (a typo must not open the CSP or load a script)", () => {
    expect(configuredTracking({ ...EMPTY, GA4_ID: "UA-123", META_PIXEL_ID: "abc" }).any).toBe(false);
  });

  it("gate: the privacy policy says no analytics/ad cookies yet and explains the consent cookie", async () => {
    const { default: Privacy } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const t = text(renderToStaticMarkup(createElement(Privacy as FC)));
    expect(t).toContain("Analytické ani reklamní cookies nepoužíváme; kdybychom to změnili, nejdřív vás požádáme o souhlas.");
    expect(t).toContain("Souhlas s cookies. Měřicí a reklamní nástroje třetích stran (Google, Meta, Seznam) načteme jen tehdy");
    expect(t).toContain(`do nezbytné cookie ${CONSENT_COOKIE} na 6 měsíců`);
    expect(t).toContain("tlačítkem „Nastavení cookies“ v patičce webu");
    expect(t).toContain("Teď žádný takový nástroj nepoužíváme, proto vám lištu cookies neukazujeme.");
    expect(t).not.toContain("Google Analytics 4");
    const { PRIVACY_VERSION, PRIVACY_DATE_ISO } = await import("@/lib/legal");
    expect(PRIVACY_VERSION).toBe("2026-10-23-s4");
    expect(PRIVACY_DATE_ISO).toBe("2026-10-23");
  });

  it("gate: the R15.3 card 3 text stays verbatim while no tag is on", async () => {
    const { WHY_FREE } = await import("@/content/why-free");
    expect(WHY_FREE.cards[2]!.text).toBe("Na webu nemáme reklamu ani sledovací cookies a vaše údaje nikomu neprodáváme.");
  });

  it("gate: the footer has no „Nastavení cookies“ without tags, and shows it with tags", () => {
    expect(renderToStaticMarkup(createElement(CookieSettingsButton))).toBe("");
    const html = renderToStaticMarkup(createElement(CookieSettingsButton, { config: FULL }));
    expect(html).toContain("Nastavení cookies");
    expect(html).toContain('type="button"');
    expect(src("components/site-footer.tsx")).toMatch(/col\.title === "O nás" && <CookieSettingsButton \/>/);
  });

  it("gate: the consent manager is on marketing pages only and renders no <script> on the server", async () => {
    expect(src("app/(site)/layout.tsx")).toMatch(/<ConsentManager \/>/);
    expect(src("app/(app)/layout.tsx")).not.toMatch(/ConsentManager/);
    expect(src("app/(admin)/admin/layout.tsx")).not.toMatch(/ConsentManager/);
    const { ConsentManager } = await import("@/components/consent/consent-manager");
    expect(renderToStaticMarkup(createElement(ConsentManager))).toBe("");
  });
});

describe("S4-COOKIES – the banner (first layer)", () => {
  it("gate: owner's decision – exactly two buttons, Souhlasím and Nastavení", () => {
    expect(FIRST_LAYER_REJECT).toBe(false);
    const html = renderToStaticMarkup(createElement(CookieBannerView, { firstLayerReject: FIRST_LAYER_REJECT }));
    const buttons = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]!.trim());
    expect(buttons.sort()).toEqual(["Nastavení", "Souhlasím"]);
    expect(html).toContain('class="btn-primary');
    expect(html).toContain('href="/ochrana-osobnich-udaju#cookies"');
    // lišta dole bez ztmavení, nad připnutým tlačítkem (z-40), na počítači karta vlevo dole
    expect(html).toMatch(/fixed inset-x-0 bottom-0 z-50/);
    expect(html).toMatch(/sm:left-4/);
    expect(html).toMatch(/safe-area-inset-bottom/);
    expect(html).not.toMatch(/bg-ink\/40/);
    expect(html).not.toMatch(/role="dialog"/);
  });

  it("gate: the owner's decision and its risk are recorded in DECISIONS К10", () => {
    const d = readFileSync(new URL("../../../docs/DECISIONS.md", import.meta.url), "utf8");
    const k10 = d.split("\n").find((l) => l.startsWith("- К10 "));
    expect(k10).toBeDefined();
    for (const s of ["«Souhlasím» і «Nastavení»", "FIRST_LAYER_REJECT", "ÚOOÚ", "EDPB", "ez_consent"]) expect(k10).toContain(s);
  });

  it("gate: FIRST_LAYER_REJECT = true adds a text „Odmítnout“ button (three in total)", () => {
    const html = renderToStaticMarkup(createElement(CookieBannerView, { firstLayerReject: true }));
    const buttons = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]!.trim());
    expect(buttons.sort()).toEqual(["Nastavení", "Odmítnout", "Souhlasím"]);
  });

  it("gate: ?cookies=preview shows the banner even without tags and marks it as a preview (nothing stored)", () => {
    expect(bannerMode("?cookies=preview", "", EMPTY)).toEqual({ show: true, preview: true });
    expect(bannerMode("?x=1&cookies=preview", `${CONSENT_COOKIE}=1.a1.m1.20261023`, FULL)).toEqual({ show: true, preview: true });
    const html = renderToStaticMarkup(createElement(CookieBannerView, { firstLayerReject: false, preview: true }));
    expect(html).toContain("Náhled – nic se neukládá ani nenačítá");
    // komponenta: v náhledu decide() nic nezapisuje ani nenačítá
    expect(src("components/consent/consent-manager.tsx")).toMatch(/if \(preview\) return; \/\/ náhled/);
  });

  it("gate: with tags the banner shows until a decision of the current version is stored", () => {
    expect(bannerMode("", "", FULL)).toEqual({ show: true, preview: false });
    expect(bannerMode("", `a=b; ${CONSENT_COOKIE}=${CONSENT_VERSION}.a0.m0.20261023`, FULL)).toEqual({ show: false });
    expect(bannerMode("", `${CONSENT_COOKIE}=${CONSENT_VERSION + 1}.a1.m1.20261023`, FULL)).toEqual({ show: true, preview: false });
  });
});

describe("S4-COOKIES – settings (second layer)", () => {
  it("gate: switches are off by default, necessary is locked on, buttons Povolit vše / Uložit výběr / Odmítnout vše", () => {
    const html = renderToStaticMarkup(
      createElement(CookieSettingsView, { categories: consentCategories(FULL), values: { analytics: false, marketing: false } }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const switches = [...html.matchAll(/role="switch" aria-checked="(true|false)"/g)].map((m) => m[1]);
    expect(switches).toEqual(["false", "false"]);
    expect(html).toContain("Vždy zapnuté");
    for (const b of ["Povolit vše", "Uložit výběr", "Odmítnout vše"]) expect(html).toContain(`>${b}</button>`);
  });

  it("gate: categories without a configured tag are hidden (preview shows all three)", () => {
    expect(consentCategories(EMPTY).map((c) => c.id)).toEqual(["necessary"]);
    expect(consentCategories({ ...EMPTY, META_PIXEL_ID: FULL.META_PIXEL_ID }).map((c) => c.id)).toEqual(["necessary", "marketing"]);
    expect(consentCategories(EMPTY, true).map((c) => c.id)).toEqual(["necessary", "analytics", "marketing"]);
    const mk = consentCategories({ ...EMPTY, SKLIK_RTG_ID: FULL.SKLIK_RTG_ID }).find((c) => c.id === "marketing")!;
    expect(mk.vendors).toEqual(["Sklik (Seznam.cz, a.s.)"]);
  });
});

describe("S4-COOKIES – stored decision and tags", () => {
  it("gate: ez_consent – compact value, round trip, version, invalid values", () => {
    const c = makeConsent(true, false, day, FULL);
    expect(serializeConsent(c)).toBe(`${CONSENT_VERSION}.a1.m0.20261023`);
    expect(parseConsent(serializeConsent(c))).toEqual(c);
    expect(parseConsent("2.a1.m1.20261023", 1)).toBeNull();
    for (const bad of ["", "1.a2.m0.20261023", "x", "1.a1.m0.2026-10-23", "1.a1.m0"]) expect(parseConsent(bad)).toBeNull();
    expect(readCookie(`foo=1; ${CONSENT_COOKIE}=1.a0.m1.20261023; bar=2`)).toBe("1.a0.m1.20261023");
  });

  it("gate: first-party cookie for 6 months, Path=/, SameSite=Lax, Secure on https", () => {
    const c = acceptAll(day, FULL);
    expect(CONSENT_MAX_AGE_DAYS).toBe(182);
    expect(consentCookieString(c, true)).toBe(`${CONSENT_COOKIE}=1.a1.m1.20261023; Max-Age=${182 * 86_400}; Path=/; SameSite=Lax; Secure`);
    expect(consentCookieString(c, false)).not.toContain("Secure");
    expect(consentCookieString(c, true)).not.toMatch(/Domain=/);
  });

  it("gate: consent only to what is configured; reject stores a refusal", () => {
    expect(acceptAll(day, { ...EMPTY, GA4_ID: FULL.GA4_ID })).toMatchObject({ analytics: true, marketing: false });
    expect(rejectAll(day, FULL)).toMatchObject({ analytics: false, marketing: false });
  });

  it("gate: no third-party script before consent; after „Souhlasím“ Consent Mode update is granted", () => {
    expect(allowedTags(null, FULL)).toEqual([]);
    expect(allowedTags(rejectAll(day, FULL), FULL)).toEqual([]);
    const yes = acceptAll(day, FULL);
    expect(allowedTags(yes, FULL)).toEqual(["gtag", "meta", "sklik"]);
    expect(gtagConsentUpdate(yes)).toEqual({ ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
    expect(gtagConsentUpdate(makeConsent(true, false, day, FULL))).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });
    expect(allowedTags(makeConsent(false, true, day, { ...EMPTY, GOOGLE_ADS_ID: FULL.GOOGLE_ADS_ID }), FULL)).toEqual(["gtag", "meta", "sklik"]);
    // pořadí v kódu: výchozí „denied“ před konfigurací, skripty jen přes apply() po rozhodnutí
    const m = src("components/consent/consent-manager.tsx");
    expect(m.indexOf('window.gtag("consent", "default"')).toBeLessThan(m.indexOf('window.gtag("config"'));
    expect(m).not.toMatch(/<script/);
  });

  it("gate: CSP opens only the domains of configured tags", () => {
    const meta = siteCsp({ ...EMPTY, META_PIXEL_ID: FULL.META_PIXEL_ID });
    expect(meta).toContain("script-src 'self' 'unsafe-inline' https://connect.facebook.net");
    expect(meta).not.toContain("googletagmanager");
    expect(meta).not.toContain("seznam");
    const full = siteCsp(FULL);
    for (const d of ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.g.doubleclick.net", "https://www.googleadservices.com", "https://connect.facebook.net", "https://www.facebook.com", "https://c.seznam.cz", "https://h.seznam.cz"]) {
      expect(full).toContain(d);
    }
    expect(full).toMatch(/frame-src https:\/\/td\.doubleclick\.net/);
    expect(trackingCspSources(EMPTY)).toEqual({ script: [], connect: [], img: [], frame: [] });
  });
});

describe("S4-COOKIES – with tags switched on (simulated)", () => {
  it("gate: the privacy policy lists exactly the configured vendors and the why-free card changes", async () => {
    vi.resetModules();
    vi.doMock("@/lib/tracking-config", async (orig) => {
      const real = await orig<typeof import("@/lib/tracking-config")>();
      const cfg = { ...EMPTY, GA4_ID: FULL.GA4_ID, META_PIXEL_ID: FULL.META_PIXEL_ID };
      return { ...real, TRACKING: cfg, configuredTracking: (c = cfg) => real.configuredTracking(c) };
    });
    const { default: Privacy } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const t = text(renderToStaticMarkup(createElement(Privacy as FC)));
    expect(t).toContain("Analytické a reklamní cookies používáme jen s vaším souhlasem – podrobnosti níže.");
    expect(t).toContain("Google Analytics 4");
    expect(t).toContain("Meta Pixel");
    expect(t).toContain("EU-U.S. Data Privacy Framework");
    expect(t).not.toContain("Google Ads");
    expect(t).not.toContain("Sklik");
    expect(t).not.toContain("Teď žádný takový nástroj nepoužíváme");
    const { WHY_FREE } = await import("@/content/why-free");
    expect(WHY_FREE.cards[2]!.text).not.toContain("ani sledovací cookies");
    const { bannerMode: bm } = await import("@/lib/consent");
    expect(bm("", "")).toEqual({ show: true, preview: false });
  });
});
