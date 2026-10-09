import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

/** Adminský kabinet (R15.2) – rozhraní ukrajinsky (jen pro provozovatele), neindexuje se. Přístup hlídá každá stránka. */
export const metadata: Metadata = {
  title: { absolute: "Адмін – EvidujZdarma" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Огляд" },
  { href: "/admin/predregistrace", label: "Передреєстрації" },
  { href: "/admin/ucty", label: "Акаунти" },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="uk" className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-white">
        <nav aria-label="Адмін" className="container-page flex flex-wrap items-center gap-2 py-3">
          <span className="mr-4 font-bold text-ink">EvidujZdarma · адмін</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-[15px] text-ink-soft hover:bg-surface hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="container-page py-8">{children}</main>
    </div>
  );
}
