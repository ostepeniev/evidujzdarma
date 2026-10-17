import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { classifyNaceList, krajByCode, legalFormName, legalFormShort } from "@ez/cz";
import { Facts } from "@/components/catalog/facts";
import { FirmList } from "@/components/catalog/firm-list";
import { CATALOG_INDUSTRIES, industryOfNace, type CatalogIndustry } from "@/components/catalog/industry";
import { firmLd } from "@/components/catalog/jsonld";
import { naceDivisionLabel } from "@/components/catalog/nace-labels";
import { OwnerCta } from "@/components/catalog/owner-cta";
import { AresUnavailable } from "@/components/catalog/ares-unavailable";
import { aresUrl, dateCs, establishmentPath, firmPath, krajPath, oborKrajPath, oborObecPath } from "@/components/catalog/paths";
import { RelevanceChip, RelevanceExplainer } from "@/components/catalog/relevance";
import { SourceNote } from "@/components/catalog/source-note";
import { PageHeader } from "@/components/page-header";
import { Faq } from "@/components/faq";
import { firmFaq } from "@/lib/catalog-faq";
import { fakturaLink, hasFakturaPage } from "@/lib/faktura-link";
import { kontrolaIcoHref, registraceHref } from "@/lib/hash-params";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { isClosed } from "@/lib/launch";
import { OBEC_MIN_FIRMS, sameAddressFirms, similarFirms, type FirmListItem, type FirmView } from "@/lib/server/catalog";
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

/** Dokud je pokladna zavřená (do 2. 11. 2026), vede tlačítko na předregistraci a nesmí tvrdit, že už lze evidovat. */
const START_LABEL = isClosed("/pokladna") ? "Předregistrovat se zdarma" : "Začít evidovat zdarma";

/**
 * „Podobné firmy v okolí“ (stejný obor ve stejné obci) a „Další firmy na stejné adrese“ (jen právnické osoby).
 * Jen u subjektů z naší DB, které nezanikly a mají známou obec; dva dotazy po indexech (migrace 0037).
 */
async function neighbours(firm: FirmView): Promise<{
  industry: CatalogIndustry | undefined;
  label: string | null;
  similar: FirmListItem[];
  sameAddress: { items: FirmListItem[]; more: boolean };
}> {
  const empty = { items: [] as FirmListItem[], more: false };
  if (!firm.inDb || firm.dissolvedAt || firm.cityCode == null) return { industry: undefined, label: null, similar: [], sameAddress: empty };
  const industry = industryOfNace(firm.nace);
  const division = firm.nace[0]?.slice(0, 2);
  const prefixes = industry ? industry.nace : division ? [division] : [];
  const [similar, sameAddress] = await Promise.all([
    prefixes.length ? similarFirms(firm, prefixes).catch((): FirmListItem[] => []) : Promise.resolve([] as FirmListItem[]),
    sameAddressFirms(firm).catch(() => empty),
  ]);
  return { industry, label: industry ? industry.headline : division ? naceDivisionLabel(division) : null, similar, sameAddress };
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
  const near = await neighbours(firm);
  const faq = firmFaq(
    {
      ico: firm.ico,
      name: firm.name,
      isNaturalPerson: firm.isNaturalPerson,
      dic: firm.dic,
      vatPayer: firm.vatPayer,
      foundedAt: firm.foundedAt,
      dissolvedAt: firm.dissolvedAt,
      // u OSVČ sídlo do FAQ nikdy (street je u nich null už ve view modelu)
      seat: firm.isNaturalPerson ? null : seat || null,
      establishments: firm.establishments ? firm.establishments.length : null,
      eetRelevance: firm.eetRelevance,
      matched: matched.map((m) => m.label),
      sourceDate: firm.source.date,
      sourceKind: firm.source.kind,
    },
    { kontrolaIco: kontrolaIcoHref(firm.ico) },
  );

  return (
    <>
      <JsonLd data={firmLd(firm)} />
      <JsonLd data={faqLd(faq.items)} />
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
        {!firm.dissolvedAt && (
          // IČO jen ve fragmentu (#…), nikdy v query – z milionu stránek firem by jinak vzniklo milion nových URL (COMMON 9)
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={registraceHref(firm.ico)} className="btn-primary">
              {START_LABEL}
            </Link>
            {hasFakturaPage() && (
              <Link href={fakturaLink(firm.ico)} className="btn-secondary">
                Vystavit fakturu této firmě
              </Link>
            )}
          </div>
        )}
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
                <Link href={kontrolaIcoHref(firm.ico)} className="btn-primary">
                  Ověřit EET podle IČO
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

          {near.similar.length > 0 && (
            <section aria-labelledby="podobne-firmy">
              <h2 id="podobne-firmy" className="mb-1 text-xl font-bold">
                Podobné firmy v okolí
              </h2>
              <p className="mb-4 text-[15px] text-ink-soft">
                {near.label ? `Obor ${near.label.toLowerCase()}` : "Stejný obor"}, obec {firm.city}.
              </p>
              <FirmList items={near.similar} />
              {near.industry && firm.cityCode != null && firm.city && near.similar.length >= OBEC_MIN_FIRMS - 1 && (
                <p className="mt-3 text-[15px]">
                  <Link href={oborObecPath(near.industry.slug, { code: firm.cityCode, name: firm.city })} className="font-medium text-brand-700 underline underline-offset-4">
                    {near.industry.headline} {firm.city}: celý seznam
                  </Link>
                </p>
              )}
            </section>
          )}

          {!firm.isNaturalPerson && near.sameAddress.items.length > 0 && (
            <section aria-labelledby="stejna-adresa">
              <h2 id="stejna-adresa" className="mb-1 text-xl font-bold">
                Další firmy na stejné adrese
              </h2>
              <p className="mb-4 text-[15px] text-ink-soft">
                Právnické osoby se sídlem {seat}
                {near.sameAddress.more ? ` – prvních ${near.sameAddress.items.length} podle abecedy` : ""}. Podnikající fyzické osoby tu
                neuvádíme.
              </p>
              <FirmList items={near.sameAddress.items} />
            </section>
          )}

          <section aria-labelledby="faq-firma">
            <h2 id="faq-firma" className="mb-4 text-xl font-bold">
              Časté otázky
            </h2>
            <Faq
              items={faq.items.map((it) => ({
                q: it.q,
                a: it.a,
                rich: it.link ? (
                  <p>
                    {it.a}{" "}
                    <Link href={it.link.href} className="font-medium">
                      {it.link.label}
                    </Link>
                  </p>
                ) : undefined,
              }))}
            />
            <p className="mt-3 text-sm text-muted">
              Zdroje:{" "}
              {faq.sources.map((src, i) => (
                <span key={src.url}>
                  {i > 0 && " · "}
                  <ExternalLink href={src.url}>{src.label}</ExternalLink>
                </span>
              ))}
            </p>
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
