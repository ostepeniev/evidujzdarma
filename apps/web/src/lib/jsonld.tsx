import { isClosed } from "@/lib/launch";
import { OPERATOR, SITE, SITE_URL, absoluteUrl } from "./site";

type Ld = Record<string, unknown>;

/** Bezpečné vložení JSON-LD (escapuje "<" proti uzavření <script>). */
export function JsonLd({ data }: { data: Ld | Ld[] }) {
  const json = JSON.stringify(Array.isArray(data) ? data : data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/**
 * Dostupnost nabídky ve strukturovaných datech (R8.9): dokud je pokladna zavřená, je všechno předobjednávka; po otevření
 * tarif Zdarma InStock, placené doplňky PreOrder, dokud nejsou v kódu.
 */
export function offerAvailability(free: boolean): string {
  return !isClosed("/pokladna") && free ? "https://schema.org/InStock" : "https://schema.org/PreOrder";
}

/** Obrázky produktu pro strukturovaná data – PNG (ikona 512 a OG obrázek), ne SVG (R8.9). */
export const PRODUCT_IMAGES = (): string[] => [absoluteUrl("/icons/512"), absoluteUrl("/opengraph-image")];

export function organizationLd(): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE.name,
    url: SITE_URL,
    // Google bere jako logo bitmapu, ne SVG (R8.9)
    logo: absoluteUrl("/icons/512"),
    email: SITE.email,
    description: SITE.description,
    // profily na sociálních sítích, aby je vyhledávače spojily s webem (R8.11)
    sameAs: [...SITE.social],
    parentOrganization: {
      "@type": "Organization",
      name: OPERATOR.name,
      identifier: OPERATOR.ico,
      taxID: OPERATOR.dic,
      address: OPERATOR.address,
    },
  };
}

export function websiteLd(): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE.name,
    url: SITE_URL,
    inLanguage: "cs-CZ",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/kontrola-ico?ico={ico}`,
      "query-input": "required name=ico",
    },
  };
}

export function softwareApplicationLd(): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EvidujZdarma – pokladna pro EET 2.0",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android, iOS, Windows, macOS",
    // dokud je pokladna za heslem, odkaz vede na úvodní stránku s předregistrací (R7.6)
    url: absoluteUrl(isClosed("/pokladna") ? "/" : "/pokladna"),
    inLanguage: "cs-CZ",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CZK", availability: offerAvailability(true) },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function faqLd(items: readonly { q: string; a: string }[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function breadcrumbLd(items: readonly { name: string; path: string }[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function articleLd(a: {
  title: string;
  description: string;
  path: string;
  published: string;
  modified: string;
  author?: string;
  /** kdo text odborně revidoval (R8.10: s funkcí a odkazem na stránku o revizi) */
  reviewer?: { name: string; jobTitle?: string; url?: string; description?: string };
}): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    mainEntityOfPage: absoluteUrl(a.path),
    datePublished: a.published,
    dateModified: a.modified,
    inLanguage: "cs-CZ",
    // PNG 1200 × 630 (R8.10) – Google pro článek chce obrázek široký aspoň 1200 px
    image: [absoluteUrl("/opengraph-image")],
    author: a.author ? { "@type": "Person", name: a.author } : { "@id": `${SITE_URL}/#organization` },
    ...(a.reviewer ? { reviewedBy: { "@type": "Person", ...a.reviewer } } : {}),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function howToLd(h: { name: string; description: string; steps: readonly { name: string; text: string }[] }): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: h.name,
    description: h.description,
    step: h.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
  };
}
