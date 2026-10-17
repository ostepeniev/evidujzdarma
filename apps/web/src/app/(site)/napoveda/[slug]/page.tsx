import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideBlock } from "@/components/guide-blocks";
import { HelpClosedNote, HelpContact, HelpCta, HelpSteps, RelatedHelp } from "@/components/help-blocks";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides, indexableGuides } from "@/components/related-guides";
import { RichText } from "@/components/rich-text";
import { HELP_ARTICLES, getHelpArticle } from "@/content/napoveda";
import { HELP_TOPIC_LABEL, type HelpSection } from "@/content/napoveda/types";
import { helpJsonLd, helpMetadata, helpPath } from "@/lib/help-page";
import { JsonLd } from "@/lib/jsonld";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/napoveda/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = getHelpArticle(slug);
  return a ? helpMetadata(a) : {};
}

const dateCs = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });

function Section({ s }: { s: HelpSection }) {
  return (
    <section id={s.id} className="prose-ez mt-10 scroll-mt-24">
      <h2>{s.heading}</h2>
      {s.blocks.map((b, i) => (
        <GuideBlock key={i} block={b} />
      ))}
    </section>
  );
}

export default async function HelpArticlePage({ params }: PageProps<"/napoveda/[slug]">) {
  const { slug } = await params;
  const a = getHelpArticle(slug);
  if (!a) notFound();
  const ld = helpJsonLd(a);
  const sections = a.sections ?? [];
  const at = Math.min(a.stepsAt ?? 0, sections.length);
  // návody před odbornou revizí neodkazujeme (Ф9)
  const guides = indexableGuides(a.guides ?? []);

  return (
    <>
      <JsonLd data={ld} />
      <HelpClosedNote slug={a.slug} />
      <PageHeader
        title={a.title}
        crumbs={[
          { name: "Nápověda", path: "/napoveda" },
          { name: a.title, path: helpPath(a.slug) },
        ]}
      >
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{HELP_TOPIC_LABEL[a.topic]}</span>
          <span>
            Aktualizováno: <time dateTime={a.updated}>{dateCs(a.updated)}</time>
          </span>
        </p>
      </PageHeader>

      <div className="container-page py-10">
        <article className="min-w-0 max-w-3xl">
          <p className="text-xl leading-relaxed text-ink [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2">
            <RichText text={a.lead} />
          </p>
          {sections.slice(0, at).map((s) => (
            <Section key={s.id} s={s} />
          ))}
          {a.steps && a.steps.length > 0 && <HelpSteps steps={a.steps} heading={a.stepsHeading} />}
          {sections.slice(at).map((s) => (
            <Section key={s.id} s={s} />
          ))}
          <div className="mt-12">
            <HelpContact />
          </div>
        </article>
      </div>

      <div className="container-page space-y-12">
        <RelatedHelp slugs={a.related} />
        <RelatedGuides guides={guides} id="souvisejici-navody" />
        <HelpCta />
      </div>
    </>
  );
}
