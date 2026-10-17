import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { classifyNaceList, krajByCode, legalFormName, legalFormShort } from "@ez/cz";
import { AresUnavailable } from "@/components/catalog/ares-unavailable";
import { CopyButton } from "@/components/catalog/copy-button";
import { EetPanel } from "@/components/catalog/eet-panel";
import { FirmList } from "@/components/catalog/firm-list";
import { IconBuilding, IconCalendar, IconCopy, IconId, IconInvoice, IconPercent, IconPin, IconQr, IconReceipt, IconScale, IconShield, IconStore } from "@/components/catalog/icons";
import { CATALOG_INDUSTRIES, industryOfNace, type CatalogIndustry } from "@/components/catalog/industry";
import { firmLd, firmPageLd } from "@/components/catalog/jsonld";
import { naceDivisionLabel } from "@/components/catalog/nace-labels";
import { OwnerCta } from "@/components/catalog/owner-cta";
import { aresUrl, dateCs, establishmentPath, inPublicRegister, justiceUrl, krajPath, mapyUrl, obecHubPath, oborKrajPath, oborObecPath } from "@/components/catalog/paths";
import { SourceNote } from "@/components/catalog/source-note";
import { ExternalLink } from "@/components/external-link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { firmFaq } from "@/lib/catalog-faq";
import { fitDescription, fitTitle, truncateWords } from "@/lib/catalog-meta";
import { billingText, firmSummary, naceHuman } from "@/lib/catalog-summary";
import { fakturaLink, hasFakturaPage } from "@/lib/faktura-link";
import { kontrolaIcoHref } from "@/lib/hash-params";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OBEC_MIN_FIRMS, isIndexRegion, regionObecStats, sameAddressFirms, similarFirms, type FirmListItem, type FirmView, type ObecStats } from "@/lib/server/catalog";
import { firmPagePath, loadFirmPage } from "@/lib/server/firm-page";
import { clientIpFromHeaders } from "@/lib/server/rate-limit";

// Stránky firem se renderují pro každý požadavek a neukládají se do ISR cache na disk: miliony
// platných IČO by ji jinak mohly zaplnit (R3.3). Data z DB jsou levná, živé dotazy do ARES mají limit na IP.
// Sdílenou cache (Cache-Control z next.config, mikrocache nginx) má jen /firma/{IČO}-{slug} – živý náhled je /firma/{IČO} (S3).
export const dynamic = "force-dynamic";

async function loadFirm(slug: string) {
  return loadFirmPage(slug, clientIpFromHeaders(await headers()));
}

