import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { GUIDES, isIndexable } from "@/content/guides";
import { indexableLandings, landingPath } from "@/content/obor-landings";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S12 (22. 11. 2026): rozcestník stránek „EET pro …“. Ukazuje jen stránky po odborné revizi (koncepty mají noindex
 * a odkaz na ně vede jen přímo, stejně jako u návodů – рецензія №7) a návody z kategorie „EET podle oborů“.
 */
export const metadata: Metadata = {
  title: "EET podle oboru: co evidovat a jak začít",
  description:
    "Kadeřnice, bistro, restaurace a další obory: rychlá kontrola, co od 1. 1. 2027 evidovat, jaké jsou výjimky a jak začít s pokladnou zdarma. Se zdroji a datem.",
  ...canonicalMeta("/eet-pro"),
};

export default function EetProHub() {
  const landings = indexableLandings();
  const guides = GUIDES.filter((g) => g.category === "obory" && isIndexable(g));
  return (
    <>
      <PageHeader
        title="EET podle oboru"
        crumbs={[{ name: "EET podle oboru", path: "/eet-pro" }]}
        lead="Pravidlo je pro všechny stejné: od 1. 1. 2027 se evidují platby přijaté osobně – hotově, kartou nebo QR kódem. Co to znamená ve vašem oboru, ukáže rychlá kontrola nebo návod."
      />
      <div className="container-page py-10">
        <section aria-labelledby="kontroly-h" className="mb-12">
          <h2 id="kontroly-h" className="mb-4 text-2xl font-bold">
            Rychlá kontrola podle oboru
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {landings.map((l) => (
              <li key={l.slug}>
                <Link href={landingPath(l)} className="card block h-full transition-colors hover:border-brand-200">
                  <p className="text-lg font-semibold text-ink">{l.h1}</p>
                  <p className="mt-2 text-[15px] text-ink-soft">{l.chips.join(" · ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {guides.length > 0 && (
          <section aria-labelledby="navody-h" className="mb-12">
            <h2 id="navody-h" className="mb-4 text-2xl font-bold">
              Návody pro obory
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link href={`/navody/${g.slug}`} className="card block h-full transition-colors hover:border-brand-200">
                    <p className="text-lg font-semibold text-ink">{g.h1 ?? g.title}</p>
                    <p className="mt-2 text-[15px] text-ink-soft">{g.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mb-10 text-[15px] text-ink-soft">
          Váš obor tu není? Pravidla jsou stejná – projděte si{" "}
          <Link href="/musim-evidovat" className="underline underline-offset-2">
            kvíz Musím evidovat?
          </Link>{" "}
          nebo návod{" "}
          <Link href="/navody/koho-se-eet-tyka" className="underline underline-offset-2">
            Koho se EET týká
          </Link>
          .
        </p>
        <ToolCta />
      </div>
    </>
  );
}
