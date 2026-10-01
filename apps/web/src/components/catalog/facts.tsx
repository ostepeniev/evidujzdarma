import type { ReactNode } from "react";

/** Tabulka faktů jako definiční seznam (bez vět — šablona nevytváří gramatické chyby). */
export function Facts({ rows }: { rows: [label: string, value: ReactNode | null | undefined | false][] }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== false && v !== "");
  return (
    <dl className="divide-y divide-line">
      {visible.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm font-medium text-muted">{label}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