function seatOf(firm: FirmView): string {
  return [firm.street, [firm.postalCode?.replace(/^(\d{3})(\d{2})$/, "$1 $2"), firm.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function summaryOf(firm: FirmView): string {
  return firmSummary({
    name: firm.name,
    ico: firm.ico,
    legalForm: firm.legalForm,
    isNaturalPerson: firm.isNaturalPerson,
    city: firm.city,
    hasSeat: !firm.isNaturalPerson && !!firm.street,
    foundedAt: firm.foundedAt,
    dissolvedAt: firm.dissolvedAt,
    nace: firm.nace,
  });
}

function titleOf(firm: FirmView): { absolute: string } {
  // dlouhý název se zkrátí po slovech, „– IČO …“ (16 znaků) zůstane vždy
  return fitTitle([`${firm.name} – IČO ${firm.ico}`, `${truncateWords(firm.name, 44)} – IČO ${firm.ico}`]);
}

function descriptionOf(firm: FirmView): string {
  const asOf = `${firm.source.kind === "ares" ? "z ARES" : "z RES ČSÚ"} k ${dateCs(firm.source.date)}`;
  if (firm.isNaturalPerson) {
    return fitDescription(
      [`${firm.name}, IČO ${firm.ico}${firm.city ? `, obec ${firm.city}` : ""}.`, `Základní údaje ${asOf}, fakturační údaje ke zkopírování a odhad, zda se podnikatele týká EET 2.0.`],
      ["Jen veřejné údaje z registrů.", "Podnikající fyzická osoba."],
    );
  }
  return fitDescription(
    [
      `${firm.name}, IČO ${firm.ico}${firm.city ? `, sídlo ${firm.city}` : ""}.`,
      "Fakturační údaje ke zkopírování a odhad EET 2.0.",
      `${firm.dic ? "DIČ, plátce DPH a obory" : "Obory a údaje"} ${asOf}.`,
    ],
    ["Jen veřejné údaje z registrů.", "Zdroj ARES."],
  );
}

/**
 * Okolí firmy: statistika obce (agregace v paměti), „Podobné firmy v obci“ a „Na stejné adrese“ – jen právnické osoby,
 * jen u subjektů z DB, které nezanikly a mají známou obec; dva dotazy po indexech (migrace 0037, 0038).
 */
async function neighbours(firm: FirmView): Promise<{
  stats: ObecStats | null;
  industry: CatalogIndustry | undefined;
  label: string | null;
  similar: FirmListItem[];
  sameAddress: { items: FirmListItem[]; more: boolean };
}> {
  const empty = { items: [] as FirmListItem[], more: false };
  const industry = industryOfNace(firm.nace);
  if (!firm.inDb || firm.cityCode == null || firm.regionCode == null) return { stats: null, industry, label: null, similar: [], sameAddress: empty };
  const stats = (await regionObecStats(firm.regionCode).catch(() => new Map<number, ObecStats>())).get(firm.cityCode) ?? null;
  if (firm.dissolvedAt) return { stats, industry, label: null, similar: [], sameAddress: empty };
  const division = firm.nace[0]?.slice(0, 2);
  const prefixes = industry ? industry.nace : division ? [division] : [];
  const [similar, sameAddress] = await Promise.all([
    prefixes.length ? similarFirms(firm, prefixes).catch((): FirmListItem[] => []) : Promise.resolve([] as FirmListItem[]),
    sameAddressFirms(firm).catch(() => empty),
  ]);
  return { stats, industry, label: industry ? industry.headline : division ? naceDivisionLabel(division) : null, similar, sameAddress };
}

export async function generateMetadata({ params }: PageProps<"/firma/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const state = await loadFirm(slug);
  if (state.kind === "unavailable") return { title: `IČO ${state.ico} – údaje z ARES nejsou k dispozici`, robots: { index: false, follow: false } };
  const firm = state.firm;
  return {
    title: titleOf(firm),
    description: descriptionOf(firm),
    ...canonicalMeta(firmPagePath(firm)),
    // OSVČ, zaniklé, s námitkou, mimo indexovaný kraj a neověřené v ARES: noindex, follow (S3, LIA)
    robots: firm.index ? undefined : { index: false, follow: true },
  };
}

function Fact({ icon, label, children, action }: { icon: ReactNode; label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 shrink-0 text-brand-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-sm font-medium text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-[17px] font-medium text-ink">{children}</dd>
        {action && <dd className="mt-2">{action}</dd>}
      </div>
    </div>
  );
}

function ActionRow({ href, icon, title, text, external }: { href: string; icon: ReactNode; title: string; text: string; external?: boolean }) {
  const body = (
    <>
      <span className="mt-0.5 shrink-0 self-start rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink group-hover:text-brand-700">{title}</span>
        <span className="block text-sm text-ink-soft">{text}</span>
      </span>
    </>
  );
  const cls = "group flex gap-3 rounded-xl p-3 hover:bg-surface";
  return <li>{external ? <ExternalLink href={href} className={cls}>{body}</ExternalLink> : <Link href={href} className={cls}>{body}</Link>}</li>;
}

export default async function FirmPage({ params }: PageProps<"/firma/[slug]">) {
  const { slug } = await params;
  const state = await loadFirm(slug);
  if (state.kind === "unavailable") return <AresUnavailable ico={state.ico} />;
  const firm = state.firm;
  const kraj = krajByCode(firm.regionCode);
  const path = firmPagePath(firm);
  const natural = firm.isNaturalPerson;
  const { matched } = classifyNaceList(firm.nace);
  const seat = natural ? "" : seatOf(firm);
  const near = await neighbours(firm);
  const stats = near.stats;
  const industryCount = near.industry && stats ? stats.industries[near.industry.slug] : undefined;
  const summary = summaryOf(firm);
  const billing = billingText({ name: firm.name, ico: firm.ico, isNaturalPerson: natural, street: natural ? null : firm.street, postalCode: natural ? null : firm.postalCode, city: firm.city, dic: natural ? null : firm.dic });
  const invoice = hasFakturaPage() && !firm.dissolvedAt;
  // u OSVČ „podnikatel“, ne „firma“
  const who = natural ? { invoice: "Vystavit fakturu tomuto podnikateli", eet: "EET 2.0 a tento podnikatel", owner: "Podnikáte pod tímto IČO?" } : { invoice: "Vystavit fakturu této firmě", eet: "EET 2.0 a tato firma", owner: "Je to vaše firma?" };
  const faq = firmFaq(
    {
      ico: firm.ico,
      name: firm.name,
      isNaturalPerson: natural,
      dic: firm.dic,
      vatPayer: firm.vatPayer,
      foundedAt: firm.foundedAt,
      dissolvedAt: firm.dissolvedAt,
      // u OSVČ sídlo do FAQ nikdy (street je u nich null už ve view modelu)
      seat: natural ? null : seat || null,
      establishments: firm.establishments ? firm.establishments.length : null,
      eetRelevance: firm.eetRelevance,
      matched: matched.map((m) => m.label),
      sourceDate: firm.source.date,
      sourceKind: firm.source.kind,
    },
    { kontrolaIco: kontrolaIcoHref(firm.ico) },
  );
  const crumbs = [
    { name: "Katalog firem", path: "/firmy" },
    ...(kraj && isIndexRegion(kraj.code) ? [{ name: kraj.name, path: krajPath(kraj.slug) }] : []),
    ...(stats ? [{ name: stats.name, path: obecHubPath(stats) }] : []),
    ...(stats && near.industry && (industryCount?.listable ?? 0) > 0 ? [{ name: near.industry.headline, path: oborObecPath(near.industry.slug, stats) }] : []),
    { name: firm.name, path },
  ];
  const title = titleOf(firm).absolute;

  return (
    <>
      <JsonLd data={firmLd({ ...firm, isNaturalPerson: natural }, path)} />
      <JsonLd data={firmPageLd(firm, { path, title, description: summary, verifiedAt: firm.source.kind === "ares" ? firm.source.date : null })} />
      <JsonLd data={faqLd(faq.items)} />
      <PageHeader title={firm.name} crumbs={crumbs} lead={<p className="text-lg leading-relaxed">{summary}</p>}>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="chip bg-white px-3 py-1 text-sm text-ink ring-1 ring-line">
            <IconScale className="h-4 w-4 text-brand-600" />
            {legalFormShort(firm.legalForm)}
          </span>
          {firm.dissolvedAt && <span className="chip bg-danger-50 px-3 py-1 text-sm text-danger-600">Zaniklý subjekt</span>}
          {firm.vatPayer === true && (
            <span className="chip bg-brand-600 px-3 py-1 text-sm text-white">
              <IconPercent className="h-4 w-4" />
              Plátce DPH
            </span>
          )}
          {firm.vatPayer === false && <span className="chip bg-surface-2 px-3 py-1 text-sm text-ink-soft">Neplátce DPH</span>}
          {firm.claimed && <span className="chip bg-brand-100 px-3 py-1 text-sm text-brand-900">Profil ověřen vlastníkem</span>}
          <span className="chip bg-white px-3 py-1 text-sm text-muted ring-1 ring-line">
            <IconShield className="h-4 w-4 text-brand-600" />
            {firm.source.kind === "ares" ? "Údaje z ARES" : "Údaje z RES ČSÚ"} k {dateCs(firm.source.date)}
          </span>
        </div>
        {!firm.dissolvedAt && (
          // IČO jen ve fragmentu (#…), nikdy v query – z milionu stránek firem by jinak vzniklo milion nových URL (COMMON 9)
          <div className="mt-6 flex flex-wrap gap-3">
            {invoice && (
              <Link href={fakturaLink(firm.ico)} className="btn-primary">
                <IconInvoice />
                {who.invoice}
              </Link>
            )}
            <CopyButton text={billing} label="Kopírovat fakturační údaje" copiedLabel="Fakturační údaje zkopírovány" className={invoice ? "btn-secondary" : "btn-primary"} icon={<IconCopy />} />
            <Link href={kontrolaIcoHref(firm.ico)} className="btn-secondary">
              <IconReceipt />
              Ověřit EET podle IČO
            </Link>
          </div>
        )}
      </PageHeader>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section className="card p-0" aria-labelledby="zakladni-udaje">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
              <h2 id="zakladni-udaje" className="text-xl font-bold">
                Základní údaje
              </h2>
              <CopyButton text={billing} label="Kopírovat" icon={<IconCopy className="h-4 w-4" />} />
            </div>
            <dl className="grid gap-x-8 px-6 py-2 sm:grid-cols-2 [&>div]:border-b [&>div]:border-line">
              <Fact icon={<IconId />} label="IČO" action={<CopyButton text={firm.ico} label="Kopírovat IČO" icon={<IconCopy className="h-4 w-4" />} />}>
                <span className="font-mono tracking-wide">{firm.ico}</span>
              </Fact>
              {!natural && firm.dic && (
                <Fact icon={<IconPercent />} label="DIČ" action={<CopyButton text={firm.dic} label="Kopírovat DIČ" icon={<IconCopy className="h-4 w-4" />} />}>
                  <span className="font-mono tracking-wide">{firm.dic}</span>
                  {firm.vatPayer !== null && <span className="ml-2 text-sm font-normal text-ink-soft">{firm.vatPayer ? "plátce DPH" : "neplátce DPH"}</span>}
                </Fact>
              )}
              <Fact icon={<IconScale />} label="Právní forma">
                {legalFormName(firm.legalForm)}
              </Fact>
              {firm.foundedAt && (
                <Fact icon={<IconCalendar />} label={firm.dissolvedAt ? "Vznik a zánik" : "Datum vzniku"}>
                  <time dateTime={firm.foundedAt}>{dateCs(firm.foundedAt)}</time>
                  {firm.dissolvedAt && (
                    <>
                      {" – "}
                      <time dateTime={firm.dissolvedAt}>{dateCs(firm.dissolvedAt)}</time>
                    </>
                  )}
                </Fact>
              )}
              <Fact
                icon={<IconPin />}
                label={natural ? "Obec sídla" : "Sídlo"}
                action={
                  !natural && seat ? (
                    <ExternalLink href={mapyUrl(seat)} className="text-sm font-medium text-brand-700 underline underline-offset-4">
                      Zobrazit na mapě (Mapy.com)
                    </ExternalLink>
                  ) : undefined
                }
              >
                {natural ? firm.city ?? "neuvedeno" : seat || firm.city || "neuvedeno"}
              </Fact>
              {kraj && (
                <Fact icon={<IconBuilding />} label="Kraj">
                  {isIndexRegion(kraj.code) ? (
                    <Link href={krajPath(kraj.slug)} className="text-brand-700 underline underline-offset-4">
                      {kraj.name}
                    </Link>
                  ) : (
                    kraj.name
                  )}
                </Fact>
              )}
            </dl>
            {natural && <p className="px-6 pt-3 text-sm text-muted">U podnikajících fyzických osob uvádíme jen obec sídla – ne adresu, DIČ ani provozovny.</p>}
            <p className="px-6 pb-5 pt-3 text-sm text-muted">
              {firm.source.kind === "ares" ? "Údaje z ARES" : "Údaje z Registru ekonomických subjektů ČSÚ"} k{" "}
              <time dateTime={firm.source.date}>{dateCs(firm.source.date)}</time>. Zdroje:{" "}
              <ExternalLink href={aresUrl(firm.ico)} className="font-medium text-brand-700 underline underline-offset-4">
                ARES – detail subjektu
              </ExternalLink>
              {!natural && inPublicRegister(firm.legalForm) && (
                <>
                  {" · "}
                  <ExternalLink href={justiceUrl(firm.ico)} className="font-medium text-brand-700 underline underline-offset-4">
                    Veřejný rejstřík (justice.cz)
                  </ExternalLink>
                </>
              )}
            </p>
          </section>

          {!firm.dissolvedAt && <EetPanel relevance={firm.eetRelevance} nace={firm.nace} ico={firm.ico} basis={matched.map((m) => m.label)} title={who.eet} />}

          <section className="card" aria-labelledby="obory">
            <h2 id="obory" className="text-xl font-bold">
              Obory činnosti (CZ-NACE)
            </h2>
            {firm.nace.length > 0 ? (
              <ul className="mt-3 divide-y divide-line">
                {firm.nace.map((code) => {
                  const ind = CATALOG_INDUSTRIES.find((i) => i.nace.some((p) => code.startsWith(p)));
                  const count = ind && stats ? stats.industries[ind.slug] : undefined;
                  const link =
                    ind && stats && (count?.listable ?? 0) >= OBEC_MIN_FIRMS
                      ? { href: oborObecPath(ind.slug, stats), label: `${ind.headline} ${stats.name}` }
                      : ind && kraj && isIndexRegion(kraj.code)
                        ? { href: oborKrajPath(ind.slug, kraj.slug), label: `${ind.headline} ${kraj.locative}` }
                        : null;
                  return (
                    <li key={code} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span className="text-ink">{naceHuman(code)}</span>
                      {link && (
                        <Link href={link.href} className="shrink-0 text-[15px] font-medium text-brand-700 underline underline-offset-4">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-ink-soft">Obor činnosti není v registru uveden.</p>
            )}
          </section>

          {!natural && (
            <section className="card" aria-labelledby="provozovny">
              <h2 id="provozovny" className="flex items-center gap-2 text-xl font-bold">
                <IconStore className="h-5 w-5 text-brand-600" />
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
                      const addr = [est.street, est.city].filter(Boolean).join(", ");
                      return (
                        <li key={est.icp} className="py-3">
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
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}

          {near.similar.length > 0 && firm.city && (
            <section aria-labelledby="podobne-firmy">
              <h2 id="podobne-firmy" className="mb-1 text-xl font-bold">
                Podobné firmy v obci {firm.city}
              </h2>
              <p className="mb-4 text-[15px] text-ink-soft">{near.label ? `Obor ${near.label.toLowerCase()}` : "Stejný obor"}, jen právnické osoby.</p>
              <FirmList items={near.similar} />
              {near.industry && stats && (industryCount?.listable ?? 0) >= OBEC_MIN_FIRMS && (
                <p className="mt-3 text-[15px]">
                  <Link href={oborObecPath(near.industry.slug, stats)} className="font-medium text-brand-700 underline underline-offset-4">
                    {near.industry.headline} {stats.name}: celý seznam
                  </Link>
                </p>
              )}
            </section>
          )}

          {!natural && near.sameAddress.items.length > 0 && (
            <section aria-labelledby="stejna-adresa">
              <h2 id="stejna-adresa" className="mb-1 text-xl font-bold">
                Na stejné adrese
              </h2>
              <p className="mb-4 text-[15px] text-ink-soft">
                Právnické osoby se sídlem {seat}
                {near.sameAddress.more ? ` – prvních ${near.sameAddress.items.length} podle abecedy` : ""}. Podnikající fyzické osoby tu neuvádíme.
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

          {(stats || (kraj && isIndexRegion(kraj.code))) && (
            <nav aria-label="Další firmy" className="flex flex-wrap gap-2 text-[15px]">
              {stats && (
                <Link href={obecHubPath(stats)} className="inline-block rounded-full border border-line bg-white px-4 py-2 hover:border-brand-500 hover:bg-brand-50">
                  Firmy v obci {stats.name}
                </Link>
              )}
              {kraj && isIndexRegion(kraj.code) && (
                <Link href={krajPath(kraj.slug)} className="inline-block rounded-full border border-line bg-white px-4 py-2 hover:border-brand-500 hover:bg-brand-50">
                  Firmy {kraj.locative}
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {!firm.dissolvedAt && (
            <aside className="card p-3" aria-labelledby="rychle-akce">
              <h2 id="rychle-akce" className="px-3 pt-2 text-lg font-bold">
                Rychlé akce
              </h2>
              <ul className="mt-1">
                {invoice && <ActionRow href={fakturaLink(firm.ico)} icon={<IconInvoice />} title={who.invoice} text="Odběratel se doplní z ARES, faktura s QR platbou bez registrace." />}
                <ActionRow href={kontrolaIcoHref(firm.ico)} icon={<IconReceipt />} title="Ověřit EET podle IČO" text="Týká se evidence tržeb tohoto IČO? Odpověď za 10 vteřin." />
                {!natural && firm.dic && <ActionRow href="/nastroje/overeni-dic" icon={<IconPercent />} title="Ověřit DIČ" text="Kontrola tvaru DIČ a odkazy do registru plátců a VIES." />}
                <ActionRow href="/qr-platba" icon={<IconQr />} title="QR platba" text="QR kód pro platbu na účet. Číslo účtu firmy v registrech nemáme – doplníte ho z faktury." />
              </ul>
              <div className="px-3 pb-3 pt-2">
                <CopyButton text={billing} label="Kopírovat údaje" copiedLabel="Zkopírováno" className="btn-secondary w-full" icon={<IconCopy />} />
                <p className="mt-2 text-xs text-muted">Název, {natural ? "obec" : "adresa sídla"}, IČO{!natural && firm.dic ? " a DIČ" : ""}.</p>
              </div>
            </aside>
          )}
          <OwnerCta ico={firm.ico} claimed={firm.claimed} title={who.owner} />
        </div>
      </div>
    </>
  );
}
