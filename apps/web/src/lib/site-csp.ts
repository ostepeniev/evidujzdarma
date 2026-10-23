import { TRACKING, configuredTracking, type TrackingConfig } from "./tracking-config";

/**
 * Globální CSP marketingových stránek (next.config.ts; pokladna a další citlivé stránky mají vlastní přísnou CSP
 * s nonce v src/proxy.ts). S4-COOKIES: domény Google / Meta / Seznam se přidají JEN pro značky, které mají ID
 * v lib/tracking-config.ts. Dokud jsou ID prázdná, je CSP přesně stejná jako předtím (hlídá test s4-cookies).
 * Import relativně – next.config.ts nezná alias „@/“.
 */
export function trackingCspSources(cfg: TrackingConfig = TRACKING): { script: string[]; connect: string[]; img: string[]; frame: string[] } {
  const t = configuredTracking(cfg);
  const script = new Set<string>();
  const connect = new Set<string>();
  const img = new Set<string>();
  const frame = new Set<string>();
  // Google (GA4, Google Ads) – podle návodu Google „Content Security Policy“ pro značku Google
  if (t.ga4 || t.googleAds) {
    script.add("https://www.googletagmanager.com");
    for (const d of ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com"]) connect.add(d);
    for (const d of ["https://www.googletagmanager.com", "https://*.google-analytics.com"]) img.add(d);
  }
  if (t.googleAds) {
    script.add("https://www.googleadservices.com");
    script.add("https://googleads.g.doubleclick.net");
    script.add("https://www.google.com");
    for (const d of ["https://*.g.doubleclick.net", "https://www.google.com", "https://www.google.cz", "https://www.googleadservices.com"]) {
      connect.add(d);
      img.add(d);
    }
    frame.add("https://td.doubleclick.net");
    frame.add("https://www.googletagmanager.com");
  }
  if (t.metaPixel) {
    script.add("https://connect.facebook.net");
    connect.add("https://www.facebook.com");
    connect.add("https://connect.facebook.net");
    img.add("https://www.facebook.com");
    frame.add("https://www.facebook.com");
  }
  if (t.sklik) {
    script.add("https://c.seznam.cz");
    for (const d of ["https://c.seznam.cz", "https://h.seznam.cz"]) {
      connect.add(d);
      img.add(d);
    }
  }
  return { script: [...script], connect: [...connect], img: [...img], frame: [...frame] };
}

const join = (base: string, extra: string[]) => (extra.length ? `${base} ${extra.join(" ")}` : base);

export function siteCsp(cfg: TrackingConfig = TRACKING): string {
  const s = trackingCspSources(cfg);
  return [
    "default-src 'self'",
    join("script-src 'self' 'unsafe-inline'", s.script),
    "style-src 'self' 'unsafe-inline'",
    join("img-src 'self' data: blob:", s.img),
    "font-src 'self' data:",
    join("connect-src 'self'", s.connect),
    ...(s.frame.length ? [`frame-src ${s.frame.join(" ")}`] : []),
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
