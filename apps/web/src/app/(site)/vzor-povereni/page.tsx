import type { Metadata } from "next";
import Link from "next/link";
import { AuthorizationGenerator } from "@/components/authorization-generator";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ReviewNote } from "@/components/review-note";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { SOURCES } from "@/content/facts";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S1 (17. 10. 2026): vzor pověření k evidování tržeb (§ 10 zákona č. 180/2026 Sb.). Právní text = před odbornou kontrolou
 * účetní noindex, mimo sitemap a rozcestník nástrojů (obdoba Ф9 u návodů). Po jejím „ok“: robots pryč, STATIC_PAGES, /nastroje.
 * S3-OPEN: účetní (Helena Jeřábková) vzor 17. 10. 2026 zkontrolovala → index, STATIC_PAGES, /nastroje, llms.txt, „Odborná revize“.
 */
const VZOR_POVERENI_REVIEWED: boolean = true;
const VZOR_POVERENI_REVIEWED_ON = "2026-10-17";

export const metadata: Metadata = {
  title: "Vzor pověření k evidování tržeb (EET 2.0, § 10)",
  description:
    "Vzor pověření k evidování tržeb podle § 10 zákona o evidenci tržeb: kdo za koho eviduje, v jakém rozsahu a odkdy. Vyplníte online, vytisknete nebo uložíte do PDF.",
  ...canonicalMeta("/vzor-povereni"),
  ...(VZOR_POVERENI_REVIEWED ? {} : { robots: { index: false, follow: true } }),
};

const FAQ = [
  {
    q: "Kdy pověření potřebuji?",
    a: "Když peníze od zákazníka přijímá jiný podnikatel než ten, komu tržba patří, a má ji evidovat za něj – typicky hotel, který na recepci vybírá za externího maséra. Často je jednodušší, když každý eviduje sám.",
  },
  {
    q: "Prodávám v obchodě zboží jiného výrobce na jeho účet. Potřebuji pověření?",
    a: "Ne. Prodáváte-li svým jménem na účet jiného (komisní prodej), jde o nepřímé zastoupení: tržbu podle § 9 eviduje ten, kdo prodává. Pověření se týká situace, kdy tržba patří jinému a vy ji za něj jen evidujete.",
  },
  {
    q: "Kdo odpovídá, když pověřený tržbu nezaeviduje?",
    a: "Pověřený odpovídá za povinnosti, které v rozsahu pověření plní. Pověřující ale podle § 10 odst. 2 zůstává odpovědný za povinnost evidovat tržbu. Proto si přehledy tržeb pravidelně kontrolujte.",
  },
  {
    q: "Musí být pověření písemné?",
    a: "Formální náležitosti pověření Finanční správa zatím podrobně nepopsala. Doporučujeme dohodu sepsat – kvůli jasnému rozsahu i případné kontrole.",
  },
  {
    q: "Co musí umět pokladna pověřeného?",
    a: "V datové zprávě uvést evidenční identifikační číslo pověřujícího (§ 17 odst. 2 písm. c). Než pověření začnete používat, ověřte u dodavatele pokladny, že to umí.",
  },
];

const FAQ_SOURCES = [SOURCES.zakonUplne, SOURCES.sbirka, SOURCES.vyvojari];

export default function AuthorizationPage() {
  return (
    <>
      <PageHeader
        title="Vzor pověření k evidování tržeb"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Vzor pověření", path: "/vzor-povereni" },
        ]}
        lead="Eviduje-li tržbu za vás jiný podnikatel, upravuje to § 10 zákona o evidenci tržeb. Vyplňte obě strany a rozsah, text pověření se složí sám. Pak ho vytiskněte a podepište."
      >
        {VZOR_POVERENI_REVIEWED && <ReviewNote date={VZOR_POVERENI_REVIEWED_ON} />}
      </PageHeader>
      <div className="container-page py-10">
        <p className="no-print mx-auto mb-8 max-w-3xl rounded-xl bg-warn-50 px-5 py-4 text-base text-ink">
          Vzor je pomůcka, ne právní služba. Finanční správa k pověření zatím nevydala podrobnou metodiku. Před podpisem si ho projděte s účetní nebo daňovým
          poradcem. Kdy pověření dává smysl a jaké jsou jednodušší cesty, popisuje návod{" "}
          <Link href="/navody/trzba-za-jineho" className="font-medium text-brand-700 underline">
            Tržba za jiného
          </Link>
          .
        </p>
        <AuthorizationGenerator />
        <section className="no-print mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-3 text-base text-muted">
            Zdroje:{" "}
            {FAQ_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>{s.label}</ExternalLink>
              </span>
            ))}
          </p>
        </section>
        <div className="no-print">
          <RelatedGuides slugs={["trzba-za-jineho", "eet-kadernictvi-kosmetika", "eet-ubytovani"]} className="mx-auto mt-14 max-w-5xl" />
          <ToolCta />
        </div>
      </div>
    </>
  );
}
