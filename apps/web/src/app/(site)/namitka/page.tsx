import type { Metadata } from "next";
import Link from "next/link";
import { isClosed } from "@/lib/launch";
import { ObjectionForm } from "@/components/catalog/objection-form";
import { PageHeader } from "@/components/page-header";
import { SITE } from "@/lib/site";

export async function generateMetadata({ searchParams }: PageProps<"/namitka">): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "Námitka a oprava údajů v katalogu firem",
    description: "Nesouhlasíte se zveřejněním údajů z veřejných registrů nebo jsou nepřesné? Podejte námitku podle čl. 21 GDPR nebo žádost o opravu. Odpovíme do 30 dnů.",
    alternates: { canonical: "/namitka" },
    robots: sp.ico || sp.icp ? { index: false, follow: false } : undefined,
  };
}

function digits(v: string | string[] | undefined, max: number): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\d+$/.test(s) ? s.slice(0, max) : "";
}

export default async function ObjectionPage({ searchParams }: PageProps<"/namitka">) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Námitka a oprava údajů"
        // katalog je zatím za heslem – drobečková navigace do něj nevede (R7.6)
        crumbs={[...(isClosed("/firmy") ? [] : [{ name: "Katalog firem", path: "/firmy" }]), { name: "Námitka", path: "/namitka" }]}
        lead="Katalog zobrazuje jen veřejné údaje z registrů. Pokud nesouhlasíte s jejich zveřejněním u nás nebo jsou nepřesné, dejte nám vědět."
      />
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <ObjectionForm defaultIco={digits(sp.ico, 8)} defaultIcp={digits(sp.icp, 12)} />
        </div>
        <aside className="prose-ez text-base">
          <h2 className="!mt-0 !text-xl">Jak žádost vyřizujeme</h2>
          <ul>
            <li>Pošleme vám e-mail s odkazem k potvrzení žádosti. U podnikajících fyzických osob stránku vyřadíme z indexace vyhledávačů hned po odeslání, u firem po potvrzení e-mailu – dokud žádost neposoudíme.</li>
            <li>Odpovíme na váš e-mail nejpozději do 30 dnů (čl. 12 odst. 3 GDPR).</li>
            <li>
              U námitky podle čl. 21 GDPR posoudíme vaši konkrétní situaci; vyhovíme-li, údaje z katalogu odstraníme nebo stránku trvale skryjeme.
            </li>
            <li>U opravy ověříme údaj v registru. Chyby v samotném registru je nutné opravit u správce registru (ARES, živnostenský úřad, ČSÚ).</li>
          </ul>
          <h2 className="!text-xl">Jaké údaje zpracováváme</h2>
          <p>
            Jen údaje z veřejných registrů: název, IČO, DIČ, právní forma, data vzniku a zániku, obory činnosti a provozovny. U fyzických osob
            nezobrazujeme adresu, jen obec. Nevytváříme stránky osob ani statutárních orgánů.
          </p>
          <p>
            Raději e-mailem? Napište na <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>
          <p>
            Podrobnosti v <Link href="/ochrana-osobnich-udaju">zásadách ochrany osobních údajů</Link>.
            {!isClosed("/firmy") && (
              <>
                {" "}
                <Link href="/firmy">Zpět do katalogu firem</Link>
              </>
            )}
          </p>
        </aside>
      </div>
    </>
  );
}
