import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { krajBySlug } from "@ez/cz";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { formatCount, krajPath, oborKrajPath, pageParam } from "@/components/catalog/paths";
import { RELEVANCE_FILTERS, parseRelevance } from "@/components/catalog/relevance";
import { CatalogSearch } from "@/components/catalog/search-form";
import { ListSource } from "@/components/catalog/list-source";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { PER_PAGE, isIndexRegion, listFirms, catalogDataDate } from "@/lib/server/catalog";

// Stránkování a filtr přes searchParams → renderuje se na vyžádání (dotazy jdou po indexu region_code).

export async function generateMetadata({ params, searchParams }: PageProps<"/firmy/kraj/[kraj]">): Promise<Metadata> {
  const { kraj: slug } = await params;
  const sp = await searchParams;
  const kraj = krajBySlug(slug);
  if (!kraj) return {};
  const page = pageParam(sp.strana);
  const eet = parseRelevance(sp.eet);
  const { total } = await listFirms({ regionCode: kraj.code, relevance: eet }, page, PER_PAGE).catch(() => ({ total: 0 }));
  // filtrované varianty neindexujeme (duplicitní obsah), kraje mimo postupné spuštění také ne
  const index = isIndexRegion(kraj.code) && total > 0 && !eet;
  return {
    title: `Firmy ${kraj.locative}${page > 1 ? ` – strana ${page}` : ""} | Katalog firem`,
    description: `Seznam firem a podnikatelů ${kraj.locative} z veřejných registrů s orientační EET relevancí podle oboru činnosti. Údaje z ARES a RES ČSÚ.`,
    alternates: { canonical: krajPath(kraj.slug, { page }) },
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
  const [{ items, total }, dataDate] = await Promise.all([
    listFirms({ regionCode: kraj.code, relevance: eet }, page, PER_PAGE).catch(() => ({ items: [], total: 0 })),
    catalogDataDate().catch(() => null),
  ]);
  if (page > 1 && items.length === 0) notFound();

  return (
    <>
      <PageHeader
        title={`Firmy ${kraj.locative}`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          { name: kraj.name, path: krajPath(kraj.slug) },
        ]}
        lead={
          total > 0 ? (
            <>
              Subjektů v katalogu: <strong>{formatCount(total)}</strong>
              {eet && <> (filtr: {RELEVANCE_FILTERS.find((r) => r.value === eet)?.label})</>}. Řazeno podle názvu.
            </>
          ) : (
            "Pro tento kraj zatím nemáme v katalogu žádné subjekty."
          )
        }
      >
        <div className="mt-6 max-w-2xl">
          <CatalogSearch />
        </div>
      </PageHeader>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
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
          {items.length > 0 ? <FirmList items={items} /> : <p className="rounded-2xl bg-surface p-5 text-ink-soft">Žádné subjekty pro zvolený filtr.</p>}
          <Pagination page={page} total={total} perPage={PER_PAGE} href={(p) => krajPath(kraj.slug, { page: p, eet })} />
          <ListSource date={dataDate} />
        </div>

        <aside aria-labelledby="obory" className="space-y-4">
          <h2 id="obory" className="text-lg font-bold">
            Obory {kraj.locative}
          </h2>
          <ul className="space-y-1.5">
            {CATALOG_INDUSTRIES.map((i) => (
              <li key={i.slug}>
                <Link href={oborKrajPath(i.slug, kraj.slug)} className="text-[15px] text-brand-700 hover:underline">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <div className="container-page pb-10">
        <ToolCta title="Podnikáte v tomto kraji?" text="Zkontrolujte, zda se vás týká EET 2.0, a začněte evidovat v pokladně zdarma." />
      </div>
    </>
  );
}
