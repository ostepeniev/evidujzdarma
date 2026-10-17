import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { AccountIbanConverter } from "@/components/tools/account-iban-converter";
import { ToolFaq } from "@/components/tools/tool-faq";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd, howToLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/** S2 B1 (17. 10. 2026): české číslo účtu ↔ IBAN (vyhláška ČNB č. 169/2011 Sb., ISO 13616). */
export const metadata: Metadata = {
  title: "Převod čísla účtu na IBAN zdarma (a zpět)",
  description:
    "Převeďte české číslo účtu na IBAN a zpět. Zkontrolujeme kontrolní součet účtu podle vyhlášky ČNB a ukážeme banku i BIC. Zdarma, přímo v prohlížeči.",
  ...canonicalMeta("/nastroje/ucet-na-iban"),
};

const STEPS = [
  { name: "Kód banky", text: "Na začátek dejte čtyřmístný kód banky – číslo za lomítkem." },
  { name: "Předčíslí", text: "Za něj předčíslí doplněné nulami zleva na šest číslic (bez předčíslí 000000)." },
  { name: "Číslo účtu", text: "Pak číslo účtu doplněné nulami zleva na deset číslic." },
  { name: "Kód země a kontrolní číslice", text: "Před vzniklých 20 číslic napište CZ a dvě kontrolní číslice spočtené podle normy ISO 13616 (modulo 97)." },
];

const FAQ = [
  {
    q: "Změní se převodem na IBAN můj účet?",
    a: "Ne. IBAN je jen mezinárodní zápis téhož účtu. Používá se pro platby ze zahraničí a do zahraničí a nese ho i QR platba.",
  },
  {
    q: "Proč nástroj hlásí chybu v čísle účtu?",
    a: "Předčíslí i číslo účtu mají vlastní kontrolní součet: číslice se zprava násobí vahami 1, 2, 4, 8, 5, 10, 9, 7, 3, 6 a součet musí být dělitelný jedenácti (příloha vyhlášky č. 169/2011 Sb.). Když nesedí, je v čísle nejspíš překlep.",
  },
  {
    q: "Co je BIC (SWIFT)?",
    a: "Mezinárodní kód banky. Uvádíme ho podle číselníku České národní banky; některé subjekty ho v číselníku nemají.",
  },
  {
    q: "Potřebuji IBAN pro QR platbu?",
    a: "QR Platba (SPAYD) nese účet ve formátu IBAN. Náš generátor QR platby ho z čísla účtu spočítá sám, stačí zadat číslo účtu.",
  },
];

const FAQ_SOURCES = [SOURCES.vyhlaska169, SOURCES.cnbIban, SOURCES.cnbKodyBank];

export default function AccountToIbanPage() {
  return (
    <>
      <JsonLd
        data={[howToLd({ name: "Jak převést české číslo účtu na IBAN", description: "Sestavení IBAN z předčíslí, čísla účtu a kódu banky.", steps: STEPS }), faqLd(FAQ)]}
      />
      <PageHeader
        title="Číslo účtu na IBAN"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Číslo účtu na IBAN", path: "/nastroje/ucet-na-iban" },
        ]}
        lead="Zadejte české číslo účtu a dostanete IBAN v písemné i elektronické podobě – nebo naopak. Zkontrolujeme i kontrolní součet účtu podle vyhlášky č. 169/2011 Sb."
      />
      <div className="container-page py-10">
        <AccountIbanConverter />
        <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="jak-ucet">
          <h2 id="jak-ucet" className="text-2xl font-bold">
            Jak se z čísla účtu stane IBAN
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-[17px] text-ink-soft">
            {STEPS.map((s) => (
              <li key={s.name}>
                <strong className="text-ink">{s.name}.</strong> {s.text}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
            Příklad České národní banky: 178124-4159/0710 → CZ69 0710 1781 2400 0000 4159. Chcete jen ověřit IBAN od obchodního partnera, třeba i zahraniční?
            Použijte{" "}
            <Link href="/nastroje/overeni-iban" className="font-medium text-brand-700 underline underline-offset-4">
              ověření IBAN
            </Link>
            .
          </p>
        </section>
        <ToolFaq items={FAQ} sources={FAQ_SOURCES} />
        <RelatedGuides slugs={["kontaktni-platba", "musim-vydavat-uctenku", "eet-eshop-dobirka"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
