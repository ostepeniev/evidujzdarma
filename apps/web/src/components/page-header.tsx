import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";

export interface Crumb {
  name: string;
  path: string;
}

export function PageHeader({ title, lead, crumbs, children }: { title: string; lead?: ReactNode; crumbs: Crumb[]; children?: ReactNode }) {
  const all = [{ name: "Úvod", path: "/" }, ...crumbs];
  return (
    <header className="border-b border-line bg-gradient-to-b from-brand-50 to-white">
      <JsonLd data={breadcrumbLd(all)} />
      <div className="container-page py-10 sm:py-14">
        <nav aria-label="Drobečková navigace" className="mb-4 text-sm text-muted">
          <ol className="flex flex-wrap gap-1">
            {all.map((c, i) => (
              <li key={c.path} className="flex gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                {i < all.length - 1 ? (
                  <Link href={c.path} className="hover:text-brand-700 hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink-soft">
                    {c.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">{title}</h1>
        {lead && <div className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-soft sm:text-xl">{lead}</div>}
        {children}
      </div>
    </header>
  );
}
