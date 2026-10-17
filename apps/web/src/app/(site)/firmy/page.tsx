import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isValidIco, krajByCode, normalizeIco } from "@ez/cz";
import { FirmList } from "@/components/catalog/firm-list";
import { IconArrow, IconInvoice, IconReceipt, IconShield } from "@/components/catalog/icons";
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { dateCs, firmPath, formatCount, krajPath, monthLabel, monthPath, obecHubPath, oborKrajPath } from "@/components/catalog/paths";
import { CatalogSearch } from "@/components/catalog/search-form";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { hasFakturaPage } from "@/lib/faktura-link";
import { fitDescription, fitTitle } from "@/lib/catalog-meta";
import { canonicalMeta } from "@/lib/metadata";
import {
  catalogDataDate,
  findFirmSlug,
  foundingMonths,
  indexRegions,
  regionCounts,
  regionIndustryTotals,
  regionObecStats,
  searchFirmsByName,
  type FirmListItem,
  type ObecStats,
} from "@/lib/server/catalog";

// Katalog se renderuje na vyžádání, do ISR cache na disku nic neukládá – při milionech URL by ji zaplnil (R3.3, S2).
export const dynamic = "force-dynamic";

function indexedKraje() {
  return indexRegions()
    .map((c) => krajByCode(c))
    .filter((k): k is NonNullable<typeof k> => !!k);
}

