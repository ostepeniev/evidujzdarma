import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Faq } from "@/components/faq";
import { GuideBlock } from "@/components/guide-blocks";
import { PageHeader } from "@/components/page-header";
import { RichText, plainText } from "@/components/rich-text";
import { ToolCta } from "@/components/tool-cta";
import { GUIDES, getGuide, isIndexable } from "@/content/guides";
import { CATEGORY_LABEL } from "@/content/guides/types";
import { JsonLd, articleLd, faqLd, howToLd } from "@/lib/jsonld";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/navody/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/navody/${g.slug}` },
    robots: isIndexable(g) ? undefined : { index: false, follow: true },
    openGraph: { type: "article", title: g.h1 ?? g.title, description: g.description, modifiedTime: g.updated, publishedTime: g.published },
  };
}

const dateCs = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });

export default async function GuidePage({ params }: PageProps<"/navody/[slug]">) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const path = `/navody/${g.slug}`;
  const related = g.related.map(getGuide).filter((x): x is NonNullable<typeof x> => !!x);
  const ld = [
    articleLd({
      title: g.h1 ?? g.title,
      description: g.description,
      path,
      published: g.published,
      modified: g.updated,
      author: g.author,
      reviewer: g.reviewedBy ?? undefined,
    }),
    ...(g.faq?.length ? [faqLd(g.faq.map((f) => ({ q: f.q, a: plainText(f.a) })))] : []),
    ...(g.howTo ? [howToLd(g.howTo)] : []),
  ];

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
            Aktualizováno: <time dateTime={g.updated}>{dateCs(g.updated)}</time>
          </span>
          {g.reviewedBy ? <span>Odborná revize: {g.reviewedBy}</span> : <span>Před odbornou revizí</span>}
        </p>
      </PageHeader>

      <div className="container-page grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0 max-w-3xl">
          <p className="text-xl leading-relaxed text-ink">
            <RichText text={g.lead} />
          </p>

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
                  <a href={s.url} rel="noopener" target="_blank">
                    {s.label}
                  </a>
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
              <p className="mt-1 text-sm text-brand-100">Funguje i bez signálu, až 5 uživatelů.</p>
              <Link href="/#registrace" className="btn mt-4 w-full bg-white py-2 text-brand-700 hover:bg-brand-50">
                Chci zdarma
              </Link>
            </div>
          </nav>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-page" aria-labelledby="souvisejici">
          <h2 id="souvisejici" className="text-2xl font-bold">
            Související návody
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/navody/${r.slug}`} className="card block h-full hover:border-brand-200">
                  <p className="font-semibold text-ink">{r.h1 ?? r.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{r.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="container-page">
        <ToolCta />
      </div>
    </>
  );
}
