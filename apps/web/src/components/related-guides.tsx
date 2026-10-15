import Link from "next/link";
import { getGuide, isIndexable } from "@/content/guides";
import type { Guide } from "@/content/guides/types";

/** Návod, na který odkazuje každý návod clusteru (S1: pilíř ↔ cluster). */
export const PILLAR_SLUG = "eet-2-0-kompletni-pruvodce";

/** Návody podle slugů – jen ty, které jsou indexované (nerevidované koncepty neodkazujeme, Ф9). */
export function indexableGuides(slugs: readonly string[]): Guide[] {
  return slugs.map(getGuide).filter((g): g is Guide => !!g && isIndexable(g));
}

/**
 * Karty návodů pod nástrojem nebo návodem (S1). Nástroje dřív na návody neodkazovaly vůbec – kalkulačka EET OFF například
 * nevedla na návod o EET OFF, ač návod vede na ni.
 */
export function RelatedGuides({
  slugs,
  guides,
  title = "Související návody",
  id = "souvisejici-navody",
  className = "",
}: {
  slugs?: readonly string[];
  guides?: readonly Guide[];
  title?: string;
  id?: string;
  className?: string;
}) {
  const items = guides ?? indexableGuides(slugs ?? []);
  if (items.length === 0) return null;
  return (
    <section className={className} aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <li key={r.slug}>
            <Link href={`/navody/${r.slug}`} className="card block h-full hover:border-brand-200">
              <p className="font-semibold text-ink">{r.h1 ?? r.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{r.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
