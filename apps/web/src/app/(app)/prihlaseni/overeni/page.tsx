import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Dokončení přihlášení", robots: { index: false, follow: false } };

/** Přihlašovací odkaz z e-mailu vede sem: přihlášení dokončí až tlačítko (POST), ne samotné otevření odkazu. */
export default async function VerifyLoginPage({ searchParams }: PageProps<"/prihlaseni/overeni">) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-10">
      <Logo />
      <div className="card mt-8 w-full max-w-md p-6 text-center sm:p-8">
        {typeof token === "string" && token ? (
          <>
            <h1 className="text-2xl font-bold">Dokončit přihlášení</h1>
            <p className="mt-2 text-ink-soft">Odkaz funguje jen v prohlížeči, ve kterém jste o přihlášení požádali.</p>
            <form method="post" action="/api/auth/callback" className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn-primary w-full py-4 text-lg">
                Přihlásit se
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Odkaz je neúplný</h1>
            <Link href="/prihlaseni" className="btn-secondary mt-6">
              Poslat nový odkaz
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
