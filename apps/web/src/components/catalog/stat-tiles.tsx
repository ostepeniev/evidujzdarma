import type { ReactNode } from "react";
import { formatCount } from "./paths";

/** Dlaždice se statistikou (S3): čísla jen z DB katalogu, s krátkým popiskem. */
export function StatTiles({ items }: { items: { label: string; value: number; hint?: string; icon?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <dt className="flex items-center gap-2 text-sm font-medium text-muted">
            {it.icon && <span className="text-brand-600">{it.icon}</span>}
            {it.label}
          </dt>
          <dd className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{formatCount(it.value)}</dd>
          {it.hint && <dd className="mt-0.5 text-xs text-muted">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
