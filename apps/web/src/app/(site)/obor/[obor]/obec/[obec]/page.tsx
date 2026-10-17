import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { classifyNaceList, krajByCode } from "@ez/cz";
import { EetPanel } from "@/components/catalog/eet-panel";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { IconBuilding, IconSparkle, IconStore, IconUser } from "@/components/catalog/icons";
import { CATALOG_INDUSTRIES, catalogIndustry } from "@/components/catalog/industry";
import { itemListLd } from "@/components/catalog/jsonld";
import { ListSource } from "@/components/catalog/list-source";
import { formatCount, firmPath, krajPath, obecHubPath, oborKrajPath, oborObecPath, obecSlug, pageParam, parseObecSlug } from "@/components/catalog/paths";
import { PersonsNote } from "@/components/catalog/persons-note";
import { StatTiles } from "@/components/catalog/stat-tiles";
import { ExternalLink } from "@/components/external-link";
import { FactsVerified } from "@/components/facts-verified";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { RichText } from "@/components/rich-text";
import { ToolCta } from "@/components/tool-cta";
import { getGuide } from "@/content/guides";
import { guideAvailable } from "@/components/catalog/eet-panel";
import { obecIndustryFaq, pluralCs } from "@/lib/catalog-faq";
import { fitDescription, fitTitle } from "@/lib/catalog-meta";
import { eetGuideFor } from "@/lib/catalog-eet";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OBEC_MIN_FIRMS, PER_PAGE, catalogDataDate, getObecStats, isObecIndustryIndexable, listFirmItems, regionObecStats } from "@/lib/server/catalog";

// Obor × obec (S2, S3): renderuje se na vyžádání, nic se neukládá do ISR cache na disku (R3.3). Počty jsou z agregace
// v paměti (lib/server/catalog.ts), na každé zobrazení jde jen jeden dotaz po indexu firms_listable_legal_city_name.
// Jmenovitě jen právnické osoby, OSVČ počtem (S3).
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
  // stránkuje se po právnických osobách (OSVČ jen počtem); stránka 1 existuje vždy
  const pages = Math.max(1, Math.ceil(count.legal / PER_PAGE));
  if (page > pages) notFound();
  return { industry, stats, count, page, index: isObecIndustryIndexable(stats, industry.slug) };
});

