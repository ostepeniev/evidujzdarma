import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { classifyNaceList, krajByCode, RELEVANCE_LABEL } from "@ez/cz";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { CATALOG_INDUSTRIES, catalogIndustry } from "@/components/catalog/industry";
import { ListSource } from "@/components/catalog/list-source";
import { formatCount, krajPath, oborKrajPath, oborObecPath, obecSlug, pageParam, parseObecSlug } from "@/components/catalog/paths";
import { RelevanceChip } from "@/components/catalog/relevance";
import { ExternalLink } from "@/components/external-link";
import { FactsVerified } from "@/components/facts-verified";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { PILLAR_SLUG } from "@/components/related-guides";
import { RichText } from "@/components/rich-text";
import { ToolCta } from "@/components/tool-cta";
import { getGuide, isIndexable } from "@/content/guides";
import { obecIndustryFaq, pluralCs } from "@/lib/catalog-faq";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OBEC_MIN_FIRMS, PER_PAGE, catalogDataDate, getObecStats, isObecIndustryIndexable, listFirmItems, regionObecStats } from "@/lib/server/catalog";

// Obor × obec (S2): renderuje se na vyžádání, nic se neukládá do ISR cache na disku (R3.3). Počty jsou z agregace
// v paměti (lib/server/catalog.ts), na každé zobrazení jde jen jeden dotaz po indexu firms_listable_city_name.
export const dynamic = "force-dynamic";

