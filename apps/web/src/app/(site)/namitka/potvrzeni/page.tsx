import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Potvrzení žádosti", robots: { index: false, follow: false } };

/** Potvrzení námitky – stránka jen zobrazí tlačítko, stav mění až POST. */
export default async function ConfirmObjectionPage({ searchParams }: PageProps<"/namitka/potvrzeni">) {
  const q = await searchParams;
  const token = typeof q.token === "string" ? q.token : null;
  return (
    <div className="container-prose py-16 text-center">
      {q.hotovo ? (
        <>
          <h1 className="text-3xl font-extrabold">Žádost je potvrzená</h1>
          <p className="mt-3 text-lg text-ink-soft">Stránku jsme vyřadili z vyhledávačů. Žádost vyřídíme nejpozději do 30 dnů.</p>
        </>
      ) : token ? (
        <>
          <h1 className="text-3xl font-extrabold">Potvrďte svou žádost</h1>
          <p className="mt-3 text-lg text-ink-soft">Potvrzením nám dáte vědět, že žádost ke katalogu firem jste odeslali vy.</p>
          <form method="post" action="/api/namitka/potvrdit" className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn-primary px-8 py-4 text-lg">
              Potvrdit žádost
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold">Odkaz už neplatí</h1>
          <p className="mt-3 text-lg text-ink-soft">Žádost už byla potvrzena nebo je odkaz neúplný.</p>
          <Link href="/namitka" className="btn-secondary mt-6">
            Podat novou žádost
          </Link>
        </>
      )}
    </div>
  );
}
