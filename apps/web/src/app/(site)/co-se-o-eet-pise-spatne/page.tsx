import type { Metadata } from "next";
import Link from "next/link";
import { LawHistory } from "@/components/law-history";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { MYTHS, MYTHS_UPDATED } from "@/content/myths";
import { JsonLd, articleLd, faqLd } from "@/lib/jsonld";
import { ExternalLink } from "@/components/external-link";

const PATH = "/co-se-o-eet-pise-spatne";
const TITLE = "Co se o EET 2.0 píše špatně";
const DESCRIPTION =
  "Výjimka do 50 000 Kč, evidence až od února, sleva 5 000 Kč pro každého, offline 5 dní: tvrzení o EET 2.0, která neodpovídají schválenému zákonu. Ke každému zdroj, stav k datu a co dělat.";

export const metadata: Metadata = {
  title: `${TITLE} – omyly a fakta`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION, modifiedTime: MYTHS_UPDATED },
};

const dateCs = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

export default function MythsPage() {
  const ld = [
    articleLd({ title: TITLE, description: DESCRIPTION, path: PATH, published: "2026-10-01", modified: MYTHS_UPDATED }),
    faqLd(MYTHS.map((m) => ({ q: m.question, a: m.truth }))),
  ];
  return (
    <>
      <JsonLd data={ld} />
      <PageHeader
        title={TITLE}
        crumbs={[
          { name: "Návody", path: "/navody" },
          { name: TITLE, path: PATH },
        ]}
        lead={
          <>
            Kolem EET 2.0 koluje řada tvrzení z doby, kdy zákon ještě nebyl schválený, nebo z první EET. Porovnali jsme je se schváleným zněním zákona
            (sněmovní tisk 189) a s informacemi Finanční správy. U každého rozporu najdete zdroj, datum stavu a co máte udělat.
          </>
        }
      >
        <p className="mt-4 text-sm text-muted">
          Aktualizováno: <time dateTime={MYTHS_UPDATED}>{dateCs(MYTHS_UPDATED)}</time> · Nejde o daňové poradenství.
        </p>
      </PageHeader>

      <div className="container-page grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 max-w-3xl space-y-8">
          <aside className="rounded-2xl border border-line bg-surface p-5 text-[15px] text-ink-soft">
            <p className="font-semibold text-ink">Jak číst tuto stránku</p>
            <ul className="mt-2 space-y-1">
              <li>
                <strong className="text-ink">Píše se</strong> – tvrzení vlastními slovy, bez citace konkrétních autorů.
              </li>
              <li>
                <strong className="text-ink">Co platí</strong> – shrnutí zákona a oficiálních zdrojů, se stavem k datu.
              </li>
              <li>
                <strong className="text-ink">Náš názor</strong> – naše doporučení. Je to názor, ne výklad zákona.
              </li>
            </ul>
          </aside>

          {MYTHS.map((m, i) => (
            <article key={m.id} id={m.id} className="scroll-mt-24 rounded-2xl border border-line bg-white p-6 sm:p-8">
              <p className="text-sm font-semibold text-muted">
                {i + 1}. · Stav k <time dateTime={m.asOf}>{dateCs(m.asOf)}</time>
              </p>
              <h2 className="mt-1 text-2xl font-bold leading-snug text-ink">{m.question}</h2>

              <div className="mt-5 rounded-xl border-l-4 border-danger-600 bg-danger-50 px-4 py-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-danger-600">Píše se</p>
                <p className="mt-1 text-lg text-ink">{m.claim}</p>
                <p className="mt-1 text-sm text-muted">Kde: {m.seenIn}</p>
              </div>

              <div className="mt-4 rounded-xl border-l-4 border-brand-500 bg-brand-50 px-4 py-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Co platí</p>
                <p className="mt-1 text-lg leading-relaxed text-ink">{m.truth}</p>
              </div>

              {m.comment && (
                <div className="mt-4 px-1">
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted">Náš názor</p>
                  <p className="mt-1 text-base leading-relaxed text-ink-soft">{m.comment}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-base text-ink">{m.action.text}</span>
                <Link href={m.action.href} className="btn-secondary py-2 text-[15px]">
                  {m.action.label} →
                </Link>
              </div>

              <p className="mt-4 text-sm text-muted">
                Zdroje:{" "}
                {m.sources.map((s, j) => (
                  <span key={s.url}>
                    {j > 0 && " · "}
                    <ExternalLink href={s.url} className="underline decoration-line underline-offset-2 hover:text-brand-700">
                      {s.label}
                    </ExternalLink>
                  </span>
                ))}
              </p>
            </article>
          ))}

          <section id="historie-zakona" className="scroll-mt-24 rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-ink">Jak zákon vznikal</h2>
            <p className="mt-2 text-ink-soft">Od konceptu ministerstva po podpis prezidenta. Mnohé omyly pocházejí z dřívějších fází projednávání.</p>
            <div className="mt-6">
              <LawHistory />
            </div>
          </section>

          <p className="text-base text-muted">
            Našli jste jiné tvrzení, které nesedí? Napište nám přes stránku{" "}
            <Link href="/o-nas" className="underline underline-offset-2">
              O nás
            </Link>
            . Při změně zákona nebo pokynů Finanční správy stránku aktualizujeme a změnu označíme datem.
          </p>
        </div>

        <aside className="hidden lg:block">
          <nav aria-label="Přehled omylů" className="sticky top-6 rounded-2xl border border-line p-5">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Přehled</p>
            <ol className="space-y-2 text-[15px]">
              {MYTHS.map((m) => (
                <li key={m.id}>
                  <a href={`#${m.id}`} className="text-ink-soft hover:text-brand-700">
                    {m.question}
                  </a>
                </li>
              ))}
              <li>
                <a href="#historie-zakona" className="text-ink-soft hover:text-brand-700">
                  Jak zákon vznikal
                </a>
              </li>
            </ol>
          </nav>
        </aside>
      </div>

      <div className="container-page">
        <ToolCta />
      </div>
    </>
  );
}
