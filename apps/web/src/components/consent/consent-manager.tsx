"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FIRST_LAYER_REJECT,
  GTAG_CONSENT_DEFAULT,
  OPEN_SETTINGS_EVENT,
  TAG_SCRIPT_SRC,
  THIRD_PARTY_COOKIE_PREFIXES,
  acceptAll,
  allowedTags,
  clarityConsent,
  bannerMode,
  consentCategories,
  consentCookieString,
  gtagConsentUpdate,
  makeConsent,
  parseConsent,
  readCookie,
  rejectAll,
  type Consent,
  type TagId,
} from "@/lib/consent";
import { TRACKING, configuredTracking } from "@/lib/tracking-config";
import { CookieBannerView, CookieSettingsView } from "./cookie-views";

/**
 * S4-COOKIES: vlastní správa souhlasu (bez služby třetí strany) – jen na marketingových stránkách ((site)/layout.tsx).
 * Před souhlasem se nenačte žádný cizí skript. Google Consent Mode v2 v základním režimu: gtag.js až po souhlasu,
 * nejdřív „default: denied“, pak „update“ podle souhlasu. Meta Pixel a Sklik jen se souhlasem s marketingem.
 * Microsoft Clarity (S4b) jen se souhlasem s analytickými cookies; Consent API v2, ad_Storage vždy „denied“. Při odchodu
 * z marketingových stránek (pokladna, kabinet, přihlášení – jiný layout bez této komponenty) se Clarity zastaví
 * a po návratu znovu spustí; pokladna, kabinet a administrace mají navíc data-clarity-mask="true" (Clarity obsah skryje).
 * Náhled /?cookies=preview: lišta i nastavení fungují, ale nic se neuloží ani nenačte.
 */

type Fn = (...args: unknown[]) => void;
type FbqFn = Fn & { callMethod?: Fn; queue: unknown[][]; push: Fn; loaded: boolean; version: string };
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Fn;
    fbq?: FbqFn;
    _fbq?: FbqFn;
    rc?: { retargetingHit?: (conf: { rtgId: number; consent: 0 | 1 }) => void };
    clarity?: Fn & { q?: unknown[] };
  }
}

const cfg = TRACKING;
/**
 * Spuštěné značky – mimo komponentu: při přechodu na pokladnu a zpět (jiný layout) se komponenta odpojí a znovu připojí,
 * skripty ale v okně zůstávají a nesmí se načíst podruhé.
 */
const loadedTags = new Set<TagId>();
let clarityRunning = false;

function addScript(src: string, onLoad?: () => void): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  if (onLoad) s.addEventListener("load", onLoad);
  document.head.appendChild(s);
}

function initGtag(c: Consent): void {
  const t = configuredTracking(cfg);
  window.dataLayer = window.dataLayer ?? [];
  // gtag musí do dataLayer posílat objekt „arguments“ (tak ho čte gtag.js)
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", { ...GTAG_CONSENT_DEFAULT });
  window.gtag("consent", "update", gtagConsentUpdate(c));
  window.gtag("js", new Date());
  if (c.analytics && t.ga4) window.gtag("config", t.ga4, { send_page_view: false });
  if (c.marketing && t.googleAds) window.gtag("config", t.googleAds, { send_page_view: false });
  addScript(TAG_SCRIPT_SRC.gtag(cfg));
}

function initMeta(): void {
  const t = configuredTracking(cfg);
  if (!window.fbq) {
    const q = function (...args: unknown[]) {
      if (q.callMethod) q.callMethod(...args);
      else q.queue.push(args);
    } as FbqFn;
    q.queue = [];
    q.push = q;
    q.loaded = true;
    q.version = "2.0";
    window.fbq = q;
    window._fbq = q;
    addScript(TAG_SCRIPT_SRC.meta(cfg));
  }
  window.fbq("consent", "grant");
  window.fbq("init", t.metaPixel);
}

