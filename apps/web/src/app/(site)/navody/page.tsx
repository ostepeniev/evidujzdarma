import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { GUIDES } from "@/content/guides";
import { CATEGORY_LABEL, type GuideCategory } from "@/content/guides/types";

export const metadata: Metadata = {
  title: "Návody k EET 2.0 – vše o evidenci tržeb od roku 2027",
  description:
    "Srozumitelné návody k EET 2.0: koho se týká, co se eviduje, evidenční jednotky, DIS+ a certifikát, EET OFF, pokuty a práce bez internetu. Se zdroji a datem aktualizace.",
  alternates: { canonical: "/navody" },
};

const ORDER: GuideCategory[] = ["zaklady", "povinnosti", "prakticke", "obory", "novinky"];

export default function GuidesIndex() {
  return (
    <>
      <PageHeader
        title="Návody k EET 2.0"
        crumbs={[{ name: "Návody", path: "/navody" }]}
        lead="Vše, co potřebujete vědět o evidenci tržeb od roku 2027 – stručně, s odkazy na zákon a Finanční správu a s datem poslední aktualizace."
      />
      <div className="container-page py-10">
        {ORDER.map((cat) => {
          const items = GUIDES.filter((g) => g.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat} className="mb-12" aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="mb-4 text-2xl font-bold">
                {CATEGORY_LABEL[cat]}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/navody/${g.slug}`} className="card block h-full transition-colors hover:border-brand-200">
                      <p className="text-lg font-semibold text-ink">{g.h1 ?? g.title}</p>
                      <p className="mt-2 text-[15px] text-ink-soft">{g.description}</p>
                      <p className="mt-3 text-sm text-muted">Aktualizováno {new Date(g.updated).toLocaleDateString("cs-CZ")}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <ToolCta />
      </div>
    </>
  );
}
