import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KRAJE, isValidIco, krajByCode, normalizeIco } from "@ez/cz";
import { FirmList } from "@/components/catalog/firm-list";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { dateCs, firmPath, formatCount, krajPath, monthLabel, monthPath, oborKrajPath } from "@/components/catalog/paths";
import { CatalogSearch } from "@/components/catalog/search-form";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { catalogDataDate, findFirmSlug, foundingMonths, indexRegions, regionCounts, searchFirmsByName, type FirmListItem } from "@/lib/server/catalog";

export async function generateMetadata({ searchParams }: PageProps<"/firmy">): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: "Katalog firem a provozoven – EET 2.0 podle IČO",
    description:
      "Firmy a provozovny z veřejných registrů ARES a RŽP s orientační EET relevancí podle oboru. Jen ověřené údaje z registrů, bez vymyšlených popisů. Vyhledávejte podle IČO nebo názvu.",
    alternates: { canonical: "/firmy" },
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function CatalogHome({ searchParams }: PageProps<"/firmy">) {
  const { q: rawQ } = await searchParams;
  const q = (typeof rawQ === "string" ? rawQ : "").trim().slice(0, 100);

  let results: FirmListItem[] | null = null;
  let error: string | null = null;
  if (q) {
    const digits = q.replace(/\s+/g, "");
    if (/^\d+$/.test(digits)) {
      const ico = normalizeIco(digits);
      if (ico && isValidIco(ico)) {
        const slug = await findFirmSlug(ico).catch(() => null);
        // není-li v katalogu, stránka firmy si údaje načte živě z ARES
        redirect(slug ? firmPath({ ico, slug }) : `/firma/${ico}`);
      }
      error = "Zadané IČO není platné. IČO má 8 číslic a poslední z nich je kontrolní.";
    } else if (q.length < 2) {
      error = "Zadejte alespoň 2 znaky názvu.";
    } else {
      try {
        results = await searchFirmsByName(q, 20);
      } catch {
        error = "Vyhledávání je dočasně nedostupné. Zkuste to prosím za chvíli.";
      }
    }
  }

  const [counts, months, dataDate] = await Promise.all([
    regionCounts().catch(() => ({}) as Record<number, number>),
    foundingMonths(6).catch(() => []),
    catalogDataDate().catch(() => null),
  ]);
  const indexed = indexRegions()
    .map((c) => krajByCode(c))
    .filter((k): k is NonNullable<typeof k> => !!k);

  return (
    <>
      <PageHeader
        title="Katalog firem a provozoven"
        crumbs={[{ name: "Katalog firem", path: "/firmy" }]}
        lead="Firmy a provozovny z veřejných registrů s orientačním posouzením, zda se jich týká EET 2.0. Zobrazujeme jen údaje z registrů – žádné vymyšlené popisy ani hodnocení."
      >
        <div className="mt-6 max-w-2xl">
          <CatalogSearch initial={q} size="lg" />
        </div>
      </PageHeader>

      <div className="container-page space-y-14 py-10">
        {(error || results) && (
          <section aria-labelledby="vysledky">
            <h2 id="vysledky" className="mb-4 text-2xl font-bold">
              Výsledky hledání
            </h2>
            {error && (
              <p role="alert" className="rounded-2xl bg-danger-50 p-5 text-danger-600">
                {error}
              </p>
            )}
            {results && results.length === 0 && (
              <p className="rounded-2xl bg-surface p-5 text-ink-soft">
                Pro „{q}“ jsme v katalogu nic nenašli. Znáte IČO? Zadejte ho – údaje načteme přímo z ARES.
              </p>
            )}
            {results && results.length > 0 && <FirmList items={results} showRegion />}
          </section>
        )}

        <section aria-labelledby="kraje">
          <h2 id="kraje" className="mb-4 text-2xl font-bold">
            Firmy podle krajů
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {KRAJE.map((k) => (
              <li key={k.code}>
                <Link href={krajPath(k.slug)} className="flex items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 hover:border-brand-500 hover:bg-brand-50">
                  <span className="font-semibold text-ink">{k.name}</span>
                  {counts[k.code] ? <span className="text-sm text-muted">{formatCount(counts[k.code]!)}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {indexed.map((k) => (
          <section key={k.code} aria-labelledby={`obory-${k.slug}`}>
            <h2 id={`obory-${k.slug}`} className="mb-4 text-2xl font-bold">
              Obory {k.locative}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {CATALOG_INDUSTRIES.map((i) => (
                <li key={i.slug}>
                  <Link href={oborKrajPath(i.slug, k.slug)} className="inline-block rounded-full border border-line bg-white px-4 py-2 text-[15px] hover:border-brand-500 hover:bg-brand-50">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {months.length > 0 && (
          <section aria-labelledby="nove">
            <h2 id="nove" className="mb-4 text-2xl font-bold">
              Nově založené firmy
            </h2>
            <ul className="flex flex-wrap gap-2">
              {months.map((m) => (
                <li key={m.month}>
                  <Link href={monthPath(m.month)} className="inline-block rounded-full border border-line bg-white px-4 py-2 text-[15px] hover:border-brand-500 hover:bg-brand-50">
                    {monthLabel(m.month)} <span className="text-muted">({formatCount(m.count)})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="o-katalogu" className="max-w-3xl">
          <h2 id="o-katalogu" className="mb-4 text-2xl font-bold">
            Jak katalog vzniká
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-[17px] text-ink-soft">
            <li>
              Zdroje: Registr ekonomických subjektů ČSÚ (otevřená data), ARES Ministerstva financí a živnostenský rejstřík (provozovny)
              {dataDate && <>; poslední aktualizace dat {dateCs(dataDate)}</>}.
            </li>
            <li>U každého subjektu uvádíme datum ověření a odkaz na oficiální záznam v ARES.</li>
            <li>„EET relevance“ je odhad podle oboru činnosti CZ-NACE, nikoli právní posouzení.</li>
            <li>U fyzických osob (OSVČ) nezobrazujeme adresu, jen obec a kraj. Stránky osob ani statutárních orgánů nevytváříme.</li>
            <li>
              Chyba nebo nesouhlas se zveřejněním? Podejte{" "}
              <Link href="/namitka" className="font-medium text-brand-700 underline underline-offset-4">
                námitku nebo žádost o opravu
              </Link>
              .
            </li>
          </ul>
        </section>

        <ToolCta title="Týká se vás EET 2.0?" text="Zkontrolujte své IČO za 10 vteřin a připravte se s pokladnou zdarma – funguje i bez signálu." />
      </div>
    </>
  );
}
