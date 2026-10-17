import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { IbanValidator } from "@/components/tools/iban-validator";
import { ToolFaq } from "@/components/tools/tool-faq";
import { FACTS, SOURCES } from "@/content/facts";
import { JsonLd, faqLd, howToLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/** S2 B1 (17. 10. 2026): ověření IBAN libovolné země (ISO 13616, modulo 97); u CZ banka podle číselníku ČNB č. 255. */
export const metadata: Metadata = {
  title: "Ověření IBAN zdarma: kontrolní číslice, účet a banka",
  description:
    "Ověřte IBAN z jakékoli země (kontrolní číslice modulo 97). U českého IBAN uvidíte číslo účtu, banku a BIC podle číselníku ČNB. Bez registrace, nic se neodesílá.",
  ...canonicalMeta("/nastroje/overeni-iban"),
};

const STEPS = [
  { name: "Přesuňte první čtyři znaky na konec", text: "Kód země a kontrolní číslice (např. CZ65) přesuňte za zbytek IBAN." },
  { name: "Písmena nahraďte čísly", text: "A = 10, B = 11 … Z = 35. Vznikne dlouhé číslo." },
  { name: "Spočítejte zbytek po dělení 97", text: "U platného IBAN vyjde zbytek 1." },
];

const FAQ = [
  {
    q: "Co znamená, že je IBAN platný?",
    a: "Že sedí jeho kontrolní číslice podle mezinárodní normy ISO 13616. Kontrolní číslice chrání proti chybně zadanému číslu účtu, například překlepu. Zda účet existuje a komu patří, z IBAN zjistit nejde.",
  },
  {
    q: "Jak dlouhý je český IBAN?",
    a: "Vždy 24 znaků: CZ, dvě kontrolní číslice, čtyřmístný kód banky a šestnáct číslic účtu – šestimístné předčíslí a desetimístné číslo, obojí doplněné nulami zleva (vyhláška č. 169/2011 Sb.).",
  },
  {
    q: "Odkud berete názvy bank a BIC?",
    a: "Z Číselníku kódů platebního styku v ČR, který vydává Česká národní banka (číselník č. 255 platný od 1. 10. 2026). Kód, který v číselníku není, označíme.",
  },
  {
    q: "Eviduje se platba na účet v EET 2.0?",
    a: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}`,
  },
];

const FAQ_SOURCES = [SOURCES.cnbIban, SOURCES.vyhlaska169, SOURCES.cnbKodyBank, SOURCES.kdoMusi];

export default function IbanValidatorPage() {
  return (
    <>
      <JsonLd
        data={[howToLd({ name: "Jak ověřit kontrolní číslice IBAN", description: "Kontrola IBAN podle ISO 13616 (modulo 97) ve třech krocích.", steps: STEPS }), faqLd(FAQ)]}
      />
      <PageHeader
        title="Ověření IBAN"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Ověření IBAN", path: "/nastroje/overeni-iban" },
        ]}
        lead="Vložte IBAN a hned zjistíte, zda sedí kontrolní číslice. U českého IBAN ukážeme i tuzemské číslo účtu, banku a BIC podle číselníku ČNB."
      />
      <div className="container-page py-10">
        <IbanValidator />
        <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="jak-iban">
          <h2 id="jak-iban" className="text-2xl font-bold">
            Jak se IBAN kontroluje
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-[17px] text-ink-soft">
            {STEPS.map((s) => (
              <li key={s.name}>
                <strong className="text-ink">{s.name}.</strong> {s.text}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
            Příklad České národní banky: účet 19-2000145399/0800 má IBAN CZ65 0800 0000 1920 0014 5399. Potřebujete IBAN spočítat z čísla účtu? Použijte{" "}
            <Link href="/nastroje/ucet-na-iban" className="font-medium text-brand-700 underline underline-offset-4">
              převod čísla účtu na IBAN
            </Link>
            .
          </p>
        </section>
        <ToolFaq items={FAQ} sources={FAQ_SOURCES} />
        <RelatedGuides slugs={["kontaktni-platba", "eet-eshop-dobirka", "pokladna-v-mobilu-zdarma"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