function decoded(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const load = cache(async (oborSlug: string, obecParam: string, strana: string | string[] | undefined) => {
  const industry = catalogIndustry(oborSlug);
  const parsed = parseObecSlug(obecParam);
  if (!industry || !parsed) notFound();
  const stats = await getObecStats(parsed.code);
  const count = stats?.industries[industry.slug];
  if (!stats || !count || count.listable === 0) notFound();
  const canonical = obecSlug(stats);
  if (obecParam !== canonical && decoded(obecParam) !== canonical) {
    // prázdný nebo jinak zapsaný název (jiný zápis obce u firmy) → jedno přesměrování; nesmysl → 404
    if (parsed.suffix === "" || /^[a-z0-9-]{1,60}$/.test(parsed.suffix)) permanentRedirect(oborObecPath(industry.slug, stats));
    notFound();
  }
  const page = pageParam(strana);
  const pages = Math.max(1, Math.ceil(count.listable / PER_PAGE));
  if (page > pages) notFound();
  return { industry, stats, count, page, index: isObecIndustryIndexable(stats, industry.slug) };
});

export async function generateMetadata({ params, searchParams }: PageProps<"/obor/[obor]/obec/[obec]">): Promise<Metadata> {
  const { obor, obec } = await params;
  const { strana } = await searchParams;
  const { industry, stats, count, page, index } = await load(obor, obec, strana);
  const n = count.listable;
  return {
    title: `${industry.headline} ${stats.name} – EET 2.0${page > 1 ? ` (strana ${page})` : ""}`,
    description: `${industry.headline} ${stats.name}: seznam ${formatCount(n)} ${pluralCs(n, ["subjektu", "subjektů", "subjektů"])} z veřejných registrů (ARES, RES ČSÚ) a co pro obor znamená EET 2.0 od 1. 1. 2027.`,
    ...canonicalMeta(oborObecPath(industry.slug, stats, page)),
    // tenké stránky (méně než OBEC_MIN_FIRMS ověřených subjektů) a kraje mimo postupné spuštění neindexujeme
    robots: index ? undefined : { index: false, follow: true },
  };
}

export default async function IndustryObecPage({ params, searchParams }: PageProps<"/obor/[obor]/obec/[obec]">) {
  const { obor, obec } = await params;
  const { strana } = await searchParams;
  const { industry, stats, count, page } = await load(obor, obec, strana);
  const kraj = krajByCode(stats.regionCode);
  const [items, dataDate, regionStats] = await Promise.all([
    listFirmItems({ cityCode: stats.code, nacePrefixes: industry.nace }, page, PER_PAGE),
    catalogDataDate().catch(() => null),
    regionObecStats(stats.regionCode),
  ]);
  if (page > 1 && items.length === 0) notFound();

  const { relevance } = classifyNaceList(industry.nace);
  const own = industry.guide ? getGuide(industry.guide.slug) : undefined;
  const guide = own && isIndexable(own) ? own : getGuide(PILLAR_SLUG);
  const faq = obecIndustryFaq({ industryLabel: industry.label, obec: stats.name, relevance });

  // odkazy jen na stránky, které nejsou tenké (aspoň OBEC_MIN_FIRMS subjektů)
  const otherIndustries = CATALOG_INDUSTRIES.filter((i) => i.slug !== industry.slug && (stats.industries[i.slug]?.listable ?? 0) >= OBEC_MIN_FIRMS);
  const otherObce = [...regionStats.values()]
    .filter((o) => o.code !== stats.code && (o.industries[industry.slug]?.listable ?? 0) >= OBEC_MIN_FIRMS)
    .sort((a, b) => b.industries[industry.slug]!.listable - a.industries[industry.slug]!.listable || a.name.localeCompare(b.name, "cs"))
    .slice(0, 30);
  const n = count.listable;

  return (
    <>
      <JsonLd data={faqLd(faq.items)} />
      <PageHeader
        title={`${industry.headline} ${stats.name} – EET 2.0`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          ...(kraj
            ? [
                { name: kraj.name, path: krajPath(kraj.slug) },
                { name: `${industry.headline} ${kraj.locative}`, path: oborKrajPath(industry.slug, kraj.slug) },
              ]
            : []),
          { name: stats.name, path: oborObecPath(industry.slug, stats) },
        ]}
        lead={
          <>
            V katalogu je <strong>{formatCount(n)}</strong> {pluralCs(n, ["subjekt", "subjekty", "subjektů"])} se sídlem v obci {stats.name} a s oborem
            činnosti CZ-NACE {industry.nace.join(", ")} ({industry.label}). Údaje jsou z veřejných registrů.
          </>
        }
      />

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-10">
          <section className="card space-y-3" aria-labelledby="eet-obor">
            <h2 id="eet-obor" className="text-xl font-bold">
              Co znamená EET 2.0 pro obor {industry.headline.toLowerCase()}
            </h2>
            <RelevanceChip relevance={relevance} />
            <p className="text-[15px] text-ink-soft">
              Od 1. 1. 2027 se evidují platby přijaté osobně (hotovost, karta, QR kód na místě). Orientační odhad pro obor:{" "}
              <strong>{RELEVANCE_LABEL[relevance]}</strong>. U konkrétního podnikatele záleží na tom, jak mu zákazníci platí, a na výjimkách.
            </p>
            {guide && (
              <>
                <p className="text-[15px] font-semibold text-ink">Stručně z návodu „{guide.h1 ?? guide.title}“:</p>
                <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-soft">
                  {guide.summary.map((s) => (
                    <li key={s}>
                      <RichText text={s} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {guide && (
                <Link href={`/navody/${guide.slug}`} className="btn-primary">
                  {guide.slug === industry.guide?.slug ? industry.guide.label : "Kompletní průvodce EET 2.0"}
                </Link>
              )}
              <Link href="/kontrola-ico" className="btn-secondary">
                Zkontrolovat IČO
              </Link>
            </div>
          </section>

          <section aria-labelledby="seznam">
            <h2 id="seznam" className="mb-4 text-xl font-bold">
              {industry.headline} {stats.name}: seznam subjektů
            </h2>
            {items.length > 0 ? <FirmList items={items} /> : <p className="rounded-2xl bg-surface p-5 text-ink-soft">V katalogu zatím nejsou žádné subjekty tohoto oboru.</p>}
            <Pagination page={page} total={n} perPage={PER_PAGE} href={(p) => oborObecPath(industry.slug, stats, p)} />
            <ListSource date={dataDate} />
          </section>

          <section aria-labelledby="faq">
            <h2 id="faq" className="mb-6 text-2xl font-bold">
              Časté otázky
            </h2>
            <Faq items={faq.items} />
            <p className="mt-3 text-base text-muted">
              Zdroje:{" "}
              {faq.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && " · "}
                  <ExternalLink href={s.url}>{s.label}</ExternalLink>
                </span>
              ))}
            </p>
            <FactsVerified className="mt-2 text-sm text-muted" />
          </section>
        </div>

        <aside className="space-y-8">
          {otherIndustries.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold">Další obory v obci {stats.name}</h2>
              <ul className="space-y-1.5">
                {otherIndustries.map((i) => (
                  <li key={i.slug}>
                    <Link href={oborObecPath(i.slug, stats)} className="text-[15px] text-brand-700 hover:underline">
                      {i.headline}
                    </Link>{" "}
                    <span className="text-sm text-muted">({formatCount(stats.industries[i.slug]!.listable)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {otherObce.length > 0 && kraj && (
            <div>
              <h2 className="mb-3 text-lg font-bold">
                {industry.headline} v dalších obcích {kraj.locative}
              </h2>
              <ul className="space-y-1.5">
                {otherObce.map((o) => (
                  <li key={o.code}>
                    <Link href={oborObecPath(industry.slug, o)} className="text-[15px] text-brand-700 hover:underline">
                      {o.name}
                    </Link>{" "}
                    <span className="text-sm text-muted">({formatCount(o.industries[industry.slug]!.listable)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kraj && (
            <p className="text-[15px]">
              <Link href={oborKrajPath(industry.slug, kraj.slug)} className="font-medium text-brand-700 underline underline-offset-4">
                {industry.headline} {kraj.locative}
              </Link>
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
