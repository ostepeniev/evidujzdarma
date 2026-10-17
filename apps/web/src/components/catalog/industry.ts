import { INDUSTRIES } from "@/content/industries";

/**
 * Průvodce EET pro obor – jen revidované návody z content/guides (stránka katalogu je ukáže, jen když je návod
 * indexovaný, Ф9); obory bez vlastního návodu vedou na pilíř „EET 2.0: kompletní průvodce“.
 */
const GUIDE_BY_INDUSTRY: Record<string, { slug: string; label: string }> = {
  "kadernictvi-a-kosmetika": { slug: "eet-kadernictvi-kosmetika", label: "EET pro kadeřnictví a kosmetiku" },
  ubytovani: { slug: "eet-ubytovani", label: "EET pro ubytování" },
  "restaurace-a-kavarny": { slug: "eet-gastronomie", label: "EET v gastronomii" },
  maloobchod: { slug: "eet-trhy-stanky", label: "EET na trzích a ve stáncích" },
  "remeslnici-a-sluzby": { slug: "eet-remeslnici", label: "EET pro řemeslníky" },
};

/** Krátký název oboru do nadpisů „{obor} {obec} – EET 2.0“ (množné číslo, bez čárek). */
const HEADLINE: Record<string, string> = {
  "kadernictvi-a-kosmetika": "Kadeřnictví a kosmetika",
  ubytovani: "Ubytování",
  "restaurace-a-kavarny": "Restaurace a kavárny",
  maloobchod: "Obchody a stánky",
  "remeslnici-a-sluzby": "Řemeslníci a služby",
  "wellness-a-sport": "Masáže, wellness a fitness",
  "zdravotni-sluzby": "Zdravotní služby",
  "kurzy-a-vzdelavani": "Kurzy a vzdělávání",
  "doprava-taxi": "Taxi a přeprava osob",
  "farmari-a-vyrobci": "Farmáři a výrobci potravin",
};

export interface CatalogIndustry {
  slug: string;
  label: string;
  /** do nadpisů stránek obor × obec */
  headline: string;
  nace: readonly string[];
  guide: { href: string; label: string; slug: string } | null;
}

/** Obory s CZ-NACE prefixy (bez „Jiný obor“) pro stránky obor × kraj a obor × obec. */
export const CATALOG_INDUSTRIES: readonly CatalogIndustry[] = INDUSTRIES.filter((i) => i.nace.length > 0).map((i) => {
  const g = GUIDE_BY_INDUSTRY[i.slug];
  return {
    slug: i.slug,
    label: i.label,
    headline: HEADLINE[i.slug] ?? i.label,
    nace: i.nace,
    guide: g ? { href: `/navody/${g.slug}`, label: g.label, slug: g.slug } : null,
  };
});

export function catalogIndustry(slug: string): CatalogIndustry | undefined {
  return CATALOG_INDUSTRIES.find((i) => i.slug === slug);
}

/** První obor katalogu, do kterého subjekt podle CZ-NACE patří (pořadí CATALOG_INDUSTRIES). */
export function industryOfNace(nace: readonly string[]): CatalogIndustry | undefined {
  return CATALOG_INDUSTRIES.find((i) => i.nace.some((p) => nace.some((c) => c.startsWith(p))));
}
