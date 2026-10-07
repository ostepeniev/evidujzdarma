import type { Guide } from "./types";
import { eet20KompletniPruvodce } from "./eet-2-0-kompletni-pruvodce";
import { eet20VsEet10 } from "./eet-2-0-vs-eet-1-0";
import { eetAPausalniDan } from "./eet-a-pausalni-dan";
import { eetBezInternetu } from "./eet-bez-internetu";
import { eetEshopDobirka } from "./eet-eshop-dobirka";
import { eetKadernictviKosmetika } from "./eet-kadernictvi-kosmetika";
import { eetOff } from "./eet-off";
import { eetRemeslnici } from "./eet-remeslnici";
import { eetTrhyStanky } from "./eet-trhy-stanky";
import { eetUbytovani } from "./eet-ubytovani";
import { evidencniJednotka } from "./evidencni-jednotka";
import { glosarEet } from "./glosar-eet";
import { jakAktivovatDisACertifikat } from "./jak-aktivovat-dis-a-certifikat";
import { kohoSeEetTyka } from "./koho-se-eet-tyka";
import { kontaktniPlatba } from "./kontaktni-platba";
import { musimVydavatUctenku } from "./musim-vydavat-uctenku";
import { pokladnaVMobiluZdarma } from "./pokladna-v-mobilu-zdarma";
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
  pokladnaVMobiluZdarma,
  pokutyEet,
  musimVydavatUctenku,
  trzbaZaJineho,
  eetUbytovani,
  eetRemeslnici,
  eetKadernictviKosmetika,
  eetTrhyStanky,
  eetEshopDobirka,
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

/**
 * Kdy se návod naposledy změnil: pozdější z `updated` a nejnovějšího záznamu historie změn (i revize je změna stránky –
 * R8.10). Pro sitemap (lastmod), JSON-LD dateModified a „Aktualizováno“; datum ověření faktů (FACTS_UPDATED) se tím nemění.
 */
export function guideModified(g: Guide): string {
  return [g.updated, ...(g.changelog ?? []).map((c) => c.date)].reduce((a, b) => (b > a ? b : a));
}
