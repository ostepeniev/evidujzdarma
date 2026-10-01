import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KRAJE, classifyNaceList, krajBySlug, RELEVANCE_LABEL } from "@ez/cz";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { CATALOG_INDUSTRIES, catalogIndustry } from "@/components/catalog/industry";
import { formatCount, krajPath, oborKrajPath, pageParam } from "@/components/catalog/paths";
import { RelevanceChip } from "@/components/catalog/relevance";
import { ListSource } from "@/components/catalog/list-source";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { PER_PAGE, isIndexRegion, listFirms, catalogDataDate } from "@/lib/server/catalog";

function resolve(oborSlug: string, krajSlug: string) {
  const industry = catalogIndustry(oborSlug);
  const kraj = krajBySlug(krajSlug);
  if (!industry || !kraj) notFound();
  return { industry, kraj };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/obor/[obor]/kraj/[kraj]">): Promise<Metadata> {
  const { obor, kraj: krajSlug } = await params;
  const sp = await searchParams;
  const { industry, kraj } = resolve(obor, krajSlug);
  const page = pageParam(sp.strana);
  const { total } = await listFirms({ regionCode: kraj.code, nacePrefixes: industry.nace }, page, PER_PAGE).catch(() => ({ total: 0 }));
  return {
    title: `${industry.label} ${kraj.locative} – EET 2.0${page > 1 ? ` (strana ${page})` : ""}`,
    description: `${industry.label} ${kraj.locative}: subjekty z veřejných registrů (ARES, RES ČSÚ) podle oboru CZ-NACE a co pro obor znamená EET 2.0 od 1. 1. 2027.`,
    alternates: { canonical: oborKrajPath(industry.slug, kraj.slug, page) },
    robots: isIndexRegion(kraj.code) && total > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function IndustryRegionPage({ params, searchParams }: PageProps<"/obor/[obor]/kraj/[kraj]">) {
  const { obor, kraj: krajSlug } = await params;
  const sp = await searchParams;
  const { industry, kraj } = resolve(obor, krajSlug);
  const page = pageParam(sp.strana);
  const [{ items, total }, dataDate] = await Promise.all([
    listFirms({ regionCode: kraj.code, nacePrefixes: industry.nace }, page, PER_PAGE).catch(() => ({ items: [], total: 0 })),
    catalogDataDate().catch(() => null),
  ]);
  if (page > 1 && items.length === 0) notFound();
  const { relevance } = classifyNaceList(industry.nace);

  return (
    <>
      <PageHeader
        title={`${industry.label} ${kraj.locative}`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          { name: kraj.name, path: krajPath(kraj.slug) },
          { name: industry.label, path: oborKrajPath(industry.slug, kraj.slug) },
        ]}
        lead={
          <>
            Subjekty z veřejných registrů s oborem činnosti CZ-NACE {industry.nace.join(", ")}. Počet v katalogu: <strong>{formatCount(total)}</strong>.
          </>
        }
      />

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          <section className="card space-y-3" aria-labelledby="eet-obor">
            <h2 id="eet-obor" className="text-xl font-bold">
              EET 2.0 v oboru
            </h2>
            <RelevanceChip relevance={relevance} />
            <p className="text-[15px] text-ink-soft">
              Orientační odhad pro obor: <strong>{RELEVANCE_LABEL[relevance]}</strong>. Evidují se platby přijaté osobně (hotovost, karta, QR kód
              na místě); u konkrétní firmy záleží na způsobu plateb a výjimkách.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {industry.guide ? (
                <Link href={industry.guide.href} className="btn-primary">
                  {industry.guide.label}
                </Link>
              ) : (
                <Link href="/navody/koho-se-eet-tyka" className="btn-primary">
                  Koho se EET týká
                </Link>
              )}
              <Link href="/kontrola-ico" className="btn-secondary">
                Zkontrolovat IČO
              </Link>
            </div>
          </section>

          <section aria-labelledby="seznam">
            <h2 id="seznam" className="mb-4 text-xl font-bold">
              Subjekty {kraj.locative}
            </h2>
            {items.length > 0 ? <FirmList items={items} /> : <p className="rounded-2xl bg-surface p-5 text-ink-soft">V katalogu zatím nejsou žádné subjekty tohoto oboru.</p>}
            <Pagination page={page} total={total} perPage={PER_PAGE} href={(p) => oborKrajPath(industry.slug, kraj.slug, p)} />
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
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-bold">{industry.label} v dalších krajích</h2>
            <ul className="space-y-1.5">
              {KRAJE.filter((k) => k.code !== kraj.code).map((k) => (
                <li key={k.code}>
                  <Link href={oborKrajPath(industry.slug, k.slug)} className="text-[15px] text-brand-700 hover:underline">
                    {k.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <div className="container-page pb-10">
        <ToolCta />
      </div>
    </>
  );
}
