import type { Metadata } from "next";
import Link from "next/link";
import { isValidIco, normalizeIco } from "@ez/cz";
import { Faq } from "@/components/faq";
import { IcoQuickCheck } from "@/components/ico-quick-check";
import { IcoResult } from "@/components/ico-result";
import { PageHeader } from "@/components/page-header";
import { PreregForm } from "@/components/prereg-form";
import { ToolCta } from "@/components/tool-cta";
import { FACTS } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { headers } from "next/headers";
import { lookupCompany, type CompanyLookup } from "@/lib/server/ares";
import { clientIpFromHeaders, rateLimit } from "@/lib/server/rate-limit";
import { FactsVerified } from "@/components/facts-verified";
import { canonicalMeta } from "@/lib/metadata";

export async function generateMetadata({ searchParams }: PageProps<"/kontrola-ico">): Promise<Metadata> {
  const { ico } = await searchParams;
  return {
    title: "EET kontrola podle IČO – týká se mě EET 2.0?",
    description:
      "Zadejte IČO a zjistěte, zda se vás týká EET 2.0, kolik provozoven máte v živnostenském rejstříku a zda můžete využít EET OFF. Zdarma, bez registrace, z dat ARES.",
    ...canonicalMeta("/kontrola-ico"),
    // Výsledky pro konkrétní IČO neindexujeme (tenký duplicitní obsah) — indexuje se katalog firem.
    robots: ico ? { index: false, follow: true } : undefined,
  };
}

const FAQ = [
  {
    q: "Odkud berete údaje o firmě?",
    a: "Z veřejného registru ARES Ministerstva financí: základní údaje, obory činnosti CZ-NACE a živnostenský rejstřík včetně provozoven. Odpověď z ARES krátce (24 hodin) ukládáme do mezipaměti; k žádnému profilu ji nepřiřazujeme.",
  },
  {
    q: "Proč je výsledek jen „pravděpodobný“?",
    a: "Evidence se týká plateb přijatých osobně (hotovost, karta, QR kód na místě). Z registrů ale nelze zjistit, jak podnikatel platby přijímá, ani zda je v paušálním režimu. Proto se doptáváme na 2–3 otázky.",
  },
  { q: "Kdo může využít EET OFF?", a: FACTS.eetOff.summary },
  { q: "Je číslo provozovny (IČP) totéž co číslo evidenční jednotky?", a: "Ne. IČP je identifikátor provozovny v živnostenském rejstříku. Číslo evidenční jednotky přidělí Finanční správa, když jednotku oznámíte v DIS+." },
];

export default async function IcoCheckPage({ searchParams }: PageProps<"/kontrola-ico">) {
  const { ico: raw } = await searchParams;
  const icoParam = typeof raw === "string" ? raw : undefined;
  const ico = icoParam ? normalizeIco(icoParam) : null;

  let result: CompanyLookup | null = null;
  let error: string | null = null;
  /** IČO pro formulář předregistrace (R14.2): každý výsledek kromě „IČO neexistuje“ (neplatné nebo v ARES není) */
  let prefillIco: string | null = null;
  if (icoParam) {
    if (!ico || !isValidIco(ico)) {
      error = "Zadané IČO není platné. IČO má 8 číslic a poslední z nich je kontrolní.";
    } else {
      prefillIco = ico;
      try {
        // živé dotazy do ARES z této stránky omezujeme i na IP (R3.11)
        if (!rateLimit(`ico-page:${clientIpFromHeaders(await headers())}`, 30, 60)) throw new Error("rate");
        result = await lookupCompany(ico);
        if (!result) {
          error = "Subjekt s tímto IČO jsme v ARES nenašli.";
          prefillIco = null;
        }
      } catch (e) {
        error =
          e instanceof Error && e.message === "rate"
            ? "Z vaší sítě přišlo příliš mnoho dotazů. Zkuste to prosím za minutu."
            : "Registr ARES teď neodpovídá. Zkuste to prosím za chvíli znovu.";
      }
    }
  }

  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="EET kontrola podle IČO"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Kontrola IČO", path: "/kontrola-ico" },
        ]}
        lead="Zjistěte za 10 vteřin, zda se vás týká EET 2.0, které provozovny máte v živnostenském rejstříku a zda můžete zvolit EET OFF."
      >
        <div className="mt-6 max-w-2xl">
          <IcoQuickCheck size="md" initial={icoParam ?? ""} />
        </div>
      </PageHeader>
      <div className="container-page py-10">
        <div className="mx-auto max-w-3xl">
          {error && (
            <p role="alert" className="rounded-2xl bg-danger-50 p-5 text-danger-600">
              {error}
            </p>
          )}
          {result && <IcoResult subject={result.subject} rzp={result.rzp} fetchedAt={result.fetchedAt} />}
          {result && (
            <p className="mt-6 text-[15px]">
              Jste účetní? Zkontrolujte všechny klienty najednou v{" "}
              <Link href="/ucetni/hromadna-kontrola" className="font-medium text-brand-700 underline underline-offset-4">
                hromadné kontrole IČO
              </Link>
              .
            </p>
          )}
          {prefillIco && (
            <section className="card mt-10 p-6 shadow-sm sm:p-8" aria-labelledby="predregistrace-h">
              <h2 id="predregistrace-h" className="text-2xl font-bold">
                Chcete evidovat zdarma?
              </h2>
              <p className="mb-6 mt-2 text-ink-soft">Předregistrujte se k bezplatné pokladně. IČO {prefillIco} už máme vyplněné.</p>
              <PreregForm defaultIco={prefillIco} />
            </section>
          )}
          <section className="mt-14">
            <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
            <Faq items={FAQ} />
            <FactsVerified className="mt-4 text-sm text-muted" />
          </section>
          <ToolCta />
        </div>
      </div>
    </>
  );
}
