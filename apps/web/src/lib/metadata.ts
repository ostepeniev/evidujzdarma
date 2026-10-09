import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/**
 * Společná og: pole z kořenového layoutu. Next slučuje openGraph mělce – stránka, která ho nastaví, přepíše celý objekt
 * z layoutu, takže je musí nést sama.
 */
/** Obrázek z app/opengraph-image.tsx – Next ho přidává jen kořenové vrstvě, stránka s vlastním openGraph ho musí nést sama (рецензія №7). */
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE.name} – evidence tržeb EET 2.0` };
export const OG_DEFAULTS = { type: "website" as const, locale: "cs_CZ", siteName: SITE.name, images: [OG_IMAGE] };

/**
 * Kanonická adresa stránky a og:url z jedné cesty, aby se nerozešly (R9.13): Facebook bere og:url jako adresu příspěvku,
 * takže sdílený odkaz na /cenik se nesmí ukázat jako úvodní stránka. Kořenový layout og:url nemá – stránka bez kanonické
 * adresy ho nezdědí. `openGraph` = pole navíc (type „article“, title, modifiedTime…); url přepsat nejde.
 */
export function canonicalMeta(path: string, openGraph?: OpenGraph): Pick<Metadata, "alternates" | "openGraph"> {
  return { alternates: { canonical: path }, openGraph: { ...OG_DEFAULTS, ...openGraph, url: path } as OpenGraph };
}

/**
 * Adresa úvodní stránky – stejná v canonical, og:url i v sitemap (R14.7). Next u cesty „/“ koncové lomítko vždy zahodí
 * (resolveAbsoluteUrlWithPathname vrací origin), proto úvodní stránka canonical a og:url nebere z metadat, ale vypíše je
 * sama jako <link>/<meta> (React je přesune do <head>).
 */
export const HOME_URL = absoluteUrl("/");

/** og: pole úvodní stránky – bez url, to vypisuje stránka (HOME_URL). */
export function homeMeta(): Pick<Metadata, "openGraph"> {
  return { openGraph: { ...OG_DEFAULTS } };
}
