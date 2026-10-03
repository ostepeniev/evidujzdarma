import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Stránka nenalezena", robots: { index: false, follow: true } };

/** 404 s pláškou „Nezávislá služba…“ a provozovatelem jako každá stránka webu (inv. 9, R7.7). */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="obsah" className="flex-1">
        <div className="container-prose py-20 text-center">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Stránka nenalezena</h1>
          <p className="mt-4 text-lg text-ink-soft">Odkaz je neplatný nebo stránka už neexistuje.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">
              Na úvodní stránku
            </Link>
            <Link href="/kontrola-ico" className="btn-secondary">
              Zkontrolovat IČO
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