/** Clarity: stejná fronta jako v oficiálním kódu Microsoftu, pak souhlas, pak skript (fronta se zpracuje po načtení). */
function initClarity(c: Consent): void {
  if (!window.clarity) {
    const q = function clarity() {
      // eslint-disable-next-line prefer-rest-params
      (q.q = q.q ?? []).push(arguments);
    } as Fn & { q?: unknown[] };
    window.clarity = q;
  }
  window.clarity("consentv2", clarityConsent(c));
  addScript(TAG_SCRIPT_SRC.clarity(cfg));
  clarityRunning = true;
}

/** Odvolání souhlasu nebo odchod z marketingových stránek: Clarity přestane zaznamenávat. */
function stopClarity(revoke: boolean): void {
  if (!window.clarity || !clarityRunning) return;
  if (revoke) {
    window.clarity("consentv2", clarityConsent(null));
    // smaže cookies Clarity (_clck, _clsk) – podle dokumentace Microsoftu
    window.clarity("consent", false);
  }
  window.clarity("stop");
  clarityRunning = false;
}

function sklikHit(): void {
  const id = Number(configuredTracking(cfg).sklik);
  window.rc?.retargetingHit?.({ rtgId: id, consent: 1 });
}

/** Po odvolání souhlasu smažeme cookies značek, které jsou na naší doméně (cizí domény smazat nejde). */
function deleteThirdPartyCookies(): void {
  const host = window.location.hostname;
  const domains = ["", host, `.${host.replace(/^www\./, "")}`];
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]!.trim();
    if (!THIRD_PARTY_COOKIE_PREFIXES.some((p) => name.startsWith(p))) continue;
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ""}`;
  }
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConsentManager() {
  const pathname = usePathname();
  const [banner, setBanner] = useState(false);
  const [preview, setPreview] = useState(false);
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  const consentRef = useRef<Consent | null>(null);
  const firstPath = useRef(true);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const pageView = useCallback((only?: ReadonlySet<TagId>) => {
    const c = consentRef.current;
    if (!c) return;
    const t = configuredTracking(cfg);
    const want = (tag: TagId) => loadedTags.has(tag) && (!only || only.has(tag));
    // page_view jen značkám Google, ke kterým trvá souhlas (po odvolání nic, ani bez cookies)
    const sendTo = [...(c.analytics && t.ga4 ? [t.ga4] : []), ...(c.marketing && t.googleAds ? [t.googleAds] : [])];
    if (want("gtag") && window.gtag && sendTo.length) {
      window.gtag("event", "page_view", { send_to: sendTo, page_location: window.location.href, page_path: window.location.pathname, page_title: document.title });
    }
    if (want("meta") && c.marketing && window.fbq && t.metaPixel) window.fbq("track", "PageView");
    if (want("sklik") && c.marketing) sklikHit();
  }, []);

  /** Spustí značky podle souhlasu, u už běžících změní stav souhlasu. */
  const apply = useCallback(
    (prev: Consent | null, c: Consent) => {
      const allow = allowedTags(c, cfg);
      const fresh = new Set<TagId>();
      consentRef.current = c;
      // Google: první spuštění, nebo jen změna stavu souhlasu
      if (allow.includes("gtag") && !loadedTags.has("gtag")) {
        initGtag(c);
        loadedTags.add("gtag");
        fresh.add("gtag");
      } else if (loadedTags.has("gtag") && window.gtag) {
        window.gtag("consent", "update", gtagConsentUpdate(c));
        const t = configuredTracking(cfg);
        // kategorie zapnutá až teď – doplnit konfiguraci její značky
        if (c.analytics && !prev?.analytics && t.ga4) window.gtag("config", t.ga4, { send_page_view: false });
        if (c.marketing && !prev?.marketing && t.googleAds) window.gtag("config", t.googleAds, { send_page_view: false });
      }
      if (allow.includes("meta") && !loadedTags.has("meta")) {
        initMeta();
        loadedTags.add("meta");
        fresh.add("meta");
      } else if (!allow.includes("meta") && loadedTags.has("meta")) {
        window.fbq?.("consent", "revoke");
        loadedTags.delete("meta");
      }
      if (allow.includes("sklik") && !loadedTags.has("sklik")) {
        loadedTags.add("sklik");
        // první zásah až po načtení rc.js
        addScript(TAG_SCRIPT_SRC.sklik(cfg), sklikHit);
      } else if (!allow.includes("sklik")) {
        loadedTags.delete("sklik");
      }
      // Clarity: první spuštění; po návratu z pokladny nebo znovu udělený souhlas = znovu spustit; odvolání = zastavit
      if (allow.includes("clarity") && !loadedTags.has("clarity")) {
        initClarity(c);
        loadedTags.add("clarity");
      } else if (allow.includes("clarity") && window.clarity && !clarityRunning) {
        window.clarity("consentv2", clarityConsent(c));
        window.clarity("start");
        clarityRunning = true;
      } else if (!allow.includes("clarity")) {
        stopClarity(true);
      }
      if ((prev?.analytics && !c.analytics) || (prev?.marketing && !c.marketing)) deleteThirdPartyCookies();
      // úvodní page_view jen pro nově spuštěné značky
      if (fresh.size) pageView(fresh);
    },
    [pageView],
  );

  // první načtení: rozhodnutí z cookie, nebo lišta
  useEffect(() => {
    const mode = bannerMode(window.location.search, document.cookie, cfg);
    if (mode.show) {
      setPreview(mode.preview);
      setBanner(true);
      return;
    }
    const c = parseConsent(readCookie(document.cookie));
    if (c) apply(null, c);
  }, [apply]);

  // odchod z marketingových stránek (jiný layout): Clarity zastavit hned při odpojení, dřív než se vykreslí nová stránka
  useLayoutEffect(() => () => stopClarity(false), []);

  // tlačítko „Nastavení cookies“ v patičce
  useEffect(() => {
    const open = () => {
      const c = consentRef.current;
      setDraft({ analytics: c?.analytics ?? false, marketing: c?.marketing ?? false });
      returnFocus.current = document.activeElement as HTMLElement | null;
      setSettings(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  // nová stránka v aplikaci (bez znovunačtení) = page_view
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    pageView();
  }, [pathname, pageView]);

  // dialog: fokus dovnitř, Tab zůstane v okně, Esc zavře bez změny, pak fokus zpět
  useEffect(() => {
    if (!settings) return;
    const dlg = dialogRef.current;
    dlg?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSettings(false);
        return;
      }
      if (e.key !== "Tab" || !dlg) return;
      const items = [...dlg.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // fokus zpět; tlačítko „Nastavení“ na liště se mezitím vykreslilo znovu – pak na jeho novou kopii
      const back = returnFocus.current;
      if (back?.isConnected) back.focus();
      else document.querySelector<HTMLElement>('[data-cookie-banner] [data-cookie-action="settings"]')?.focus();
    };
  }, [settings]);

  const decide = (c: Consent) => {
    setSettings(false);
    setBanner(false);
    if (preview) return; // náhled: nic neukládat ani nenačítat
    document.cookie = consentCookieString(c, window.location.protocol === "https:");
    apply(consentRef.current, c);
  };

  const openSettings = () => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setDraft({ analytics: false, marketing: false });
    setSettings(true);
  };

  const configured = configuredTracking(cfg).any;
  if (!configured && !preview) return null;

  return (
    <>
      {banner && !settings && (
        <CookieBannerView
          firstLayerReject={FIRST_LAYER_REJECT}
          preview={preview}
          onAccept={() => decide(acceptAll(new Date(), cfg))}
          onSettings={openSettings}
          onReject={() => decide(rejectAll(new Date(), cfg))}
        />
      )}
      {settings && (
        <CookieSettingsView
          categories={consentCategories(cfg, preview)}
          values={draft}
          preview={preview}
          dialogRef={dialogRef}
          onToggle={(id) => setDraft((d) => ({ ...d, [id]: !d[id] }))}
          onAcceptAll={() => decide(acceptAll(new Date(), cfg))}
          onSave={() => decide(makeConsent(draft.analytics, draft.marketing, new Date(), cfg))}
          onRejectAll={() => decide(rejectAll(new Date(), cfg))}
          onClose={() => setSettings(false)}
        />
      )}
    </>
  );
}
