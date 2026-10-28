import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Faq } from "@/components/faq";
import { GuideBlock } from "@/components/guide-blocks";
import { PageHeader } from "@/components/page-header";
import { RichText, plainText } from "@/components/rich-text";
import { ToolCta } from "@/components/tool-cta";
import { GUIDES, getGuide, guideModified, isIndexable } from "@/content/guides";
import { CATEGORY_LABEL } from "@/content/guides/types";
import { guideJsonLd, guideMetadata } from "@/lib/guide-page";
import { JsonLd } from "@/lib/jsonld";
import { REVIEWER, SERVICE_COPY } from "@/lib/site";
import { ExternalLink } from "@/components/external-link";
import { PILLAR_SLUG, RelatedGuides, indexableGuides } from "@/components/related-guides";
import { GuideCatalogLinks } from "@/components/catalog/guide-catalog-links";
import { landingPath, landingsForGuide } from "@/content/obor-landings";
import { SERVICE_CTA_GUIDES, SETUP_SERVICE } from "@/content/services";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/navody/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  return g ? guideMetadata(g) : {};
}

const dateCs = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });

export default async function GuidePage({ params }: PageProps<"/navody/[slug]">) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const path = `/navody/${g.slug}`;
  // indexovaný návod odkazuje jen na indexované (nerevidované koncepty ne, Ф9); koncept smí odkazovat na cokoli
  const related = isIndexable(g) ? indexableGuides(g.related) : g.related.map(getGuide).filter((x): x is NonNullable<typeof x> => !!x);
  // S1: každý návod clusteru odkazuje na pilíř a na další návody téže kategorie
  const pillar = g.slug === PILLAR_SLUG ? undefined : getGuide(PILLAR_SLUG);
  const shown = new Set([g.slug, PILLAR_SLUG, ...related.map((r) => r.slug)]);
  const sameCategory = GUIDES.filter((x) => x.category === g.category && !shown.has(x.slug) && isIndexable(x)).slice(0, 3);
  const ld = guideJsonLd(g);
  const landings = landingsForGuide(g.slug);
  const modified = guideModified(g);

  return (
    <>
      <JsonLd data={ld} />
      <PageHeader
        title={g.h1 ?? g.title}
        crumbs={[
          { name: "Návody", path: "/navody" },
          { name: g.h1 ?? g.title, path },
        ]}
      >
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{CATEGORY_LABEL[g.category]}</span>
          <span>
            Aktualizováno: <time dateTime={modified}>{dateCs(modified)}</time>
          </span>
          {g.reviewedBy === REVIEWER.name ? (
            <span>
              Odborná revize:{" "}
              <Link href={REVIEWER.path} className="underline underline-offset-2">
                {REVIEWER.name}
              </Link>
              , {REVIEWER.title}
            </span>
          ) : g.reviewedBy ? (
            <span>Odborná revize: {g.reviewedBy}</span>
          ) : g.basis === "official" ? (
            <span>Podle oficiálních příkladů Ministerstva financí a Finanční správy · odbornou revizi připravujeme</span>
          ) : (
            <span>Před odbornou revizí</span>
          )}
        </p>
      </PageHeader>

      <div className="container-page grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0 max-w-3xl">
          <p className="text-xl leading-relaxed text-ink">
            <RichText text={g.lead} />
          </p>
          {pillar && isIndexable(pillar) && (
            <p className="mt-4 text-base text-ink-soft">
              Celý přehled povinností, termínů a výjimek najdete v návodu{" "}
              <Link href={`/navody/${pillar.slug}`} className="font-medium text-brand-700 underline underline-offset-2">
                {pillar.h1 ?? pillar.title}
              </Link>
              .
            </p>
          )}

          {/* S4: rychlá kontrola a pokladna pro obor – stránky „EET pro …“ */}
          {landings.length > 0 && (
            <aside className="not-prose mt-8 rounded-2xl border-2 border-brand-200 bg-brand-50 p-5" aria-label="Rychlá kontrola pro váš obor">
              <p className="m-0 text-base font-semibold text-ink">Rychlá kontrola za 30 vteřin: co z toho platí přímo pro vás – a pokladna zdarma.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {landings.map((l) => (
                  <Link key={l.slug} href={landingPath(l)} className="btn-primary no-underline">
                    {l.short} →
                  </Link>
                ))}
              </div>
            </aside>
          )}

          <aside className="not-prose my-8 rounded-2xl border border-line bg-surface p-6" aria-label="Stručně">
            <h2 className="text-lg font-bold text-ink">Stručně</h2>
            <ul className="mt-3 space-y-2 text-base text-ink">
              {g.summary.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="text-brand-600">
                    ✓
                  </span>
                  <span>
                    <RichText text={s} />
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          {g.sections.map((s) => (
            <section key={s.id} id={s.id} className="prose-ez scroll-mt-24">
              <h2>{s.heading}</h2>
              {s.blocks.map((b, i) => (
                <GuideBlock key={i} block={b} />
              ))}
            </section>
          ))}

          {/* S5-SLUŽBY: praktické návody → nastavení na klíč */}
          {SERVICE_CTA_GUIDES.includes(g.slug) && (
            <aside className="not-prose mt-12 rounded-2xl border-2 border-brand-200 bg-brand-50 p-6" aria-label="Nastavení na klíč" data-service-cta="guide">
              <p className="text-lg font-semibold text-ink">Nechcete to řešit sami? Nastavíme vám EET na klíč.</p>
              <p className="mt-2 text-[15px] text-ink-soft">
                Postup pro DIS+ a pokladní certifikát na míru, kontrola a nastavení pokladny – písemně, bez telefonování. {SETUP_SERVICE.priceLabel}, platíte až po
                dokončení.
              </p>
              <Link href="/nastaveni-na-klic" className="btn-primary mt-4 inline-flex no-underline">
                Nastavení na klíč →
              </Link>
            </aside>
          )}

          {g.faq && g.faq.length > 0 && (
            <section id="caste-otazky" className="not-prose mt-12 scroll-mt-24">
              <h2 className="mb-6 text-2xl font-bold text-ink sm:text-3xl">Časté otázky</h2>
              <Faq items={g.faq.map((f) => ({ q: f.q, a: plainText(f.a), rich: <p><RichText text={f.a} /></p> }))} />
            </section>
          )}

          <section id="zdroje" className="prose-ez mt-12 scroll-mt-24">
            <h2>Zdroje</h2>
            <ul>
              {g.sources.map((s) => (
                <li key={s.url}>
                  <ExternalLink href={s.url}>
                    {s.label}
                  </ExternalLink>
                </li>
              ))}
            </ul>
            <p className="text-base text-muted">
              Článek je obecná informace, nejde o daňové poradenství. Při změně zákona nebo pokynů Finanční správy text aktualizujeme.
            </p>
          </section>

          {g.changelog && g.changelog.length > 0 && (
            <section id="zmeny" className="prose-ez mt-10">
              <h2>Historie změn</h2>
              <ul>
                {g.changelog.map((c) => (
                  <li key={c.date + c.text}>
                    <time dateTime={c.date}>{dateCs(c.date)}</time>: {c.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="hidden lg:block">
          <nav aria-label="Obsah článku" className="sticky top-6 space-y-6">
            <div className="rounded-2xl border border-line p-5">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Obsah</p>
              <ol className="space-y-2 text-[15px]">
                {g.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-ink-soft hover:text-brand-700">
                      {s.heading}
                    </a>
                  </li>
                ))}
                {g.faq && g.faq.length > 0 && (
                  <li>
                    <a href="#caste-otazky" className="text-ink-soft hover:text-brand-700">
                      Časté otázky
                    </a>
                  </li>
                )}
              </ol>
            </div>
            <div className="rounded-2xl bg-brand-700 p-5 text-white">
              <p className="font-semibold">Pokladna pro EET 2.0 zdarma</p>
              <p className="mt-1 text-sm text-brand-100">{SERVICE_COPY.guideSidebar}</p>
              <Link href="/#registrace" className="btn mt-4 w-full bg-white py-2 text-brand-700 hover:bg-brand-50">
                Chci zdarma
              </Link>
            </div>
          </nav>
        </aside>
      </div>

      <div className="container-page space-y-12">
        {/* S3: oborové návody → katalog firem (obor × obec, obor × kraj) */}
        <GuideCatalogLinks slug={g.slug} />
        <RelatedGuides guides={related} id="souvisejici" />
        <RelatedGuides guides={sameCategory} title={`Další návody: ${CATEGORY_LABEL[g.category]}`} id="dalsi-navody" />
      </div>
      <div className="container-page">
        <ToolCta />
      </div>
    </>
  );
}
