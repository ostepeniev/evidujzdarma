import { krajByCode } from "@ez/cz";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { aresUrl, establishmentPath, firmPath, inPublicRegister, justiceUrl } from "./paths";

type Ld = Record<string, unknown>;

interface LdFirm {
  ico: string;
  slug: string;
  name: string;
  legalForm?: string | null;
  isNaturalPerson?: boolean;
  dic: string | null;
  vatPayer: boolean | null;
  foundedAt: string | null;
  dissolvedAt: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  regionCode: number | null;
}

function postalAddress(a: { street: string | null; city: string | null; postalCode: string | null; regionCode: number | null }): Ld | undefined {
  if (!a.city) return undefined;
  const kraj = krajByCode(a.regionCode);
  return {
    "@type": "PostalAddress",
    ...(a.street ? { streetAddress: a.street } : {}),
    addressLocality: a.city,
    ...(a.postalCode ? { postalCode: a.postalCode } : {}),
    ...(kraj ? { addressRegion: kraj.name } : {}),
    addressCountry: "CZ",
  };
}

/**
 * Organization jen z registrových polí (street/PSČ/DIČ u OSVČ přichází už jako null). S3:
 *  - u OSVČ nic osobního navíc: jen název, IČO a obec (bez data vzniku);
 *  - vatID jen u plátce DPH s DIČ z ARES; isicV4 ani naics neuvádíme (shodu CZ-NACE ↔ ISIC na úrovni třídy neověřujeme);
 *  - `path` = kanonická adresa stránky (u živého náhledu z ARES /firma/{IČO}).
 */
export function firmLd(firm: LdFirm, path: string = firmPath(firm)): Ld {
  const url = absoluteUrl(path);
  const natural = !!firm.isNaturalPerson;
  if (natural) {
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}#subjekt`,
      name: firm.name,
      url,
      identifier: { "@type": "PropertyValue", propertyID: "IČO", value: firm.ico },
      ...(firm.city ? { address: { "@type": "PostalAddress", addressLocality: firm.city, addressCountry: "CZ" } } : {}),
      sameAs: [aresUrl(firm.ico)],
    };
  }
  const address = postalAddress(firm);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}#subjekt`,
    name: firm.name,
    legalName: firm.name,
    url,
    identifier: { "@type": "PropertyValue", propertyID: "IČO", value: firm.ico },
    ...(firm.dic ? { taxID: firm.dic } : {}),
    ...(firm.dic && firm.vatPayer ? { vatID: firm.dic } : {}),
    ...(firm.foundedAt ? { foundingDate: firm.foundedAt } : {}),
    ...(firm.dissolvedAt ? { dissolutionDate: firm.dissolvedAt } : {}),
    ...(address ? { address } : {}),
    sameAs: [aresUrl(firm.ico), ...(inPublicRegister(firm.legalForm) ? [justiceUrl(firm.ico)] : [])],
  };
}

/** WebPage stránky subjektu: dateModified = den ověření v ARES (jen když údaje z ARES jsou), mainEntity = subjekt. */
export function firmPageLd(firm: LdFirm, opts: { path: string; title: string; description: string; verifiedAt: string | null }): Ld {
  const url = absoluteUrl(opts.path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#stranka`,
    url,
    name: opts.title,
    description: opts.description,
    inLanguage: "cs-CZ",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    ...(opts.verifiedAt ? { dateModified: opts.verifiedAt } : {}),
    mainEntity: { "@id": `${url}#subjekt` },
  };
}

export function establishmentLd(
  est: { icp: string; slug: string; name: string | null; street: string | null; city: string | null; postalCode: string | null; regionCode: number | null },
  firm: LdFirm,
): Ld {
  const url = absoluteUrl(establishmentPath(est));
  const address = postalAddress(est);
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#provozovna`,
    name: est.name ?? firm.name,
    url,
    identifier: { "@type": "PropertyValue", propertyID: "IČP", value: est.icp },
    ...(address ? { address } : {}),
    parentOrganization: { "@type": "Organization", "@id": `${absoluteUrl(firmPath(firm))}#subjekt`, name: firm.name },
  };
}

/** ItemList seznamových stránek (obor × obec, obec, kraj): jen jmenovitě uvedené právnické osoby. */
export function itemListLd(name: string, items: { name: string; path: string }[], total?: number): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    ...(total != null ? { numberOfItems: total } : {}),
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(it.path), name: it.name })),
  };
}
