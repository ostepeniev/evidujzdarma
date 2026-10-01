import { INDUSTRIES } from "@/content/industries";

/** Průvodce EET pro obor (pokud existuje), jinak obecný „Koho se EET týká“. */
const GUIDE_BY_INDUSTRY: Record<string, { href: string; label: string }> = {
  "kadernictvi-a-kosmetika": { href: "/navody/eet-kadernictvi-kosmetika", label: "EET pro kadeřnictví a kosmetiku" },
  ubytovani: { href: "/navody/eet-ubytovani", label: "EET pro ubytování" },
  "remeslnici-a-sluzby": { href: "/navody/eet-remeslnici", label: "EET pro řemeslníky" },
};

export interface CatalogIndustry {
  slug: string;
  label: string;
  nace: readonly string[];
  guide: { href: string; label: string } | null;
}

/** Obory s CZ-NACE prefixy (bez „Jiný obor“) pro stránky obor × kraj. */
export const CATALOG_INDUSTRIES: readonly CatalogIndustry[] = INDUSTRIES.filter((i) => i.nace.length > 0).map((i) => ({
  slug: i.slug,
  label: i.label,
  nace: i.nace,
  guide: GUIDE_BY_INDUSTRY[i.slug] ?? null,
}));

export function catalogIndustry(slug: string): CatalogIndustry | undefined {
  return CATALOG_INDUSTRIES.find((i) => i.slug === slug);
}
