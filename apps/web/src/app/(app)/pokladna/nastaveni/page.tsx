import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasDatabase } from "@ez/db";
import { SetupApp } from "@/components/setup/setup-app";
import type { AccountStateDto } from "@/components/setup/api";
import { accountState } from "@/lib/server/account";
import { getCurrentUser } from "@/lib/server/auth";
import { icoParam } from "@/lib/ico-param";

export const metadata: Metadata = { title: "Nastavení pokladny" };
export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: PageProps<"/pokladna/nastaveni">) {
  if (!hasDatabase()) return <p className="p-10 text-center">Služba je dočasně nedostupná.</p>;
  const user = await getCurrentUser();
  if (!user) redirect("/prihlaseni?redirect=/pokladna/nastaveni");
  const { ico } = await searchParams;
  // IČO z kontroly IČO (/kontrola-ico → přihlášení → sem, R18.1) – krok „Firma“ ho použije jen u nového účtu
  const state = { ...(JSON.parse(JSON.stringify(await accountState(user))) as AccountStateDto), checkIco: icoParam(ico) };
  return (
    <div className="min-h-dvh bg-surface">
      <SetupApp initial={state} />
    </div>
  );
}
