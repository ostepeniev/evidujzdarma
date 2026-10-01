import type { Guide } from "./types";
import { eetBezInternetu } from "./eet-bez-internetu";

/**
 * Registr návodů. Nový návod: vytvořte soubor `<slug>.ts` exportující `Guide`
 * a přidejte ho sem. Pořadí = pořadí v přehledu.
 */
export const GUIDES: readonly Guide[] = [eetBezInternetu];

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
