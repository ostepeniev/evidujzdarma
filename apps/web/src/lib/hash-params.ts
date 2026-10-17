import { icoParam } from "./ico-param";

/**
 * Údaje pro cílovou stránku ve fragmentu adresy (#ico=12345679, #registrace&ico=12345679), ne v query (?ico=).
 * Fragment se na server neposílá a roboti ho neprocházejí, takže odkazy z milionu stránek firem nevytvoří
 * milion nových URL (COMMON 9, robots.txt). Stránka si fragment přečte až v prohlížeči.
 */

/** "#registrace&ico=12345679" → { anchor: "registrace", params: ico=12345679 } (kotva = část bez „=“). */
export function parseHash(hash: string): { anchor: string | null; params: URLSearchParams } {
  const raw = hash.replace(/^#/, "");
  const params = new URLSearchParams();
  let anchor: string | null = null;
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) {
      anchor ??= safeDecode(part);
      continue;
    }
    params.append(safeDecode(part.slice(0, eq)), safeDecode(part.slice(eq + 1)));
  }
  return { anchor, params };
}

/** IČO z fragmentu – jen přesně 8 číslic s platnou kontrolní číslicí (stejně jako ?ico=, R14.2). */
export function icoFromHash(hash: string, key = "ico"): string | null {
  return icoParam(parseHash(hash).params.get(key));
}

/** Kontrola IČO pro konkrétní subjekt – odkaz z katalogu a nástrojů. */
export function kontrolaIcoHref(ico: string): string {
  return `/kontrola-ico#ico=${ico}`;
}

/** Předregistrace / přihlášení na úvodní stránce s IČO (formulář si ho doplní a sjede na #registrace). */
export function registraceHref(ico?: string): string {
  return ico ? `/#registrace&ico=${ico}` : "/#registrace";
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/**
 * Fragment s parametry (#registrace&ico=…) neodpovídá žádnému id, takže prohlížeč sám nesjede ke kotvě – uděláme to my.
 * Volat jen v prohlížeči (useEffect).
 */
export function scrollToHashAnchor(hash: string = window.location.hash): void {
  const { anchor, params } = parseHash(hash);
  if (!anchor || [...params.keys()].length === 0) return;
  document.getElementById(anchor)?.scrollIntoView();
}

/** Cíl po přihlášení z úvodní stránky: IČO z fragmentu (#registrace&ico=…) do kroku „Firma“ (?ico=, R18.1). */
export function withHashIco(redirectTo: string, hash: string): string {
  if (redirectTo !== "/pokladna/nastaveni") return redirectTo;
  const ico = icoFromHash(hash);
  return ico ? `${redirectTo}?ico=${ico}` : redirectTo;
}
