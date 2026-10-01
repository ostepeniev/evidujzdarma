import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasDatabase } from "@ez/db";
import { SetupApp } from "@/components/setup/setup-app";
import type { AccountStateDto } from "@/components/setup/api";
import { accountState } from "@/lib/server/account";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Nastavení pokladny" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!hasDatabase()) return <p className="p-10 text-center">Služba je dočasně nedostupná.</p>;
  const user = await getCurrentUser();
  if (!user) redirect("/prihlaseni?redirect=/pokladna/nastaveni");
  const state = JSON.parse(JSON.stringify(await accountState(user))) as AccountStateDto;
  return (
    <div className="min-h-dvh bg-surface">
      <SetupApp initial={state} />
    </div>
  );
}
