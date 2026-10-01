export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://evidujzdarma.cz").replace(/\/$/, "");

export const SITE = {
  name: "EvidujZdarma",
  domain: "evidujzdarma.cz",
  url: SITE_URL,
  tagline: "Evidence tržeb EET 2.0 zdarma",
  description:
    "Bezplatná pokladna pro EET 2.0: funguje i bez signálu, až 5 uživatelů, účtenka e-mailem i QR. Nezávislá služba, není provozována Finanční správou.",
  email: "ahoj@evidujzdarma.cz",
  independenceNotice: "Nezávislá služba, není provozována Finanční správou.",
} as const;

/**
 * Provozovatel. Údaje se zobrazují v patičce a v "O nás" — DOPLŇTE skutečné IČO a adresu
 * před spuštěním. Prázdné hodnoty se nevykreslí (nevymýšlíme údaje).
 */
export const OPERATOR = {
  name: "Swipe Scape s.r.o.",
  ico: process.env.NEXT_PUBLIC_OPERATOR_ICO ?? "",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? "",
  registry: process.env.NEXT_PUBLIC_OPERATOR_REGISTRY ?? "",
} as const;

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const NAV = [
  { href: "/kontrola-ico", label: "Kontrola IČO" },
  { href: "/navody", label: "Návody EET" },
  { href: "/nastroje", label: "Nástroje" },
  { href: "/ucetni", label: "Pro účetní" },
  { href: "/srovnani/moje-eet", label: "Srovnání" },
] as const;
