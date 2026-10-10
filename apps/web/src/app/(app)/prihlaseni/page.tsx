import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/pos/login-form";
import { Logo } from "@/components/logo";
import { isClosed } from "@/lib/launch";

export const metadata: Metadata = { title: isClosed("/pokladna") ? "Přihlášení" : "Přihlášení a registrace" };

export default async function LoginPage({ searchParams }: PageProps<"/prihlaseni">) {
  const { chyba, redirect } = await searchParams;
  const redirectTo = typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/pokladna/nastaveni";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-10">
      <Link href="/" aria-label="EvidujZdarma – úvod">
        <Logo />
      </Link>
      <div className="card mt-8 w-full max-w-sm p-6 sm:p-8">
        {/* po otevření pokladny (R17.2) je to i registrace – účet se založí při prvním přihlášení */}
        {isClosed("/pokladna") ? (
          <>
            <h1 className="text-2xl font-bold">Přihlášení</h1>
            <p className="mt-2 text-[15px] text-ink-soft">Pošleme vám odkaz pro přihlášení. Žádné heslo si nemusíte pamatovat.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Přihlášení a registrace</h1>
            <p className="mt-2 text-[15px] text-ink-soft">Zadejte e-mail a pošleme vám odkaz. Pokud u nás účet ještě nemáte, založíme ho. Heslo si pamatovat nemusíte.</p>
          </>
        )}
        {chyba === "odkaz" && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-50 p-3 text-[15px] text-danger-600">
            Odkaz vypršel nebo už byl použit. Pošleme nový.
          </p>
        )}
        {chyba === "prohlizec" && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-50 p-3 text-[15px] text-danger-600">
            Odkaz otevřete ve stejném prohlížeči, ve kterém jste o přihlášení požádali – nebo si tady pošlete nový.
          </p>
        )}
        <LoginForm redirectTo={redirectTo} />
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-muted">Nezávislá služba, není provozována Finanční správou.</p>
    </div>
  );
}
