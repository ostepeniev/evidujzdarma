import Link from "next/link";
import { krajByCode, legalFormShort } from "@ez/cz";
import { RelevanceChip } from "./relevance";
import { dateCs, firmPath } from "./paths";

export interface FirmListEntry {
  ico: string;
  name: string;
  slug: string;
  legalForm: string | null;
  isNaturalPerson: boolean;
  city: string | null;
  regionCode: number | null;
  eetRelevance: "likely" | "possible" | "unlikely";
  foundedAt: string | null;
  dissolvedAt?: string | null;
}

/** Seznam firem — jen údaje z registrů (název, IČO, forma, obec, datum vzniku). */
export function FirmList({ items, showRegion = false, showFounded = false }: { items: FirmListEntry[]; showRegion?: boolean; showFounded?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((it) => {
        const kraj = showRegion ? krajByCode(it.regionCode) : undefined;
        return (
          <li key={it.ico} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <Link href={firmPath(it)} className="font-semibold text-ink hover:text-brand-700 hover:underline">
                {it.name}
              </Link>
              <p className="text-sm text-ink-soft">
                IČO {it.ico} · {legalFormShort(it.legalForm)}
                {it.city && <> · {it.city}</>}
                {kraj && <> · {kraj.name}</>}
                {showFounded && it.foundedAt && <> · vznik {dateCs(it.foundedAt)}</>}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {it.dissolvedAt ? <span className="chip bg-surface text-muted">zaniklý subjekt</span> : <RelevanceChip relevance={it.eetRelevance} short />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Pagination({ page, total, perPage, href }: { page: number; total: number; perPage: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const around = [page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= pages);
  const items = Array.from(new Set([1, ...around, pages])).sort((a, b) => a - b);
  return (
    <nav aria-label="Stránkování" className="mt-6 flex flex-wrap items-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="btn-secondary px-4 py-2 text-sm">
          ← Předchozí
        </Link>
      )}
      {items.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && items[i - 1]! < p - 1 && <span aria-hidden="true">…</span>}
          {p === page ? (
            <span aria-current="page" className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">
              {p}
            </span>
          ) : (
            <Link href={href(p)} className="rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface">
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className="btn-secondary px-4 py-2 text-sm">
          Další →
        </Link>
      )}
    </nav>
  );
}
