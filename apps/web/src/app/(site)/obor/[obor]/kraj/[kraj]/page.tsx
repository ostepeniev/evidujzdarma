import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { classifyNaceList, krajBySlug } from "@ez/cz";
import { EetPanel, guideAvailable } from "@/components/catalog/eet-panel";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { IconBuilding, IconStore, IconUser } from "@/components/catalog/icons";
import { CATALOG_INDUSTRIES, catalogIndustry } from "@/components/catalog/industry";
import { itemListLd } from "@/components/catalog/jsonld";
import { ListSource } from "@/components/catalog/list-source";
import { firmPath, formatCount, krajPath, oborKrajPath, oborObecPath, pageParam } from "@/components/catalog/paths";
import { PersonsNote } from "@/components/catalog/persons-note";
import { StatTiles } from "@/components/catalog/stat-tiles";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { eetGuideFor } from "@/lib/catalog-eet";
import { pluralCs } from "@/lib/catalog-faq";
import { fitDescription, fitTitle } from "@/lib/catalog-meta";
import { JsonLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OBEC_MIN_FIRMS, PER_PAGE, catalogDataDate, indexRegions, isIndexRegion, listCounts, listFirmItems, regionObecStats, type ObecStats } from "@/lib/server/catalog";

// Katalog se renderuje na vyžádání, do ISR cache na disku nic neukládá – při milionech URL by ji zaplnil (R3.3, S2).
// S3: jmenovitě jen právnické osoby (index firms_listable_legal_region_name), OSVČ počtem.
export const dynamic = "force-dynamic";

function resolve(oborSlug: string, krajSlug: string) {
  const industry = catalogIndustry(oborSlug);
  const kraj = krajBySlug(krajSlug);
  if (!industry || !kraj) notFound();
  return { industry, kraj };
}

const ZERO = { total: 0, legal: 0, persons: 0 };

