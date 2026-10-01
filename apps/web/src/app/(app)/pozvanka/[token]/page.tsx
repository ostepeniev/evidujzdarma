import type { Metadata } from "next";
import Link from "next/link";
import { hasDatabase } from "@ez/db";
import { AcceptInvite } from "@/components/cabinet/accept-invite";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/server/auth";
import { inviteInfo } from "@/lib/server/cabinet";

export const metadata: Metadata = { title: "Pozvánka od účetní" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: PageProps<"/pozvanka/[token]">) {
  const { token } = await params;
  const info = hasDatabase() ? await inviteInfo(token) : null;
  const user = info ? await getCurrentUser() : null;
  const hasBusiness = !!user?.memberships.some((m) => m.role === "owner" && m.accountKind === "business");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-10">
      <Logo />
      <div className="card mt-8 w-full max-w-md p-6 sm:p-8">
        {!info ? (
          <>
            <h1 className="text-2xl font-bold">Pozvánka neplatí</h1>
            <p className="mt-2 text-ink-soft">Odkaz už byl použit nebo je neúplný. Požádejte účetní o nový.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{info.accountantName} vás zve do pokladny EvidujZdarma</h1>
            <p className="mt-3 text-ink-soft">
              Pokladna pro EET 2.0 je zdarma. Propojením účetní uvidí, jak jste připraveni na EET (DIS+, jednotky, certifikát, první tržba), a může si stáhnout
              export vašich tržeb. Propojení můžete kdykoli zrušit.
            </p>
            {!user ? (
              <Link href={`/prihlaseni?redirect=/pozvanka/${token}`} className="btn-primary mt-6 w-full">
                Přihlásit se e-mailem
              </Link>
            ) : !hasBusiness ? (
              <Link href="/pokladna/nastaveni" className="btn-primary mt-6 w-full">
                Nejdřív vyplnit údaje o firmě
              </Link>
            ) : (
              <AcceptInvite token={token} />
            )}
            <p className="mt-4 text-xs text-muted">Pozvánka pro IČO {info.ico}. Nezávislá služba, není provozována Finanční správou.</p>
          </>
        )}
      </div>
    </div>
  );
}
