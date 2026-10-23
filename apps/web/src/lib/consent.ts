import { TRACKING, configuredTracking, type TrackingConfig } from "./tracking-config";

/**
 * S4-COOKIES (23. 10. 2026): vlastní souhlas s cookies – bez služby třetí strany. Čistá logika (bez DOM), aby šla testovat;
 * komponenty jsou v components/consent/.
 *
 * Rozhodnutí majitele 23. 10. 2026 (docs/DECISIONS.md, К10): první vrstva lišty má jen „Souhlasím“ a „Nastavení“,
 * odmítnutí je v Nastavení. ÚOOÚ a EDPB (Cookie Banner Taskforce, 1/2023) očekávají odmítnutí už na první vrstvě –
 * při kontrole nebo stížnosti přepněte FIRST_LAYER_REJECT na true: na liště se objeví textové tlačítko „Odmítnout“.
 */
export const FIRST_LAYER_REJECT = false;

/** Zvyšte při změně kategorií nebo značek – lišta se pak zobrazí znovu všem. */
export const CONSENT_VERSION = 1;
export const CONSENT_COOKIE = "ez_consent";
/** 6 měsíců – pak se zeptáme znovu (obvyklá praxe; ÚOOÚ doporučuje souhlas po čase obnovit). */
export const CONSENT_MAX_AGE_DAYS = 182;
/** Náhled lišty pro majitele: /?cookies=preview – nic se neukládá ani nenačítá. */
export const PREVIEW_PARAM = "cookies";
export const PREVIEW_VALUE = "preview";
/** Událost, kterou tlačítko „Nastavení cookies“ v patičce otevře nastavení. */
export const OPEN_SETTINGS_EVENT = "ez:cookie-settings";

