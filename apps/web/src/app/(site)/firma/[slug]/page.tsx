import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { classifyNaceList, krajByCode, legalFormName, legalFormShort } from "@ez/cz";
import { Facts } from "@/components/catalog/facts";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { firmLd } from "@/components/catalog/jsonld";
import { naceDivisionLabel } from "@/components/catalog/nace-labels";
import { OwnerCta } from "@/components/catalog/owner-cta";
import { AresUnavailable } from "@/components/catalog/ares-unavailable";
import { aresUrl, dateCs, establishmentPath, firmPath, krajPath, oborKrajPath } from "@/components/catalog/paths";
import { RelevanceChip, RelevanceExplainer } from "@/components/catalog/relevance";
import { SourceNote } from "@/components/catalog/source-note";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { loadFirmPage } from "@/lib/server/firm-page";
import { clientIpFromHeaders } from "@/lib/server/rate-limit";
import { ExternalLink } from "@/components/external-link";
import { canonicalMeta } from "@/lib/metadata";

// Stránky firem se renderují pro každý požadavek a neukládají se do ISR cache na disk: miliony
// platných IČO by ji jinak mohly zaplnit (R3.3). Data z DB jsou levná, živé dotazy do ARES mají limit na IP.
export const dynamic = "force-dynamic";

async function loadFirm(slug: string) {
  return loadFirmPage(slug, clientIpFromHeaders(await headers()));
}

export async function generateMetadata({ params }: PageProps<"/firma/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const state = await loadFirm(slug);
  if (state.kind === "unavailable") return { title: `IČO ${state.ico} – údaje z ARES nejsou k dispozici`, robots: { index: false, follow: false } };
  const firm = state.firm;
  const kraj = krajByCode(firm.regionCode);
  const firstNace = firm.nace.map(naceDivisionLabel).find(Boolean);
  const parts = [
    `${firm.name}, IČO ${firm.ico}`,
    legalFormShort(firm.legalForm),
    firm.city ? `${firm.city}${kraj ? ` (${kraj.name})` : ""}` : null,
    firstNace ? `obor: ${firstNace}` : null,
  ].filter(Boolean);
  return {
    title: `${firm.name} – IČO ${firm.ico}`,
    description: `${parts.join(" · ")}. Údaje z veřejných registrů k ${dateCs(firm.source.date)} a orientační EET relevance podle oboru.`,
    ...canonicalMeta(firmPath(firm)),
    robots: firm.index ? undefined : { index: false, follow: true },
  };
}

