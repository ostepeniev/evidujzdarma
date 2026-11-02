/**
 * S11: kód účetní kanceláře v odkazu /nastaveni-na-klic?ref=<kód>. Stránka ho uloží do funkční cookie (nezbytné pro
 * vyžádanou službu – připsat poptávku kanceláři, která ji doporučila; bez souhlasu, bez sledování): jen z parametru na té
 * stránce, s cestou omezenou na /nastaveni-na-klic, na 90 dní. Formulář poptávky ji pošle v těle požadavku jako `ref`;
 * server kód přijme jen tehdy, když patří existující účetní kanceláři. Zásady: „Cookies a úložiště v prohlížeči“.
 */
export const SETUP_REF_COOKIE = "ez_ucetni_ref";
export const SETUP_REF_MAX_AGE_DAYS = 90;
export const SETUP_REF_PATH = "/nastaveni-na-klic";
/** Tvar kódu kanceláře (accounts.partner_code) – stejná abeceda jako lib/server/tokens.ts shortCode. */
export const PARTNER_CODE_RE = /^[a-z0-9]{4,12}$/;

export const isPartnerCode = (v: unknown): v is string => typeof v === "string" && PARTNER_CODE_RE.test(v);

/** Hodnota cookie pro document.cookie (Secure jen na https, aby šla vyzkoušet i lokálně). */
export function setupRefCookie(code: string, secure: boolean): string {
  return `${SETUP_REF_COOKIE}=${code}; Max-Age=${SETUP_REF_MAX_AGE_DAYS * 86_400}; Path=${SETUP_REF_PATH}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Kód z cookie (document.cookie), nebo null. */
export function setupRefFromCookie(cookie: string): string | null {
  for (const part of cookie.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === SETUP_REF_COOKIE && isPartnerCode(v)) return v;
  }
  return null;
}
