import type { Metadata } from "next";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { SaleReceiptGenerator } from "@/components/sale-receipt-generator";
import { ToolCta } from "@/components/tool-cta";
import { FACTS, SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S1 (17. 10. 2026): generátor dokladu o prodeji podle § 16 zákona o ochraně spotřebitele – po vzoru konkurence
 * (eviduje.cz má generátory dokladů a vzory). EET 2.0 účtenku neukládá; doklad se vydává na žádost zákazníka.
 */
export const metadata: Metadata = {
  title: "Doklad o prodeji zdarma: generátor účtenky (§ 16)",
  description:
    "Vytvořte doklad o prodeji pro zákazníka podle § 16 zákona o ochraně spotřebitele: datum, zboží, cena, jméno a IČO. Zdarma, bez registrace, tisk nebo PDF.",
  ...canonicalMeta("/doklad-o-prodeji"),
};

const FAQ = [
  {
    q: "Musím od 1. 1. 2027 vydávat účtenky?",
    a: `Ne automaticky. ${FACTS.receipt.summary}`,
  },
  {
    q: "Co musí doklad o prodeji obsahovat?",
    a: "Podle § 16 odst. 1 zákona o ochraně spotřebitele datum prodeje, o jaké zboží nebo službu jde, cenu a identifikační údaje prodávajícího – jméno a příjmení nebo název a IČO. U prodeje s pozdějším dodáním se uvádí i místo a termín dodání, použité zboží nebo zboží s vadou musí být na dokladu výslovně označené.",
  },
  {
    q: "Můžu doklad zákazníkovi poslat e-mailem?",
    a: "Podle běžného výkladu ano – doklad lze vydat i elektronicky. V okně tisku zvolte „Uložit jako PDF“ a soubor zákazníkovi pošlete.",
  },
  {
    q: "Musí být na dokladu kód z EET?",
    a: `${FACTS.confirmation.summary} ${FACTS.confirmation.onReceipt}`,
  },
  {
    q: "Jsem plátce DPH. Stačí mi tento doklad?",
    a: "Pro spotřebitele podle § 16 ano, daňovým dokladem podle zákona o DPH ale není. Daňový doklad má další náležitosti (DIČ, sazba a výše daně), poraďte se s účetní.",
  },
  {
    q: "Ukládáte údaje, které do generátoru zadám?",
    a: "Ne. Doklad se skládá přímo ve vašem prohlížeči. Na náš server jde jen IČO, když kliknete na „Doplnit z ARES“.",
  },
];

const FAQ_SOURCES = [SOURCES.zos, SOURCES.prezident, SOURCES.prakticke];

export default function SaleReceiptPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Doklad o prodeji zdarma"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Doklad o prodeji", path: "/doklad-o-prodeji" },
        ]}
        lead="Zákazník chce doklad a pokladnu nemáte po ruce? Vyplňte prodávajícího a položky, doklad se složí sám podle § 16 zákona o ochraně spotřebitele. Vytisknete ho, nebo uložíte jako PDF a pošlete e-mailem."
      />
      <div className="container-page py-10">
        <SaleReceiptGenerator />
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
          <RelatedGuides slugs={["musim-vydavat-uctenku", "kontaktni-platba", "pokladna-v-mobilu-zdarma"]} className="mx-auto mt-14 max-w-5xl" />
          <ToolCta text="V pokladně EvidujZdarma se doklad ke každé tržbě vytvoří sám – zákazníkovi ho pošlete e-mailem nebo ukážete jako QR kód." />
        </div>
      </div>
    </>
  );
}
