import type { Metadata } from "next";
import Link from "next/link";
import { HelpClosedNote, HelpContact, HelpCta } from "@/components/help-blocks";
import { PageHeader } from "@/components/page-header";
import { helpArticlesIn, helpModified } from "@/content/napoveda";
import { HELP_TOPIC_LABEL, HELP_TOPIC_ORDER } from "@/content/napoveda/types";
import { helpRobots } from "@/lib/help-page";
import { canonicalMeta } from "@/lib/metadata";

/**
 * Nápověda k pokladně (S2-A) – rozcestník podle témat. Dokud je pokladna zavřená (do 2. 11. 2026): noindex,follow, mimo
 * sitemap a llms.txt, nahoře poznámka; po otevření indexovatelná sama (content/napoveda helpIndexable).
 */
export const metadata: Metadata = {
  title: "Nápověda k pokladně EvidujZdarma",
  description:
    "Nápověda k pokladně EvidujZdarma: první spuštění, certifikát, prodej a platby, účtenky, prodej bez signálu, vratky, uzávěrka, export pro účetní a podpora.",
  ...canonicalMeta("/napoveda"),
  robots: helpRobots(),
};

const dateCs = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });

export default function HelpIndex() {
  const modified = helpModified();
  return (
    <>
      <HelpClosedNote />
      <PageHeader
        title="Nápověda k pokladně"
        crumbs={[{ name: "Nápověda", path: "/napoveda" }]}
        lead="Krátké návody, jak v pokladně EvidujZdarma udělat to, co právě potřebujete – od prvního přihlášení po denní uzávěrku. Názvy tlačítek odpovídají aplikaci."
      >
        <p className="mt-4 text-sm text-muted">
          Aktualizováno: <time dateTime={modified}>{dateCs(modified)}</time>
        </p>
      </PageHeader>
      <div className="container-page py-10">
        <nav aria-label="Témata nápovědy" className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {HELP_TOPIC_ORDER.map((t) => (
              <li key={t}>
                <a href={`#${t}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:border-brand-200 hover:text-brand-700">
                  {HELP_TOPIC_LABEL[t]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {HELP_TOPIC_ORDER.map((topic) => {
          const items = helpArticlesIn(topic);
          if (!items.length) return null;
          return (
            <section key={topic} id={topic} className="mb-12 scroll-mt-24" aria-labelledby={`${topic}-h`}>
              <h2 id={`${topic}-h`} className="mb-4 text-2xl font-bold">
                {HELP_TOPIC_LABEL[topic]}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/napoveda/${a.slug}`} className="card block h-full transition-colors hover:border-brand-200">
                      <p className="text-lg font-semibold text-ink">{a.title}</p>
                      <p className="mt-2 text-[15px] text-ink-soft">{a.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <div className="space-y-6">
          <p className="text-base text-ink-soft">
            Pokladnu si můžete vyzkoušet i bez registrace v{" "}
            <Link href="/ukazka" className="font-medium text-brand-700 underline underline-offset-2">
              ukázce pokladny
            </Link>
            . Povinnosti podle zákona vysvětlují{" "}
            <Link href="/navody" className="font-medium text-brand-700 underline underline-offset-2">
              návody k EET 2.0
            </Link>
            .
          </p>
          <HelpContact />
        </div>
        <HelpCta />
      </div>
    </>
  );
}
