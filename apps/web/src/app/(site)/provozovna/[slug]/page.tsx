import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { krajByCode, legalFormShort } from "@ez/cz";
import { Facts } from "@/components/catalog/facts";
import { establishmentLd } from "@/components/catalog/jsonld";
import { OwnerCta } from "@/components/catalog/owner-cta";
import { dateCs, establishmentPath, firmPath, krajPath, parseEstablishmentSlug, slugDecision } from "@/components/catalog/paths";
import { RelevanceChip, RelevanceExplainer } from "@/components/catalog/relevance";
import { SourceNote } from "@/components/catalog/source-note";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { getEstablishmentPage, type EstablishmentPage } from "@/lib/server/catalog";
import { canonicalMeta } from "@/lib/metadata";

// Renderuje se pro každý požadavek, bez ISR cache na disku (R3.3).
export const dynamic = "force-dynamic";

async function load(slugParam: string): Promise<EstablishmentPage> {
  const parsed = parseEstablishmentSlug(slugParam);
  if (!parsed) notFound();
  const page = await getEstablishmentPage(parsed.icp);
  if (!page) notFound();
  const decision = slugDecision(parsed.suffix, page.establishment.slug);
  if (decision === "notfound") notFound();
  if (decision === "redirect") permanentRedirect(establishmentPath(page.establishment));
  return page;
}

function title(p: EstablishmentPage): string {
  const est = p.establishment;
  return est.name ?? `Provozovna ${p.firm.name}${est.city ? `, ${est.city}` : ""}`;
}

export async function generateMetadata({ params }: PageProps<"/provozovna/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  const est = p.establishment;
  return {
    title: `${title(p)} – IČP ${est.icp}`,
    description: `Provozovna IČP ${est.icp}${est.city ? `, ${est.city}` : ""}. Provozovatel ${p.firm.name}, IČO ${p.firm.ico}. Údaje ze živnostenského rejstříku k ${dateCs(p.firm.source.date)}.`,
    ...canonicalMeta(establishmentPath(est)),
    robots: p.index ? undefined : { index: false, follow: true },
  };
}

export default async function EstablishmentPageView({ params }: PageProps<"/provozovna/[slug]">) {
  const { slug } = await params;
  const p = await load(slug);
  const { establishment: est, firm } = p;
  const kraj = krajByCode(est.regionCode ?? firm.regionCode);
  const name = title(p);
  const address = firm.isNaturalPerson ? est.city : [est.street, [est.postalCode, est.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <>
      <JsonLd data={establishmentLd(est, firm)} />
      <PageHeader
        title={name}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          ...(kraj ? [{ name: kraj.name, path: krajPath(kraj.slug) }] : []),
          { name: firm.name, path: firmPath(firm) },
          { name: `IČP ${est.icp}`, path: establishmentPath(est) },
        ]}
        lead={
          <>
            Provozovna subjektu{" "}
            <Link href={firmPath(firm)} className="font-semibold text-brand-700 underline underline-offset-4">
              {firm.name}
            </Link>{" "}
            (IČO {firm.ico})
          </>
        }
      >
        <div className="mt-5 flex flex-wrap gap-2">
          {p.active ? <RelevanceChip relevance={est.eetRelevance} /> : <span className="chip bg-surface-2 text-ink-soft">Ukončená provozovna</span>}
          <span className="chip bg-white text-muted ring-1 ring-line">
            {firm.source.kind === "ares" ? "Ověřeno v ARES" : "Údaje z RES ČSÚ"} k {dateCs(firm.source.date)}
          </span>
        </div>
      </PageHeader>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section className="card" aria-labelledby="udaje-provozovny">
            <h2 id="udaje-provozovny" className="text-xl font-bold">
              Údaje o provozovně
            </h2>
            <Facts
              rows={[
                ["Název provozovny", est.name],
                ["IČP", est.icp],
                [firm.isNaturalPerson ? "Obec" : "Adresa", address],
                ["Kraj", kraj?.name],
                ["Zahájení činnosti", est.startedAt && <time dateTime={est.startedAt}>{dateCs(est.startedAt)}</time>],
                ["Ukončení činnosti", !p.active && p.endedAt && <time dateTime={p.endedAt}>{dateCs(p.endedAt)}</time>],
                [
                  "Provozovatel",
                  <Link key="firm" href={firmPath(firm)} className="text-brand-700 underline underline-offset-4">
                    {firm.name} ({legalFormShort(firm.legalForm)}, IČO {firm.ico})
                  </Link>,
                ],
              ]}
            />
            {firm.isNaturalPerson && <p className="mt-3 text-sm text-muted">U provozoven fyzických osob uvádíme jen obec.</p>}
            <p className="mt-3 text-sm text-muted">IČP ze živnostenského rejstříku není číslo evidenční jednotky EET – to přidělí Finanční správa v DIS+.</p>
          </section>

          {est.trades.length > 0 && (
            <section className="card" aria-labelledby="zivnosti">
              <h2 id="zivnosti" className="text-xl font-bold">
                Živnosti provozované v provozovně
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink">
                {est.trades.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {p.active && (
            <section className="card space-y-3" aria-labelledby="eet">
              <h2 id="eet" className="text-xl font-bold">
                EET 2.0 v této provozovně
              </h2>
              <RelevanceChip relevance={est.eetRelevance} />
              <RelevanceExplainer basis="zivnosti" />
              <p className="text-[15px] text-ink-soft">
                Pokud zde přijímáte platby osobně, oznamuje se provozovna v DIS+ jako evidenční jednotka.{" "}
                <Link href="/evidencni-jednotky" className="font-medium text-brand-700 underline underline-offset-4">
                  Co je evidenční jednotka
                </Link>
              </p>
            </section>
          )}

          <SourceNote ico={firm.ico} icp={est.icp} source={firm.source} />
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <OwnerCta ico={firm.ico} icp={est.icp} claimed={firm.claimed} claimLabel="Ověřit profil provozovny" />
        </div>
      </div>
    </>
  );
}
