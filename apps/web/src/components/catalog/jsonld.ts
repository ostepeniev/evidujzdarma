import { krajByCode } from "@ez/cz";
import { absoluteUrl } from "@/lib/site";
import { aresUrl, establishmentPath, firmPath } from "./paths";

type Ld = Record<string, unknown>;

interface LdFirm {
  ico: string;
  slug: string;
  name: string;
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

/** Organization jen z registrových polí (street/PSČ u OSVČ přichází už jako null). */
export function firmLd(firm: LdFirm): Ld {
  const url = absoluteUrl(firmPath(firm));
  const address = postalAddress(firm);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}#subjekt`,
    name: firm.name,
    url,
    identifier: { "@type": "PropertyValue", propertyID: "IČO", value: firm.ico },
    ...(firm.dic ? { taxID: firm.dic } : {}),
    ...(firm.dic && firm.vatPayer ? { vatID: firm.dic } : {}),
    ...(firm.foundedAt ? { foundingDate: firm.foundedAt } : {}),
    ...(firm.dissolvedAt ? { dissolutionDate: firm.dissolvedAt } : {}),
    ...(address ? { address } : {}),
    sameAs: [aresUrl(firm.ico)],
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