export async function generateMetadata({ searchParams }: PageProps<"/firmy">): Promise<Metadata> {
  const { q } = await searchParams;
  const kraje = indexedKraje();
  const where = kraje.length === 1 ? ` ${kraje[0]!.locative}` : "";
  return {
    title: fitTitle([`Katalog firem${where} – IČO a EET 2.0`, "Katalog firem – IČO, sídlo a EET 2.0"]),
    description: fitDescription(
      [
        `Firmy${where} z veřejných registrů ARES a RES ČSÚ: IČO, DIČ, sídlo, obory a odhad, zda se jich týká EET 2.0.`,
        "Hledejte podle IČO nebo názvu.",
      ],
      ["Zdarma a bez registrace.", "Fakturační údaje ke zkopírování."],
    ),
    ...canonicalMeta("/firmy"),
    // výsledky hledání neindexujeme (robots.txt je navíc zakazuje: /firmy?q=)
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
        // není-li v katalogu, stránka /firma/{IČO} načte údaje živě z ARES
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

  const kraje = indexedKraje();
  const [counts, months, dataDate, perKraj] = await Promise.all([
    regionCounts().catch(() => ({}) as Record<number, number>),
    foundingMonths(12).catch(() => []),
    catalogDataDate().catch(() => null),
    Promise.all(
      kraje.map(async (k) => ({
        kraj: k,
        obce: [...(await regionObecStats(k.code).catch(() => new Map<number, ObecStats>())).values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "cs")),
        industries: await regionIndustryTotals(k.code).catch(() => ({}) as Record<string, { listable: number; legal: number }>),
      })),
    ),
  ]);
  const where = kraje.length === 1 ? ` ${kraje[0]!.locative}` : "";

  return (
    <>
      <PageHeader
        title={`Katalog firem${where}`}
        crumbs={[{ name: "Katalog firem", path: "/firmy" }]}
        lead={`Firmy${where} z veřejných registrů ARES a RES ČSÚ: IČO, DIČ, sídlo, obory činnosti a orientační odhad, zda se jich týká EET 2.0. Jen údaje z registrů, žádné vymyšlené popisy ani hodnocení.`}
      >
        <div className="mt-6 max-w-2xl">
          <CatalogSearch initial={q} size="lg" />
          <p className="mt-2 text-sm text-muted">Firmu z kterékoli části Česka zobrazíte podle IČO – údaje mimo katalog načteme živě z ARES.</p>
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
                Pro „{q}“ jsme mezi firmami nic nenašli. Podnikající fyzické osoby (OSVČ) podle jména nevyhledáváme – zadejte IČO, údaje načteme
                přímo z ARES.
              </p>
            )}
            {results && results.length > 0 && (
              <>
                <FirmList items={results} showRegion />
                <p className="mt-3 text-sm text-muted">Podle názvu hledáme jen firmy (právnické osoby). Podnikající fyzickou osobu najdete podle IČO.</p>
              </>
            )}
          </section>
        )}

        <section aria-labelledby="proc" className="grid gap-4 md:grid-cols-3">
          <h2 id="proc" className="sr-only">
            K čemu katalog slouží
          </h2>
          {[
            {
              icon: <IconInvoice className="h-6 w-6" />,
              title: "Vystavíte fakturu",
              text: hasFakturaPage()
                ? "Na stránce firmy jedním klikem předvyplníte odběratele ve faktuře zdarma, nebo zkopírujete fakturační údaje."
                : "Na stránce firmy zkopírujete fakturační údaje: název, sídlo, IČO a DIČ.",
            },
            { icon: <IconShield className="h-6 w-6" />, title: "Ověříte partnera", text: "IČO, DIČ, plátce DPH, sídlo a datum vzniku z ARES – s datem ověření a odkazem na oficiální záznam." },
            { icon: <IconReceipt className="h-6 w-6" />, title: "Zjistíte, co s EET 2.0", text: "Odhad podle oboru, zda se firmy týká evidence tržeb od 1. 1. 2027, a návod pro obor." },
          ].map((c) => (
            <div key={c.title} className="card">
              <span className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700">{c.icon}</span>
              <h3 className="mt-3 text-lg font-bold text-ink">{c.title}</h3>
              <p className="mt-1 text-[15px] text-ink-soft">{c.text}</p>
            </div>
          ))}
        </section>

        {perKraj.map(({ kraj, obce, industries }) => (
          <div key={kraj.code} className="space-y-12">
            {obce.length > 0 && (
              <section aria-labelledby={`obce-${kraj.slug}`}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <h2 id={`obce-${kraj.slug}`} className="text-2xl font-bold">
                    Obce {kraj.locative}
                  </h2>
                  <Link href={krajPath(kraj.slug)} className="inline-flex items-center gap-1 text-[15px] font-medium text-brand-700 hover:underline">
                    {kraj.name}: všechny obce a firmy ({formatCount(counts[kraj.code] ?? 0)})
                    <IconArrow />
                  </Link>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {obce.slice(0, 24).map((o) => (
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
            <section aria-labelledby={`obory-${kraj.slug}`}>
              <h2 id={`obory-${kraj.slug}`} className="mb-4 text-2xl font-bold">
                Obory {kraj.locative}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {CATALOG_INDUSTRIES.filter((i) => (industries[i.slug]?.listable ?? 0) > 0).map((i) => (
                  <li key={i.slug}>
                    <Link href={oborKrajPath(i.slug, kraj.slug)} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[15px] hover:border-brand-500 hover:bg-brand-50">
                      {i.headline}
                      {industries[i.slug]?.listable ? <span className="text-muted">{formatCount(industries[i.slug]!.listable)}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ))}

        {months.some((m) => m.legal > 0) && (
          <section aria-labelledby="nove">
            <h2 id="nove" className="mb-4 text-2xl font-bold">
              Nově založené firmy
            </h2>
            <ul className="flex flex-wrap gap-2">
              {months
                .filter((m) => m.legal > 0)
                .map((m) => (
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
            Odkud jsou data
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-[17px] text-ink-soft">
            <li>
              Zdroje: Registr ekonomických subjektů ČSÚ (otevřená data) a ARES Ministerstva financí
              {dataDate && <>; poslední aktualizace dat {dateCs(dataDate)}</>}. Provozovny firem přebíráme z ARES (živnostenský rejstřík).
            </li>
            <li>U každého subjektu uvádíme datum ověření a odkaz na oficiální záznam v ARES.</li>
            <li>„EET relevance“ je odhad podle oboru činnosti CZ-NACE, nikoli právní posouzení. Rozhoduje způsob placení.</li>
            <li>
              U podnikajících fyzických osob (OSVČ) zobrazujeme jen základní údaje a obec – bez adresy, DIČ a provozoven. Jejich stránky
              vyhledávače neindexují a v seznamech je uvádíme jen počtem. Stránky osob ani statutárních orgánů nevytváříme.
            </li>
            <li>Zaniklé subjekty ze seznamů hned vyřazujeme; jejich stránka po 90 dnech od zániku zmizí.</li>
            <li>
              Chyba nebo nesouhlas se zveřejněním? Podejte{" "}
              <Link href="/namitka" className="font-medium text-brand-700 underline underline-offset-4">
                námitku nebo žádost o opravu
              </Link>
              , vyřídíme ji nejpozději do 30 dnů. Podrobnosti v{" "}
              <Link href="/ochrana-osobnich-udaju#katalog" className="font-medium text-brand-700 underline underline-offset-4">
                zásadách ochrany osobních údajů
              </Link>
              .
            </li>
          </ul>
        </section>

        <ToolCta title="Týká se vás EET 2.0?" text="Zkontrolujte své IČO za 10 vteřin a připravte se na evidenci tržeb od 1. 1. 2027." />
      </div>
    </>
  );
}
