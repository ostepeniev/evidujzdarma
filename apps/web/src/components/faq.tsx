import type { ReactNode } from "react";

export interface FaqItem {
  q: string;
  /** prostý text — použije se i ve strukturovaných datech FAQPage */
  a: string;
  /** volitelně bohatší obsah pro zobrazení */
  rich?: ReactNode;
}

export function Faq({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((it) => (
        <details key={it.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-semibold text-ink">
            <h3 className="text-lg font-semibold">{it.q}</h3>
            <span aria-hidden="true" className="mt-1 shrink-0 text-brand-600 transition-transform group-open:rotate-45">
              ＋
            </span>
          </summary>
          <div className="prose-ez mt-3 text-base">{it.rich ?? <p>{it.a}</p>}</div>
        </details>
      ))}
    </div>
  );
}