export async function generateMetadata({ params, searchParams }: PageProps<"/obor/[obor]/obec/[obec]">): Promise<Metadata> {
  const { obor, obec } = await params;
  const { strana } = await searchParams;
  const { industry, stats, count, page, index } = await load(obor, obec, strana);
  const n = count.listable;
  const suffix = page > 1 ? ` (strana ${page})` : "";
  return {
    title: fitTitle([`${industry.headline} ${stats.name} – firmy a EET 2.0${suffix}`, `${industry.headline} ${stats.name} – EET 2.0${suffix}`, `${industry.headline} ${stats.name}${suffix}`]),
    description: fitDescription(
      [
        `${industry.headline} ${stats.name}: ${formatCount(n)} ${pluralCs(n, ["subjekt", "subjekty", "subjektů"])} z registrů, z toho ${formatCount(count.legal)} ${pluralCs(count.legal, ["firma", "firmy", "firem"])}.`,
        `Co pro obor znamená EET 2.0 od 1. 1. 2027 a jak se připravit.`,
      ],
      ["Údaje z ARES a RES ČSÚ.", "Seznam firem s IČO a adresou."],
    ),
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
    count.legal > 0 ? listFirmItems({ cityCode: stats.code, nacePrefixes: industry.nace, legalOnly: true }, page, PER_PAGE) : Promise.resolve([]),
    catalogDataDate().catch(() => null),
    regionObecStats(stats.regionCode),
  ]);
  if (page > 1 && items.length === 0) notFound();

  const { relevance } = classifyNaceList(industry.nace);
  const guideRef = industry.guide && guideAvailable(industry.guide.slug) ? industry.guide : eetGuideFor(industry.nace, relevance, guideAvailable);
  const guide = getGuide(guideRef.slug);
  const persons = count.listable - count.legal;
  const faq = obecIndustryFaq({
    industryLabel: industry.label,
    obec: stats.name,
    relevance,
    counts: { total: count.listable, legal: count.legal, persons, asOf: dataDate },
    naceCodes: industry.nace,
  });

  // odkazy jen na stránky, které nejsou tenké (aspoň OBEC_MIN_FIRMS subjektů)
  const otherIndustries = CATALOG_INDUSTRIES.filter((i) => i.slug !== industry.slug && (stats.industries[i.slug]?.listable ?? 0) >= OBEC_MIN_FIRMS);
  const otherObce = [...regionStats.values()]
    .filter((o) => o.code !== stats.code && (o.industries[industry.slug]?.listable ?? 0) >= OBEC_MIN_FIRMS)
    .sort((a, b) => b.industries[industry.slug]!.listable - a.industries[industry.slug]!.listable || a.name.localeCompare(b.name, "cs"))
    .slice(0, 30);
  const n = count.listable;
  const heading = `${industry.headline} ${stats.name}`;

  return (
    <>
      <JsonLd data={faqLd(faq.items)} />
      {items.length > 0 && <JsonLd data={itemListLd(`${heading}: firmy`, items.map((it) => ({ name: it.name, path: firmPath(it) })), count.legal)} />}
      <PageHeader
        title={`${heading} – firmy a EET 2.0`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          ...(kraj ? [{ name: kraj.name, path: krajPath(kraj.slug) }] : []),
          { name: stats.name, path: obecHubPath(stats) },
          { name: industry.headline, path: oborObecPath(industry.slug, stats) },
        ]}
        lead={
          <>
            V katalogu je <strong>{formatCount(n)}</strong> {pluralCs(n, ["subjekt", "subjekty", "subjektů"])} se sídlem v obci {stats.name} a s oborem
            činnosti CZ-NACE {industry.nace.join(", ")} ({industry.label}). Údaje jsou z veřejných registrů.
          </>
        }
      >
        <div className="mt-6">
          <StatTiles
            items={[
              { label: "Subjektů v oboru", value: n, icon: <IconBuilding className="h-4 w-4" /> },
              { label: "Firmy (právnické osoby)", value: count.legal, icon: <IconStore className="h-4 w-4" /> },
              { label: "Živnostníci (OSVČ)", value: persons, icon: <IconUser className="h-4 w-4" /> },
              { label: "Nové za 12 měsíců", value: count.new12, icon: <IconSparkle className="h-4 w-4" />, hint: "podle data vzniku v registru" },
            ]}
          />
        </div>
      </PageHeader>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-10">
          <div className="space-y-4">
            <EetPanel relevance={relevance} nace={industry.nace} guide={guideRef} title={`EET 2.0: ${industry.headline.toLowerCase()} ${stats.name}`} />
            {guide && (
              <div className="rounded-2xl border border-line bg-white p-6">
                <p className="text-[15px] font-semibold text-ink">Stručně z návodu „{guide.h1 ?? guide.title}“:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-soft">
                  {guide.summary.map((s) => (
                    <li key={s}>
                      <RichText text={s} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[15px]">
                  <Link href={`/navody/${guide.slug}`} className="font-medium text-brand-700 underline underline-offset-4">
                    Celý návod: {guide.h1 ?? guide.title}
                  </Link>{" "}
                  ·{" "}
                  <Link href="/kontrola-ico" className="font-medium text-brand-700 underline underline-offset-4">
                    Kontrola podle IČO
                  </Link>
                </p>
              </div>
            )}
          </div>

          <section aria-labelledby="seznam">
            <h2 id="seznam" className="mb-4 text-xl font-bold">
              {heading}: seznam firem
            </h2>
            {items.length > 0 ? (
              <FirmList items={items} />
            ) : (
              <p className="rounded-2xl bg-surface p-5 text-ink-soft">V tomto oboru a obci nemáme v katalogu žádnou právnickou osobu.</p>
            )}
            <Pagination page={page} total={count.legal} perPage={PER_PAGE} href={(p) => oborObecPath(industry.slug, stats, p)} />
            <PersonsNote count={persons} withOthers={count.legal > 0} />
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
          <div className="space-y-2 text-[15px]">
            <p>
              <Link href={obecHubPath(stats)} className="font-medium text-brand-700 underline underline-offset-4">
                Všechny firmy v obci {stats.name}
              </Link>
            </p>
            {kraj && (
              <p>
                <Link href={oborKrajPath(industry.slug, kraj.slug)} className="font-medium text-brand-700 underline underline-offset-4">
                  {industry.headline} {kraj.locative}
                </Link>
              </p>
            )}
          </div>
        </aside>
      </div>
      <div className="container-page pb-10">
        <ToolCta />
      </div>
    </>
  );
}
