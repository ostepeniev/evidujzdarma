import type { Metadata } from "next";
import Link from "next/link";
import { BulkCheck } from "@/components/accountant/bulk-check";
import { Faq, type FaqItem } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { FACTS, FACTS_UPDATED } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { absoluteUrl } from "@/lib/site";
import { canonicalMeta } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Hromadná kontrola IČO pro účetní (EET)",
  description:
    "Zkontrolujte klienty najednou: vložte IČO nebo nahrajte CSV a zjistěte, koho se pravděpodobně týká EET 2.0 a kdo může zvolit EET OFF. Zdarma, s exportem.",
  ...canonicalMeta("/ucetni/hromadna-kontrola"),
};

const FAQ: FaqItem[] = [
  {
    q: "Jak přesný je výsledek?",
    a: "Je orientační. Vyhodnocujeme veřejné údaje z ARES a živnostenského rejstříku: právní formu, obory činnosti CZ-NACE, živnosti a provozovny. Z registrů ale nelze zjistit, zda klient přijímá platby osobně (hotově, kartou, QR kódem na místě), ani zda je v paušálním režimu. U klientů označených „Možná“ se proto doptejte, případně otevřete detail IČO a odpovězte na doplňující otázky.",
  },
  {
    q: "Co znamená sloupec EET OFF?",
    a: `„Nelze“ – právnická osoba, EET OFF pro ni není. „Ověřit“ – fyzická osoba, která EET OFF může zvolit, pokud je v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč. ${FACTS.eetOff.howTo}`,
  },
  {
    q: "Je počet provozoven totéž co počet evidenčních jednotek?",
    a: `Ne. Počet provozoven je z živnostenského rejstříku a slouží jako vodítko. ${FACTS.units.summary} Čísla jednotek přiděluje Finanční správa po oznámení v DIS+.`,
  },
  {
    q: "Ukládáte seznamy IČO mých klientů?",
    a: "Ne. Seznam se zpracuje jen pro vytvoření tabulky a neukládáme ho k žádnému profilu. Veřejné odpovědi registru ARES krátkodobě (24 hodin) držíme v mezipaměti, aby byla kontrola rychlejší.",
  },
  {
    q: "Kolik IČO mohu zkontrolovat?",
    a: "V jednom kole až 500. Prohlížeč je posílá po 50 kusech a kvůli limitům registru ARES může kontrolu krátce pozastavit – pokračuje pak automaticky.",
  },
  {
    q: "Jak CSV soubor připravit?",
    a: "Stačí export z účetního programu nebo tabulka, kde je IČO v prvním sloupci nebo ve sloupci nadepsaném „IČO“. Oddělovač (středník, čárka, tabulátor) poznáme sami. Výsledek stáhnete jako CSV se středníky a kódováním UTF-8, které Excel otevře správně i s diakritikou.",
  },
];

export default function BulkCheckPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Hromadná kontrola IČO pro účetní",
            url: absoluteUrl("/ucetni/hromadna-kontrola"),
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: "cs-CZ",
            offers: { "@type": "Offer", price: "0", priceCurrency: "CZK" },
          },
          faqLd(FAQ),
        ]}
      />
      <PageHeader
        title="Hromadná kontrola IČO pro účetní"
        crumbs={[
          { name: "Pro účetní", path: "/ucetni" },
          { name: "Hromadná kontrola IČO", path: "/ucetni/hromadna-kontrola" },
        ]}
        lead="Vložte seznam IČO svých klientů nebo nahrajte CSV. Během chvíle uvidíte, koho se EET 2.0 pravděpodobně týká, kdo může zvolit EET OFF a kolik má provozoven. Zdarma a bez registrace."
      />
      <div className="container-page py-10">
        <div className="mx-auto max-w-5xl">
          <p role="note" className="mb-8 rounded-2xl border border-sun-300 bg-sun-100 p-4 text-[15px] text-ink sm:p-5">
            <strong>Výsledky jsou orientační.</strong> Vycházejí z veřejných registrů (ARES, živnostenský rejstřík), které neukazují,
            jak klient přijímá platby ani zda je v paušálním režimu. Nenahrazují posouzení konkrétního klienta. Pravidla EET 2.0
            ověřena k {new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")}.
          </p>

          <BulkCheck />

          <section aria-labelledby="dalsi-krok" className="mt-14 rounded-2xl bg-brand-700 p-8 text-white sm:p-10">
            <h2 id="dalsi-krok" className="text-2xl font-bold sm:text-3xl">
              Máte seznam? Teď klienty připravte
            </h2>
            <p className="mt-2 max-w-2xl text-lg text-brand-100">
              V partnerském programu pro účetní získáte bezplatný Účetní kabinet se stavem připravenosti klientů, šablony dopisů a
              20 % z jejich placených tarifů – nebo slevu pro klienty.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/ucetni#partner" className="btn bg-white text-brand-700 hover:bg-brand-50">
                Partnerský program
              </Link>
              <Link href="/ucetni/sablony" className="btn border border-brand-200/40 text-white hover:bg-brand-600">
                Šablony dopisů klientům
              </Link>
            </div>
          </section>

          <section aria-labelledby="faq" className="mx-auto mt-14 max-w-3xl">
            <h2 id="faq" className="mb-6 text-2xl font-bold">
              Časté otázky
            </h2>
            <Faq items={FAQ} />
          </section>
        </div>
      </div>
    </>
  );
}
