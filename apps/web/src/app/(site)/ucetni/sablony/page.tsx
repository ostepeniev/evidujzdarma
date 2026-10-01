import type { Metadata } from "next";
import Link from "next/link";
import { LetterTemplates } from "@/components/accountant/letter-templates";
import { PageHeader } from "@/components/page-header";
import { FACTS_UPDATED } from "@/content/facts";

export const metadata: Metadata = {
  title: "Šablony dopisů klientům k EET 2.0",
  description:
    "Hotové dopisy pro účetní: úvod do EET 2.0, rozhodnutí o EET OFF, podklady k evidenčním jednotkám a kontrola před ostrým provozem. Doplňte kancelář a kopírujte.",
  alternates: { canonical: "/ucetni/sablony" },
};

export default function LetterTemplatesPage() {
  return (
    <>
      <PageHeader
        title="Šablony dopisů klientům k EET 2.0"
        crumbs={[
          { name: "Pro účetní", path: "/ucetni" },
          { name: "Šablony dopisů", path: "/ucetni/sablony" },
        ]}
        lead="Hotové dopisy k jednotlivým termínům EET 2.0. Napište název své kanceláře, zkopírujte text do e-mailu a upravte ho podle klienta."
      />
      <div className="container-page py-10">
        <div className="mx-auto max-w-3xl">
          <p role="note" className="mb-8 rounded-2xl border border-line bg-surface p-4 text-[15px] text-ink-soft sm:p-5">
            Šablony skládáme výhradně z faktů, které jsme ověřili k {new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")} v
            oficiálních zdrojích (eet.gov.cz, Finanční správa, Ministerstvo financí). Pokud se pravidla změní, šablony se aktualizují.
            Nejsou právní radou – před odesláním je přizpůsobte situaci klienta.
          </p>

          <LetterTemplates />

          <aside className="mt-12 rounded-2xl bg-brand-700 p-8 text-white sm:p-10">
            <h2 className="text-2xl font-bold sm:text-3xl">Komu dopis poslat?</h2>
            <p className="mt-2 max-w-2xl text-lg text-brand-100">
              Zjistěte během minuty, kterých klientů se EET 2.0 pravděpodobně týká a kdo může zvolit EET OFF – stačí seznam IČO.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/ucetni/hromadna-kontrola" className="btn bg-white text-brand-700 hover:bg-brand-50">
                Hromadná kontrola IČO
              </Link>
              <Link href="/ucetni#partner" className="btn border border-brand-200/40 text-white hover:bg-brand-600">
                Partnerský program
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
