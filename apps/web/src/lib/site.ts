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
  /** profily EvidujZdarma na sociálních sítích – sameAs v JSON-LD organizace (R8.11) */
  social: ["https://www.facebook.com/profile.php?id=61595251222968", "https://www.linkedin.com/company/146665642/"],
} as const;

/**
 * Provozovatel (§ 435 OZ) – veřejné údaje z obchodního rejstříku (ARES/VR, ověřeno 2. 10. 2026).
 * Jsou v kódu, ne v env: musí být na webu, v podmínkách i v každém e-mailu vždy (Р9).
 */
export const OPERATOR = {
  name: "Swipe Scape s.r.o.",
  ico: "22269134",
  dic: "CZ22269134",
  address: "Chebská 38/5, Dvory, 360 06 Karlovy Vary",
  registry: "zapsaná v obchodním rejstříku vedeném Krajským soudem v Plzni, oddíl C, vložka 47634",
} as const;

/** Úplná identifikace provozovatele na jednom řádku (patička, podmínky, e-maily). */
export function operatorLine(): string {
  return `${OPERATOR.name}, IČO ${OPERATOR.ico}, DIČ ${OPERATOR.dic}, se sídlem ${OPERATOR.address}, ${OPERATOR.registry}`;
}

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
