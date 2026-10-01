import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, hasDatabase, schema } from "@ez/db";
import { CabinetApp, type CabinetState } from "@/components/cabinet/cabinet-app";
import { getCurrentUser } from "@/lib/server/auth";
import { accountantMembership, cabinetClients } from "@/lib/server/cabinet";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Účetní kabinet" };
export const dynamic = "force-dynamic";

export default async function CabinetPage() {
  if (!hasDatabase()) return <p className="p-10 text-center">Služba je dočasně nedostupná.</p>;
  const user = await getCurrentUser();
  if (!user) redirect("/prihlaseni?redirect=/kabinet");
  const m = accountantMembership(user);
  const account = m ? await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, m.accountId) }) : null;
  const state: CabinetState = {
    user: { email: user.email },
    account: account ? { id: account.id, name: account.name, ico: account.ico } : null,
    clients: m ? await cabinetClients(m.accountId, SITE_URL) : [],
  };
  return (
    <div className="min-h-dvh bg-surface">
      <CabinetApp initial={state} />
    </div>
  );
}
