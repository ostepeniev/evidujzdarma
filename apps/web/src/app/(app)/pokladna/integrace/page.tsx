import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasDatabase } from "@ez/db";
import { IntegrationsApp } from "@/components/integrations/integrations-app";
import { getCurrentUser } from "@/lib/server/auth";
import { integrationsState } from "@/lib/server/integrations";

export const metadata: Metadata = { title: "Integrace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Integrace EET API (S8, rozd. 7) – samostatná stránka vedle nastavení pokladny; obrazovky pokladny (PWA) se do
 * recenze S8 nemění. Jen vlastník podnikatelského účtu.
 */
export default async function IntegrationsPage() {
  if (!hasDatabase()) return <p className="p-10 text-center">Služba je dočasně nedostupná.</p>;
  const user = await getCurrentUser();
  if (!user) redirect("/prihlaseni?redirect=/pokladna/integrace");
  const owner = user.memberships.find((m) => m.role === "owner" && m.accountKind === "business");
  if (!owner) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-bold">Integrace</h1>
        <p className="mt-3 text-ink-soft">Integrace může spravovat jen vlastník účtu.</p>
        <Link href="/pokladna/nastaveni" className="btn-secondary mt-6 inline-flex">
          Zpět do nastavení
        </Link>
      </main>
    );
  }
  const state = await integrationsState(owner.accountId);
  return (
    <div className="min-h-dvh bg-surface">
      <IntegrationsApp initial={state} />
    </div>
  );
}
