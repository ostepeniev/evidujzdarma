import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { krajByCode } from "@ez/cz";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { IconBuilding, IconSparkle, IconStore, IconUser } from "@/components/catalog/icons";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { itemListLd } from "@/components/catalog/jsonld";
import { ListSource } from "@/components/catalog/list-source";
import { firmPath, formatCount, krajPath, obecHubPath, obecSlug, oborObecPath, pageParam, parseObecSlug } from "@/components/catalog/paths";
import { PersonsNote } from "@/components/catalog/persons-note";
import { StatTiles } from "@/components/catalog/stat-tiles";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { FACTS, SOURCES } from "@/content/facts";
import { pluralCs } from "@/lib/catalog-faq";
import { fitDescription, fitTitle } from "@/lib/catalog-meta";
import { dateCs } from "@/lib/catalog-summary";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OBEC_MIN_FIRMS, PER_PAGE, catalogDataDate, getObecStats, isObecHubIndexable, listFirmItems, recentLegalFirms, regionObecStats } from "@/lib/server/catalog";

/**
 * Rozcestník obce (S3): /firmy/obec/{kód}-{slug}. Počty z agregace kraje v paměti, na zobrazení jdou dva dotazy po indexu
 * firms_listable_legal_city_name (seznam firem a nové firmy). Jmenovitě jen právnické osoby, OSVČ počtem.
 * Index jen s aspoň OBEC_HUB_MIN_FIRMS subjekty ověřenými v ARES (isObecHubIndexable).
 */
export const dynamic = "force-dynamic";