export interface Consent {
  /** verze lišty, ke které souhlas patří */
  v: number;
  analytics: boolean;
  marketing: boolean;
  /** den rozhodnutí YYYY-MM-DD */
  date: string;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Hodnota cookie: „1.a1.m0.20261023“ – verze, analytické, marketingové, den. Bez středníků a mezer. */
export function serializeConsent(c: Consent): string {
  return `${c.v}.a${c.analytics ? 1 : 0}.m${c.marketing ? 1 : 0}.${c.date.replaceAll("-", "")}`;
}

/** Neplatná nebo stará verze → null (zeptat se znovu). */
export function parseConsent(value: string | null | undefined, version: number = CONSENT_VERSION): Consent | null {
  if (!value) return null;
  const m = /^(\d+)\.a([01])\.m([01])\.(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const v = Number(m[1]);
  if (v !== version) return null;
  return { v, analytics: m[2] === "1", marketing: m[3] === "1", date: `${m[4]}-${m[5]}-${m[6]}` };
}

/** Hodnota cookie z hlavičky / document.cookie. */
export function readCookie(cookieHeader: string, name: string = CONSENT_COOKIE): string | null {
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Řetězec pro document.cookie – první strana, 6 měsíců, Path=/, SameSite=Lax, Secure na https. */
export function consentCookieString(c: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${serializeConsent(c)}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86_400}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function makeConsent(analytics: boolean, marketing: boolean, now: Date = new Date(), cfg: TrackingConfig = TRACKING): Consent {
  const t = configuredTracking(cfg);
  // souhlas jen s tím, co na webu opravdu je
  return { v: CONSENT_VERSION, analytics: analytics && t.analytics, marketing: marketing && t.marketing, date: isoDay(now) };
}

/** „Souhlasím“ / „Povolit vše“ – všechny zapnuté kategorie. */
export const acceptAll = (now?: Date, cfg?: TrackingConfig) => makeConsent(true, true, now, cfg);
/** „Odmítnout vše“ – jen nezbytné. Ukládá se taky, aby se lišta neukazovala znovu. */
export const rejectAll = (now?: Date, cfg?: TrackingConfig) => makeConsent(false, false, now, cfg);

export type BannerMode = { show: false } | { show: true; preview: boolean };

/**
 * Kdy lištu ukázat: náhled (?cookies=preview) vždy, jinak jen když je zapnutá aspoň jedna značka a návštěvník se ještě
 * nerozhodl (nebo se rozhodl ke staré verzi). Bez značek není k čemu souhlas dávat – lišta se neukáže.
 */
export function bannerMode(search: string, cookieHeader: string, cfg: TrackingConfig = TRACKING): BannerMode {
  if (new URLSearchParams(search).get(PREVIEW_PARAM) === PREVIEW_VALUE) return { show: true, preview: true };
  if (!configuredTracking(cfg).any) return { show: false };
  return parseConsent(readCookie(cookieHeader)) ? { show: false } : { show: true, preview: false };
}

/** Google Consent Mode v2 – výchozí stav: vše zamítnuto (posílá se před jakoukoli konfigurací). */
export const GTAG_CONSENT_DEFAULT = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

export type GtagConsent = Record<keyof typeof GTAG_CONSENT_DEFAULT, "granted" | "denied">;

/** Google Consent Mode v2 – aktualizace podle souhlasu. */
export function gtagConsentUpdate(c: Pick<Consent, "analytics" | "marketing">): GtagConsent {
  const m = c.marketing ? "granted" : "denied";
  return { ad_storage: m, ad_user_data: m, ad_personalization: m, analytics_storage: c.analytics ? "granted" : "denied" };
}

export type TagId = "gtag" | "meta" | "sklik";

/** Které značky smí běžet. Bez souhlasu (null) žádná – žádný cizí skript před souhlasem. */
export function allowedTags(c: Pick<Consent, "analytics" | "marketing"> | null, cfg: TrackingConfig = TRACKING): TagId[] {
  if (!c) return [];
  const t = configuredTracking(cfg);
  const out: TagId[] = [];
  if ((c.analytics && t.ga4) || (c.marketing && t.googleAds)) out.push("gtag");
  if (c.marketing && t.metaPixel) out.push("meta");
  if (c.marketing && t.sklik) out.push("sklik");
  return out;
}

export const TAG_SCRIPT_SRC: Record<TagId, (cfg: TrackingConfig) => string> = {
  gtag: (cfg) => {
    const t = configuredTracking(cfg);
    return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(t.ga4 || t.googleAds)}`;
  },
  meta: () => "https://connect.facebook.net/en_US/fbevents.js",
  sklik: () => "https://c.seznam.cz/js/rc.js",
};

/** Cookies, které značky třetích stran zakládají na naší doméně – po odvolání souhlasu je zkusíme smazat. */
export const THIRD_PARTY_COOKIE_PREFIXES = ["_ga", "_gid", "_gat", "_gcl_", "_fbp", "_fbc"] as const;

/** Kategorie v Nastavení – jen ty se zapnutou značkou (v náhledu všechny, ať je majitel vidí). */
export interface ConsentCategory {
  id: "necessary" | "analytics" | "marketing";
  title: string;
  text: string;
  vendors: string[];
  locked?: boolean;
}

export function consentCategories(cfg: TrackingConfig = TRACKING, preview = false): ConsentCategory[] {
  const t = configuredTracking(cfg);
  const cats: ConsentCategory[] = [
    {
      id: "necessary",
      title: "Nezbytné",
      text: "Přihlášení do účtu, hlasování v anketě a zapamatování této volby. Bez nich web nefunguje, proto jsou vždy zapnuté.",
      vendors: ["EvidujZdarma"],
      locked: true,
    },
  ];
  if (t.analytics || preview) {
    cats.push({
      id: "analytics",
      title: "Analytické",
      text: "Pomáhají nám zjistit, které stránky a nástroje lidem pomáhají a co zlepšit.",
      vendors: ["Google Analytics (Google Ireland Ltd.)"],
    });
  }
  if (t.marketing || preview) {
    const vendors = [
      ...(t.googleAds || preview ? ["Google Ads (Google Ireland Ltd.)"] : []),
      ...(t.metaPixel || preview ? ["Meta Pixel (Meta Platforms Ireland Ltd.)"] : []),
      ...(t.sklik || preview ? ["Sklik (Seznam.cz, a.s.)"] : []),
    ];
    cats.push({
      id: "marketing",
      title: "Marketingové",
      text: "Umožní nám měřit, zda naše reklama na Googlu, Facebooku, Instagramu a Seznamu funguje, a ukazovat ji lidem, kteří už naše stránky znají.",
      vendors,
    });
  }
  return cats;
}