export default async function FirmPage({ params }: PageProps<"/firma/[slug]">) {
  const { slug } = await params;
  const state = await loadFirm(slug);
  if (state.kind === "unavailable") return <AresUnavailable ico={state.ico} />;
  const firm = state.firm;
  const kraj = krajByCode(firm.regionCode);
  const path = firmPath(firm);
  const { matched } = classifyNaceList(firm.nace);
  const seat = [firm.street, [firm.postalCode, firm.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <>
      <JsonLd data={firmLd(firm)} />
      <PageHeader
        title={firm.name}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          ...(kraj ? [{ name: kraj.name, path: krajPath(kraj.slug) }] : []),
          { name: firm.name, path },
        ]}
        lead={
          <>
            IČO {firm.ico} · {legalFormShort(firm.legalForm)}
            {firm.city && <> · {firm.city}</>}
          </>
        }
      >
        <div className="mt-5 flex flex-wrap gap-2">
          {firm.dissolvedAt ? <span className="chip bg-surface-2 text-ink-soft">Zaniklý subjekt</span> : <RelevanceChip relevance={firm.eetRelevance} />}
          {firm.claimed && <span className="chip bg-brand-100 text-brand-900">Profil ověřen vlastníkem</span>}
          <span className="chip bg-white text-muted ring-1 ring-line">
            {firm.source.kind === "ares" ? "Ověřeno v ARES" : "Údaje z RES ČSÚ"} k {dateCs(firm.source.date)}
          </span>
        </div>
      </PageHeader>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section className="card" aria-labelledby="zakladni-udaje">
            <h2 id="zakladni-udaje" className="text-xl font-bold">
              Základní údaje
            </h2>
            <Facts
              rows={[
                ["Název", firm.name],
                ["IČO", firm.ico],
                ["DIČ", firm.dic],
                ["Plátce DPH", firm.vatPayer === null ? null : firm.vatPayer ? "ano" : "ne"],
                ["Právní forma", legalFormName(firm.legalForm)],
                ["Datum vzniku", firm.foundedAt && <time dateTime={firm.foundedAt}>{dateCs(firm.foundedAt)}</time>],
                ["Datum zániku", firm.dissolvedAt && <time dateTime={firm.dissolvedAt}>{dateCs(firm.dissolvedAt)}</time>],
                [firm.isNaturalPerson ? "Obec sídla" : "Sídlo", firm.isNaturalPerson ? firm.city : seat || firm.city],
                ["Kraj", kraj && <Link href={krajPath(kraj.slug)} className="text-brand-700 underline underline-offset-4">{kraj.name}</Link>],
                ["Provozovny v RŽP", firm.establishments ? String(firm.establishments.length) : null],
              ]}
            />
            {firm.isNaturalPerson && <p className="mt-3 text-sm text-muted">U fyzických osob neuvádíme adresu sídla, jen obec.</p>}
          </section>

          <section className="card" aria-labelledby="obory">
            <h2 id="obory" className="text-xl font-bold">
              Obory činnosti (CZ-NACE)
            </h2>
            {firm.nace.length > 0 ? (
              <ul className="mt-3 divide-y divide-line">
                {firm.nace.map((code) => {
                  const label = naceDivisionLabel(code);
                  return (
                    <li key={code} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
                      <span className="w-20 shrink-0 font-mono text-sm text-ink-soft">{code}</span>
                      <span className="text-ink">{label ? `oddíl ${code.slice(0, 2)}: ${label}` : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-ink-soft">Obor činnosti není v registru uveden.</p>
            )}
          </section>

          {!firm.dissolvedAt && (
            <section className="card space-y-3" aria-labelledby="eet">
              <h2 id="eet" className="text-xl font-bold">
                EET 2.0 (od 1. 1. 2027)
              </h2>
              <RelevanceChip relevance={firm.eetRelevance} />
              <RelevanceExplainer matched={matched.map((m) => m.label)} />
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={`/kontrola-ico?ico=${firm.ico}`} className="btn-primary" rel="nofollow">
                  Ověřit EET podle IČO
                </Link>
                <Link href="/#registrace" className="btn-secondary">
                  Pokladna zdarma
                </Link>
              </div>
            </section>
          )}

          <section className="card" aria-labelledby="provozovny">
            <h2 id="provozovny" className="text-xl font-bold">
              Provozovny
            </h2>
            {firm.establishments === null ? (
              <p className="mt-3 text-ink-soft">
                Provozovny ze živnostenského rejstříku zatím nejsou načteny.{" "}
                <ExternalLink href={aresUrl(firm.ico)} className="text-brand-700 underline underline-offset-4">
                  Zobrazit v ARES
                </ExternalLink>
              </p>
            ) : firm.establishments.length === 0 ? (
              <p className="mt-3 text-ink-soft">V živnostenském rejstříku není evidována žádná aktivní provozovna.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">IČP ze živnostenského rejstříku není číslo evidenční jednotky EET – to přidělí Finanční správa v DIS+.</p>
                <ul className="mt-3 divide-y divide-line">
                  {firm.establishments.map((est) => {
                    const title = est.name ?? (est.city ? `Provozovna ${est.city}` : `Provozovna ${est.icp}`);
                    const addr = firm.isNaturalPerson ? est.city : [est.street, est.city].filter(Boolean).join(", ");
                    return (
                      <li key={est.icp} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          {est.linkable ? (
                            <Link href={establishmentPath(est)} className="font-medium text-ink hover:text-brand-700 hover:underline">
                              {title}
                            </Link>
                          ) : (
                            <span className="font-medium">{title}</span>
                          )}
                          <p className="text-sm text-ink-soft">
                            IČP {est.icp}
                            {addr && <> · {addr}</>}
                            {est.startedAt && <> · od {dateCs(est.startedAt)}</>}
                          </p>
                        </div>
                        <RelevanceChip relevance={est.eetRelevance} short />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <SourceNote ico={firm.ico} source={firm.source} />

          {kraj && (
            <nav aria-label="Související stránky" className="text-[15px]">
              <h2 className="mb-2 text-lg font-bold">Související</h2>
              <ul className="flex flex-wrap gap-2">
                {CATALOG_INDUSTRIES.filter((i) => i.nace.some((p) => firm.nace.some((c) => c.startsWith(p)))).map((i) => (
                  <li key={i.slug}>
                    <Link href={oborKrajPath(i.slug, kraj.slug)} className="inline-block rounded-full border border-line bg-white px-4 py-2 hover:border-brand-500 hover:bg-brand-50">
                      {i.label} {kraj.locative}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={krajPath(kraj.slug)} className="inline-block rounded-full border border-line bg-white px-4 py-2 hover:border-brand-500 hover:bg-brand-50">
                    Firmy {kraj.locative}
                  </Link>
                </li>
              </ul>
            </nav>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <OwnerCta ico={firm.ico} claimed={firm.claimed} />
        </div>
      </div>
    </>
  );
}
