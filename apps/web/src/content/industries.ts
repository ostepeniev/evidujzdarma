/** Obory pro formuláře a programové stránky. `nace` = prefixy CZ-NACE. */
export const INDUSTRIES = [
  { slug: "kadernictvi-a-kosmetika", label: "Kadeřnictví, kosmetika, barber", nace: ["9602"] },
  { slug: "ubytovani", label: "Ubytování", nace: ["55"] },
  { slug: "restaurace-a-kavarny", label: "Restaurace, kavárna, bistro", nace: ["56"] },
  { slug: "maloobchod", label: "Obchod, stánek, trhy", nace: ["47"] },
  { slug: "remeslnici-a-sluzby", label: "Řemesla a služby u zákazníka", nace: ["43", "452", "812", "952"] },
  { slug: "wellness-a-sport", label: "Masáže, wellness, fitness", nace: ["9604", "93"] },
  { slug: "zdravotni-sluzby", label: "Zdravotní a terapeutické služby", nace: ["86"] },
  { slug: "kurzy-a-vzdelavani", label: "Kurzy, lekce, vzdělávání", nace: ["855"] },
  { slug: "doprava-taxi", label: "Taxi a přeprava osob", nace: ["4932"] },
  { slug: "farmari-a-vyrobci", label: "Farmář, výrobce, prodej ze dvora", nace: ["01", "10"] },
  { slug: "jine", label: "Jiný obor", nace: [] },
] as const;

export type IndustrySlug = (typeof INDUSTRIES)[number]["slug"];
export const INDUSTRY_SLUGS = INDUSTRIES.map((i) => i.slug) as [IndustrySlug, ...IndustrySlug[]];