function decoded(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const load = cache(async (obecParam: string, strana: string | string[] | undefined) => {
  const parsed = parseObecSlug(obecParam);
  if (!parsed) notFound();
  const stats = await getObecStats(parsed.code);
  if (!stats || stats.total === 0) notFound();
  const canonical = obecSlug(stats);
  if (obecParam !== canonical && decoded(obecParam) !== canonical) {
    if (parsed.suffix === "" || /^[a-z0-9-]{1,60}$/.test(parsed.suffix)) permanentRedirect(obecHubPath(stats));
    notFound();
  }
  const page = pageParam(strana);
  if (page > Math.max(1, Math.ceil(stats.legal / PER_PAGE))) notFound();
  return { stats, page, index: isObecHubIndexable(stats) };
});

export async function generateMetadata({ params, searchParams }: PageProps<"/firmy/obec/[obec]">): Promise<Metadata> {
  const { obec } = await params;
  const { strana } = await searchParams;
  const { stats, page, index } = await load(obec, strana);
  const suffix = page > 1 ? ` (strana ${page})` : "";
  return {
    title: fitTitle([`Firmy ${stats.name} – katalog a EET 2.0${suffix}`, `Firmy ${stats.name} – EET 2.0${suffix}`, `Firmy ${stats.name}${suffix}`]),
    description: fitDescription(
      [
        `Firmy a podnikatelé se sídlem v obci ${stats.name}: ${formatCount(stats.total)} ${pluralCs(stats.total, ["subjekt", "subjekty", "subjektů"])} z registrů, z toho ${formatCount(stats.legal)} ${pluralCs(stats.legal, ["firma", "firmy", "firem"])}.`,
        "Obory, nové firmy a co znamená EET 2.0.",
      ],
      ["Údaje z ARES a RES ČSÚ.", "Zdarma a bez registrace."],
    ),
    ...canonicalMeta(obecHubPath(stats, page)),
    robots: index ? undefined : { index: false, follow: true },
  };
}

export default async function ObecHubPage({ params, searchParams }: PageProps<"/firmy/obec/[obec]">) {
  const { obec } = await params;
  const { strana } = await searchParams;
  const { stats, page } = await load(obec, strana);
  const kraj = krajByCode(stats.regionCode);
  const [items, recent, dataDate, regionStats] = await Promise.all([
    stats.legal > 0 ? listFirmItems({ cityCode: stats.code, legalOnly: true }, page, PER_PAGE) : Promise.resolve([]),
    page === 1 ? recentLegalFirms(stats.code, 8).catch(() => []) : Promise.resolve([]),
    catalogDataDate().catch(() => null),
    regionObecStats(stats.regionCode),
  ]);
  if (page > 1 && items.length === 0) notFound();
  const persons = stats.total - stats.legal;
  const industries = CATALOG_INDUSTRIES.map((i) => ({ i, c: stats.industries[i.slug] }))
    .filter((x) => (x.c?.listable ?? 0) > 0)
    .sort((a, b) => b.c!.listable - a.c!.listable);
  const otherObce = [...regionStats.values()]
    .filter((o) => o.code !== stats.code && o.total >= OBEC_MIN_FIRMS)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "cs"))
    .slice(0, 30);

  const faq = [
    {
      q: `Kolik firem a podnikatelů sídlí v obci ${stats.name}?`,
      a: `V katalogu je ${stats.total} ${pluralCs(stats.total, ["subjekt", "subjekty", "subjektů"])} se sídlem v obci ${stats.name}: ${stats.legal} ${pluralCs(stats.legal, ["právnická osoba", "právnické osoby", "právnických osob"])} a ${persons} ${pluralCs(persons, ["podnikající fyzická osoba", "podnikající fyzické osoby", "podnikajících fyzických osob"])} (OSVČ). Za posledních 12 měsíců vzniklo ${stats.new12}. Počítáme jen subjekty, které nezanikly.${dataDate ? ` Údaje z registrů ARES a RES ČSÚ k ${dateCs(dataDate)}.` : ""}`,
    },
    {
      q: `Musí podnikatelé v obci ${stats.name} evidovat tržby?`,
      a: `${FACTS.whoMust.summary} Povinnost platí od ${FACTS.law.effectiveFrom} (${FACTS.law.sbNo}). Rozhoduje způsob placení, ne obec ani obor: ${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}`,
    },
  ];
  const faqSources = [...new Map([...FACTS.whoMust.sources, ...FACTS.evidenced.sources, SOURCES.eetGov].map((s) => [s.url, s])).values()];

  return (
    <>
      <JsonLd data={faqLd(faq)} />
      {items.length > 0 && <JsonLd data={itemListLd(`Firmy ${stats.name}`, items.map((it) => ({ name: it.name, path: firmPath(it) })), stats.legal)} />}
      <PageHeader
        title={`Firmy ${stats.name}`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          ...(kraj ? [{ name: kraj.name, path: krajPath(kraj.slug) }] : []),
          { name: stats.name, path: obecHubPath(stats) },
        ]}
        lead={
          <>
            Firmy a podnikatelé se sídlem v obci {stats.name}
            {kraj && <> ({kraj.name})</>} z veřejných registrů: obory činnosti, nově založené firmy a co pro ně znamená EET 2.0.
          </>
        }
      >
        <div className="mt-6">
          <StatTiles
            items={[
              { label: "Subjektů celkem", value: stats.total, icon: <IconBuilding className="h-4 w-4" /> },
              { label: "Firmy (právnické osoby)", value: stats.legal, icon: <IconStore className="h-4 w-4" /> },
              { label: "Živnostníci (OSVČ)", value: persons, icon: <IconUser className="h-4 w-4" /> },
              { label: "Nové za 12 měsíců", value: stats.new12, icon: <IconSparkle className="h-4 w-4" />, hint: "podle data vzniku v registru" },
            ]}
          />
        </div>
      </PageHeader>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-10">
          {industries.length > 0 && (
            <section aria-labelledby="obory">
              <h2 id="obory" className="mb-1 text-xl font-bold">
                Obory v obci {stats.name}
              </h2>
              <p className="mb-4 text-[15px] text-ink-soft">Podle oborů činnosti CZ-NACE z registru. U každého oboru i co pro něj znamená EET 2.0.</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {industries.map(({ i, c }) => (
                  <li key={i.slug}>
                    {c!.listable >= OBEC_MIN_FIRMS ? (
                      <Link
                        href={oborObecPath(i.slug, stats)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 hover:border-brand-500 hover:bg-brand-50"
                      >
                        <span className="font-medium text-ink">{i.headline}</span>
                        <span className="shrink-0 text-sm text-muted">{formatCount(c!.listable)}</span>
                      </Link>
                    ) : (
                      <span className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-ink-soft">
                        <span>{i.headline}</span>
                        <span className="shrink-0 text-sm text-muted">{formatCount(c!.listable)}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recent.length > 0 && (
            <section aria-labelledby="nove">
              <h2 id="nove" className="mb-1 text-xl font-bold">
                Nové firmy v obci {stats.name}
              </h2>
              <p className="mb-4 text-[15px] text-ink-soft">Právnické osoby s datem vzniku za posledních 12 měsíců, od nejnovější.</p>
              <FirmList items={recent} showFounded />
            </section>
          )}

          <section aria-labelledby="seznam">
            <h2 id="seznam" className="mb-4 text-xl font-bold">
              Všechny firmy v obci {stats.name}
            </h2>
            {items.length > 0 ? <FirmList items={items} /> : <p className="rounded-2xl bg-surface p-5 text-ink-soft">V této obci nemáme v katalogu žádnou právnickou osobu.</p>}
            <Pagination page={page} total={stats.legal} perPage={PER_PAGE} href={(p) => obecHubPath(stats, p)} />
            <PersonsNote count={persons} withOthers={stats.legal > 0} />
            <ListSource date={dataDate} />
          </section>

          <section aria-labelledby="faq">
            <h2 id="faq" className="mb-6 text-2xl font-bold">
              Časté otázky
            </h2>
            <Faq items={faq} />
            <p className="mt-3 text-base text-muted">
              Zdroje:{" "}
              {faqSources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && " · "}
                  <ExternalLink href={s.url}>{s.label}</ExternalLink>
                </span>
              ))}
            </p>
          </section>
        </div>

        <aside className="space-y-8">
          {otherObce.length > 0 && kraj && (
            <div>
              <h2 className="mb-3 text-lg font-bold">Další obce {kraj.locative}</h2>
              <ul className="space-y-1.5">
                {otherObce.map((o) => (
                  <li key={o.code}>
                    <Link href={obecHubPath(o)} className="text-[15px] text-brand-700 hover:underline">
                      {o.name}
                    </Link>{" "}
                    <span className="text-sm text-muted">({formatCount(o.total)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kraj && (
            <p className="text-[15px]">
              <Link href={krajPath(kraj.slug)} className="font-medium text-brand-700 underline underline-offset-4">
                Firmy {kraj.locative}
              </Link>
            </p>
          )}
        </aside>
      </div>
      <div className="container-page pb-10">
        <ToolCta title="Podnikáte v této obci?" />
      </div>
    </>
  );
}
