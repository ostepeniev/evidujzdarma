/** Kraje ČR — kódy VÚSC dle RÚIAN (shodné s `sidlo.kodKraje` v ARES). */
export interface Kraj {
  code: number;
  slug: string;
  name: string;
  /** "v Karlovarském kraji" */
  locative: string;
}

export const KRAJE: readonly Kraj[] = [
  { code: 19, slug: "praha", name: "Hlavní město Praha", locative: "v Praze" },
  { code: 27, slug: "stredocesky", name: "Středočeský kraj", locative: "ve Středočeském kraji" },
  { code: 35, slug: "jihocesky", name: "Jihočeský kraj", locative: "v Jihočeském kraji" },
  { code: 43, slug: "plzensky", name: "Plzeňský kraj", locative: "v Plzeňském kraji" },
  { code: 51, slug: "karlovarsky", name: "Karlovarský kraj", locative: "v Karlovarském kraji" },
  { code: 60, slug: "ustecky", name: "Ústecký kraj", locative: "v Ústeckém kraji" },
  { code: 78, slug: "liberecky", name: "Liberecký kraj", locative: "v Libereckém kraji" },
  { code: 86, slug: "kralovehradecky", name: "Královéhradecký kraj", locative: "v Královéhradeckém kraji" },
  { code: 94, slug: "pardubicky", name: "Pardubický kraj", locative: "v Pardubickém kraji" },
  { code: 108, slug: "vysocina", name: "Kraj Vysočina", locative: "v kraji Vysočina" },
  { code: 116, slug: "jihomoravsky", name: "Jihomoravský kraj", locative: "v Jihomoravském kraji" },
  { code: 124, slug: "olomoucky", name: "Olomoucký kraj", locative: "v Olomouckém kraji" },
  { code: 132, slug: "moravskoslezsky", name: "Moravskoslezský kraj", locative: "v Moravskoslezském kraji" },
  { code: 141, slug: "zlinsky", name: "Zlínský kraj", locative: "ve Zlínském kraji" },
];

export function krajByCode(code: number | null | undefined): Kraj | undefined {
  return KRAJE.find((k) => k.code === code);
}

export function krajBySlug(slug: string): Kraj | undefined {
  return KRAJE.find((k) => k.slug === slug);
}
