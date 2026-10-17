import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { krajBySlug } from "@ez/cz";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { IconBuilding, IconStore, IconUser } from "@/components/catalog/icons";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { itemListLd } from "@/components/catalog/jsonld";
import { ListSource } from "@/components/catalog/list-source";
import { firmPath, formatCount, krajPath, obecHubPath, oborKrajPath, pageParam } from "@/components/catalog/paths";
import { PersonsNote } from "@/components/catalog/persons-note";
import { RELEVANCE_FILTERS, parseRelevance } from "@/components/catalog/relevance";
import { CatalogSearch } from "@/components/catalog/search-form";
import { StatTiles } from "@/components/catalog/stat-tiles";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { pluralCs } from "@/lib/catalog-faq";
import { fitDescription, fitTitle } from "@/lib/catalog-meta";
import { JsonLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { PER_PAGE, catalogDataDate, isIndexRegion, listCounts, listFirmItems, listFirms, regionIndustryTotals, regionObecStats, type ObecStats } from "@/lib/server/catalog";

// Katalog se renderuje na vyžádání, do ISR cache na disku nic neukládá – při milionech URL by ji zaplnil (R3.3, S2).
// S3: obce s počty, obory, jmenovitě jen právnické osoby (index firms_listable_legal_region_name), OSVČ počtem.
export const dynamic = "force-dynamic";

const ZERO = { total: 0, legal: 0, persons: 0 };

export async function generateMetadata({ params, searchParams }: PageProps<"/firmy/kraj/[kraj]">): Promise<Metadata> {
  const { kraj: slug } = await params;
  const sp = await searchParams;
  const kraj = krajBySlug(slug);
  if (!kraj) return {};
  const page = pageParam(sp.strana);
  const eet = parseRelevance(sp.eet);
  const counts = await listCounts({ regionCode: kraj.code }).catch(() => ZERO);
  // filtrované varianty neindexujeme (duplicitní obsah), kraje mimo postupné spuštění také ne
  const index = isIndexRegion(kraj.code) && counts.total > 0 && !eet;
  const suffix = page > 1 ? ` (strana ${page})` : "";
  return {
    title: fitTitle([`Firmy ${kraj.locative} – katalog a EET 2.0${suffix}`, `Firmy ${kraj.locative}${suffix}`]),
    description: fitDescription(
      [
        `Firmy a podnikatelé ${kraj.locative}: ${formatCount(counts.total)} ${pluralCs(counts.total, ["subjekt", "subjekty", "subjektů"])} z veřejných registrů podle obcí a oborů.`,
        "Seznam firem s IČO a co pro ně znamená EET 2.0.",
      ],
      ["Údaje z ARES a RES ČSÚ.", "Zdarma a bez registrace."],
    ),
    ...canonicalMeta(krajPath(kraj.slug, { page })),
    robots: index ? undefined : { index: false, follow: true },
  };
}

export default async function KrajPage({ params, searchParams }: PageProps<"/firmy/kraj/[kraj]">) {
  const { kraj: slug } = await params;
  const sp = await searchParams;
  const kraj = krajBySlug(slug);
  if (!kraj) notFound();
  const page = pageParam(sp.strana);
  const eet = parseRelevance(sp.eet);
  const counts = await listCounts({ regionCode: kraj.code }).catch(() => ZERO);
  // bez filtru je počet firem známý z listCounts (v paměti) – jde jen dotaz na stránku seznamu; s filtrem i count
  const list = eet
    ? listFirms({ regionCode: kraj.code, relevance: eet, legalOnly: true }, page, PER_PAGE).catch(() => ({ items: [], total: 0 }))
    : listFirmItems({ regionCode: kraj.code, legalOnly: true }, page, PER_PAGE).then((items) => ({ items, total: counts.legal }), () => ({ items: [], total: 0 }));
  const [{ items, total: legalFiltered }, dataDate, obceStats, industryTotals] = await Promise.all([
    list,
    catalogDataDate().catch(() => null),
    regionObecStats(kraj.code).catch(() => new Map<number, ObecStats>()),
    regionIndustryTotals(kraj.code).catch(() => ({}) as Record<string, { listable: number; legal: number }>),
  ]);
  if (page > 1 && items.length === 0) notFound();
  const obce = [...obceStats.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "cs"));
  const industries = CATALOG_INDUSTRIES.map((i) => ({ i, n: industryTotals[i.slug]?.listable ?? 0 })).filter((x) => x.n > 0);

  return (
    <>
      {items.length > 0 && !eet && <JsonLd data={itemListLd(`Firmy ${kraj.locative}`, items.map((it) => ({ name: it.name, path: firmPath(it) })), counts.legal)} />}
      <PageHeader
        title={`Firmy ${kraj.locative}`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          { name: kraj.name, path: krajPath(kraj.slug) },
        ]}
        lead={
          counts.total > 0 ? (
            <>Firmy a podnikatelé {kraj.locative} z veřejných registrů – podle obcí a oborů, s odhadem, zda se jich týká EET 2.0.</>
          ) : (
            <>Pro tento kraj zatím nemáme v katalogu žádné subjekty. Firmu odkudkoli najdete podle IČO.</>
          )
        }
      >
        <div className="mt-6 max-w-2xl">
          <CatalogSearch />
        </div>
        {counts.total > 0 && (
          <div className="mt-6">
            <StatTiles
              items={[
                { label: "Subjektů celkem", value: counts.total, icon: <IconBuilding className="h-4 w-4" /> },
                { label: "Firmy (právnické osoby)", value: counts.legal, icon: <IconStore className="h-4 w-4" /> },
                { label: "Živnostníci (OSVČ)", value: counts.persons, icon: <IconUser className="h-4 w-4" /> },
                { label: "Obcí", value: obce.length, icon: <IconBuilding className="h-4 w-4" /> },
              ]}
            />
          </div>
        )}
      </PageHeader>

      <div className="container-page space-y-12 py-10">
        {obce.length > 0 && (
          <section aria-labelledby="obce">
            <h2 id="obce" className="mb-4 text-2xl font-bold">
              Obce {kraj.locative}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {obce.map((o) => (
                <li key={o.code}>
                  <Link href={obecHubPath(o)} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-2.5 hover:border-brand-500 hover:bg-brand-50">
                    <span className="truncate font-medium text-ink">{o.name}</span>
                    <span className="shrink-0 text-sm text-muted">{formatCount(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {industries.length > 0 && (
          <section aria-labelledby="obory">
            <h2 id="obory" className="mb-4 text-2xl font-bold">
              Obory {kraj.locative}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {industries.map(({ i, n }) => (
                <li key={i.slug}>
                  <Link href={oborKrajPath(i.slug, kraj.slug)} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[15px] hover:border-brand-500 hover:bg-brand-50">
                    {i.headline} <span className="text-muted">{formatCount(n)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="seznam" className="max-w-4xl">
          <h2 id="seznam" className="mb-4 text-2xl font-bold">
            Firmy {kraj.locative} podle názvu
          </h2>
          <nav aria-label="Filtr EET relevance" className="mb-5 flex flex-wrap gap-2">
            <Link
              href={krajPath(kraj.slug)}
              aria-current={!eet ? "page" : undefined}
              className={`rounded-full border px-4 py-2 text-[15px] ${!eet ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
            >
              Vše
            </Link>
            {RELEVANCE_FILTERS.map((r) => (
              <Link
                key={r.value}
                href={krajPath(kraj.slug, { eet: r.value })}
                rel="nofollow"
                aria-current={eet === r.value ? "page" : undefined}
                className={`rounded-full border px-4 py-2 text-[15px] ${eet === r.value ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
              >
                {r.label}
              </Link>
            ))}
          </nav>
          {items.length > 0 ? <FirmList items={items} /> : <p className="rounded-2xl bg-surface p-5 text-ink-soft">Žádné firmy pro zvolený filtr.</p>}
          <Pagination page={page} total={legalFiltered} perPage={PER_PAGE} href={(p) => krajPath(kraj.slug, { page: p, eet })} />
          {!eet && <PersonsNote count={counts.persons} withOthers={counts.legal > 0} />}
          <ListSource date={dataDate} />
        </section>
      </div>
      <div className="container-page pb-10">
        <ToolCta title="Podnikáte v tomto kraji?" />
      </div>
    </>
  );
}