export async function generateMetadata({ params, searchParams }: PageProps<"/obor/[obor]/kraj/[kraj]">): Promise<Metadata> {
  const { obor, kraj: krajSlug } = await params;
  const sp = await searchParams;
  const { industry, kraj } = resolve(obor, krajSlug);
  const page = pageParam(sp.strana);
  const counts = await listCounts({ regionCode: kraj.code, nacePrefixes: industry.nace }).catch(() => ZERO);
  const suffix = page > 1 ? ` (strana ${page})` : "";
  return {
    title: fitTitle([`${industry.headline} ${kraj.locative} – firmy a EET 2.0${suffix}`, `${industry.headline} ${kraj.locative} – EET 2.0${suffix}`, `${industry.headline} ${kraj.locative}${suffix}`]),
    description: fitDescription(
      [
        `${industry.headline} ${kraj.locative}: ${formatCount(counts.total)} ${pluralCs(counts.total, ["subjekt", "subjekty", "subjektů"])} z registrů podle obcí.`,
        "Co pro obor znamená EET 2.0 od 1. 1. 2027 a seznam firem s IČO.",
      ],
      ["Údaje z ARES a RES ČSÚ.", "Zdarma a bez registrace."],
    ),
    ...canonicalMeta(oborKrajPath(industry.slug, kraj.slug, page)),
    robots: isIndexRegion(kraj.code) && counts.total > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function IndustryRegionPage({ params, searchParams }: PageProps<"/obor/[obor]/kraj/[kraj]">) {
  const { obor, kraj: krajSlug } = await params;
  const sp = await searchParams;
  const { industry, kraj } = resolve(obor, krajSlug);
  const page = pageParam(sp.strana);
  // počty z listCounts (v paměti 1 h) – na zobrazení jde jen dotaz na stránku seznamu po indexu firms_listable_legal_region_name
  const counts = await listCounts({ regionCode: kraj.code, nacePrefixes: industry.nace }).catch(() => ZERO);
  const [items, dataDate, obceStats] = await Promise.all([
    counts.legal > 0 ? listFirmItems({ regionCode: kraj.code, nacePrefixes: industry.nace, legalOnly: true }, page, PER_PAGE).catch(() => []) : Promise.resolve([]),
    catalogDataDate().catch(() => null),
    regionObecStats(kraj.code).catch(() => new Map<number, ObecStats>()),
  ]);
  if (page > 1 && items.length === 0) notFound();
  const { relevance } = classifyNaceList(industry.nace);
  const guide = industry.guide && guideAvailable(industry.guide.slug) ? industry.guide : eetGuideFor(industry.nace, relevance, guideAvailable);
  // stránky obor × obec (S2) – jen obce s aspoň OBEC_MIN_FIRMS subjekty, nejvíc subjektů první
  const obce = [...obceStats.values()]
    .filter((o) => (o.industries[industry.slug]?.listable ?? 0) >= OBEC_MIN_FIRMS)
    .sort((a, b) => b.industries[industry.slug]!.listable - a.industries[industry.slug]!.listable || a.name.localeCompare(b.name, "cs"))
    .slice(0, 40);
  const heading = `${industry.headline} ${kraj.locative}`;

  return (
    <>
      {items.length > 0 && <JsonLd data={itemListLd(`${heading}: firmy`, items.map((it) => ({ name: it.name, path: firmPath(it) })), counts.legal)} />}
      <PageHeader
        title={`${heading} – firmy a EET 2.0`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          { name: kraj.name, path: krajPath(kraj.slug) },
          { name: industry.headline, path: oborKrajPath(industry.slug, kraj.slug) },
        ]}
        lead={
          <>
            Subjekty z veřejných registrů s oborem činnosti CZ-NACE {industry.nace.join(", ")} ({industry.label}). Seznam firem podle názvu, obce
            podle počtu subjektů.
          </>
        }
      >
        <div className="mt-6">
          <StatTiles
            items={[
              { label: "Subjektů v oboru", value: counts.total, icon: <IconBuilding className="h-4 w-4" /> },
              { label: "Firmy (právnické osoby)", value: counts.legal, icon: <IconStore className="h-4 w-4" /> },
              { label: "Živnostníci (OSVČ)", value: counts.persons, icon: <IconUser className="h-4 w-4" /> },
              { label: "Obcí s 5+ subjekty", value: obce.length, icon: <IconBuilding className="h-4 w-4" /> },
            ]}
          />
        </div>
      </PageHeader>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          <EetPanel relevance={relevance} nace={industry.nace} guide={guide} title={`EET 2.0: ${industry.headline.toLowerCase()}`} />

          {obce.length > 0 && (
            <section aria-labelledby="obce">
              <h2 id="obce" className="mb-4 text-xl font-bold">
                {industry.headline} podle obcí
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {obce.map((o) => (
                  <li key={o.code}>
                    <Link
                      href={oborObecPath(industry.slug, o)}
                      className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 hover:border-brand-500 hover:bg-brand-50"
                    >
                      <span className="font-medium text-ink">{o.name}</span>
                      <span className="text-sm text-muted">{formatCount(o.industries[industry.slug]!.listable)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="seznam">
            <h2 id="seznam" className="mb-4 text-xl font-bold">
              Firmy {kraj.locative}
            </h2>
            {items.length > 0 ? <FirmList items={items} /> : <p className="rounded-2xl bg-surface p-5 text-ink-soft">V katalogu zatím nejsou žádné firmy tohoto oboru.</p>}
            <Pagination page={page} total={counts.legal} perPage={PER_PAGE} href={(p) => oborKrajPath(industry.slug, kraj.slug, p)} />
            <PersonsNote count={counts.persons} withOthers={counts.legal > 0} />
            <ListSource date={dataDate} />
          </section>
        </div>

        <aside className="space-y-8">
          <div>
            <h2 className="mb-3 text-lg font-bold">Další obory {kraj.locative}</h2>
            <ul className="space-y-1.5">
              {CATALOG_INDUSTRIES.filter((i) => i.slug !== industry.slug).map((i) => (
                <li key={i.slug}>
                  <Link href={oborKrajPath(i.slug, kraj.slug)} className="text-[15px] text-brand-700 hover:underline">
                    {i.headline}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {indexRegions().length === 1 && isIndexRegion(kraj.code) && (
            <p className="text-[15px] text-ink-soft">
              Katalog zatím obsahuje jen {kraj.name}. Firmu z jiného kraje najdete podle IČO v{" "}
              <Link href="/firmy" className="font-medium text-brand-700 underline underline-offset-4">
                katalogu
              </Link>
              .
            </p>
          )}
        </aside>
      </div>
      <div className="container-page pb-10">
        <ToolCta />
      </div>
    </>
  );
}
