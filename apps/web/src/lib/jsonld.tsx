import { OPERATOR, SITE, SITE_URL, absoluteUrl } from "./site";

type Ld = Record<string, unknown>;

/** Bezpečné vložení JSON-LD (escapuje "<" proti uzavření <script>). */
export function JsonLd({ data }: { data: Ld | Ld[] }) {
  const json = JSON.stringify(Array.isArray(data) ? data : data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function organizationLd(): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE.name,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    email: SITE.email,
    description: SITE.description,
    parentOrganization: {
      "@type": "Organization",
      name: OPERATOR.name,
      ...(OPERATOR.ico ? { identifier: OPERATOR.ico, taxID: OPERATOR.ico } : {}),
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
    url: absoluteUrl("/pokladna"),
    inLanguage: "cs-CZ",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CZK" },
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
  reviewer?: string;
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
    author: a.author ? { "@type": "Person", name: a.author } : { "@id": `${SITE_URL}/#organization` },
    ...(a.reviewer ? { reviewedBy: { "@type": "Person", name: a.reviewer } } : {}),
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
