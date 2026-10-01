import type { Guide } from "./types";
import { eet20KompletniPruvodce } from "./eet-2-0-kompletni-pruvodce";
import { eet20VsEet10 } from "./eet-2-0-vs-eet-1-0";
import { eetAPausalniDan } from "./eet-a-pausalni-dan";
import { eetBezInternetu } from "./eet-bez-internetu";
import { eetKadernictviKosmetika } from "./eet-kadernictvi-kosmetika";
import { eetOff } from "./eet-off";
import { eetRemeslnici } from "./eet-remeslnici";
import { eetUbytovani } from "./eet-ubytovani";
import { evidencniJednotka } from "./evidencni-jednotka";
import { glosarEet } from "./glosar-eet";
import { jakAktivovatDisACertifikat } from "./jak-aktivovat-dis-a-certifikat";
import { kohoSeEetTyka } from "./koho-se-eet-tyka";
import { kontaktniPlatba } from "./kontaktni-platba";
import { musimVydavatUctenku } from "./musim-vydavat-uctenku";
import { pokutyEet } from "./pokuty-eet";
import { trzbaZaJineho } from "./trzba-za-jineho";

/**
 * Registr návodů. Nový návod: vytvořte soubor `<slug>.ts` exportující `Guide`
 * a přidejte ho sem. Pořadí = pořadí v přehledu.
 */
export const GUIDES: readonly Guide[] = [
  eet20KompletniPruvodce,
  kohoSeEetTyka,
  kontaktniPlatba,
  eetOff,
  eetAPausalniDan,
  evidencniJednotka,
  jakAktivovatDisACertifikat,
  eetBezInternetu,
  pokutyEet,
  musimVydavatUctenku,
  trzbaZaJineho,
  eetUbytovani,
  eetRemeslnici,
  eetKadernictviKosmetika,
  eet20VsEet10,
  glosarEet,
];

const BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

export function getGuide(slug: string): Guide | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Návody před odbornou revizí neindexujeme (princip „přesnost před objemem“).
 * GUIDES_INDEX_UNREVIEWED=1 indexuje i nerevidované — jen po rozhodnutí týmu.
 */
export function isIndexable(g: Guide): boolean {
  return !!g.reviewedBy || process.env.GUIDES_INDEX_UNREVIEWED === "1";
}
