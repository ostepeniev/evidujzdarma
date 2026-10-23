/**
 * S4-COOKIES (23. 10. 2026): měřicí a reklamní značky třetích stran. Všechno jsou VEŘEJNÉ identifikátory (vidí je každý
 * v kódu stránky) – nejsou to tajné klíče. Prázdný řetězec = značka vypnutá: nic se nenačte, CSP se nerozšíří a dokud
 * není zapnutá žádná, web nemá cookies třetích stran ani lištu cookies (lib/consent.ts).
 *
 * Kde ID vzít:
 *  - GA4_ID: Google Analytics → Správce → Datové toky → web → „ID měření“ (G-XXXXXXXXXX).
 *  - GOOGLE_ADS_ID: Google Ads → Nástroje → Konverze → značka Google → „ID značky“ (AW-XXXXXXXXXX).
 *  - META_PIXEL_ID: Meta Events Manager → Zdroje dat → pixel → „ID datové sady / pixelu“ (15–16 číslic).
 *  - SKLIK_RTG_ID: Sklik → Nástroje → Retargeting → kód retargetingu → číslo „rtgId“.
 *  - CLARITY_ID: Microsoft Clarity → projekt → Settings → Overview → „Project ID“ (10 znaků, malá písmena a číslice).
 * Po vyplnění: deploy. Zásady ochrany osobních údajů (sekce Cookies) se doplní samy podle zapnutých značek; zvyšte ale
 * PRIVACY_VERSION v lib/legal.ts a CONSENT_VERSION v lib/consent.ts (nový souhlas pro nové značky).
 */
export const TRACKING = {
  GA4_ID: "",
  GOOGLE_ADS_ID: "",
  META_PIXEL_ID: "",
  SKLIK_RTG_ID: "",
  /** S4b (23. 10. 2026): Microsoft Clarity – záznamy průchodu a teplotní mapy, kategorie „Analytické“ (projekt EvidujZdarma). */
  CLARITY_ID: "z292l24goy",
} as const;

export interface TrackingConfig {
  GA4_ID: string;
  GOOGLE_ADS_ID: string;
  META_PIXEL_ID: string;
  SKLIK_RTG_ID: string;
  CLARITY_ID: string;
}

const ID_FORMAT: Record<keyof TrackingConfig, RegExp> = {
  GA4_ID: /^G-[A-Z0-9]{4,16}$/,
  GOOGLE_ADS_ID: /^AW-\d{6,14}$/,
  META_PIXEL_ID: /^\d{10,20}$/,
  SKLIK_RTG_ID: /^\d{3,12}$/,
  CLARITY_ID: /^[a-z0-9]{8,12}$/,
};

/** Neplatné ID se chová jako prázdné (překlep nesmí rozbít CSP ani načíst cizí skript). */
export function validId(key: keyof TrackingConfig, cfg: TrackingConfig = TRACKING): string {
  const v = cfg[key].trim();
  return ID_FORMAT[key].test(v) ? v : "";
}

export interface ConfiguredTracking {
  ga4: string;
  googleAds: string;
  metaPixel: string;
  sklik: string;
  clarity: string;
  /** Analytické: GA4, Microsoft Clarity */
  analytics: boolean;
  /** Marketingové: Google Ads, Meta Pixel, Sklik */
  marketing: boolean;
  any: boolean;
}

export function configuredTracking(cfg: TrackingConfig = TRACKING): ConfiguredTracking {
  const ga4 = validId("GA4_ID", cfg);
  const googleAds = validId("GOOGLE_ADS_ID", cfg);
  const metaPixel = validId("META_PIXEL_ID", cfg);
  const sklik = validId("SKLIK_RTG_ID", cfg);
  const clarity = validId("CLARITY_ID", cfg);
  const analytics = !!(ga4 || clarity);
  const marketing = !!(googleAds || metaPixel || sklik);
  return { ga4, googleAds, metaPixel, sklik, clarity, analytics, marketing, any: analytics || marketing };
}
