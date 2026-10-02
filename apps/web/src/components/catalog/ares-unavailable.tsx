import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { aresUrl } from "./paths";

/** Firma není v našem katalogu a ARES právě neodpovídá: místo chyby 500 vysvětlení a odkaz přímo do ARES. */
export function AresUnavailable({ ico }: { ico: string }) {
  return (
    <>
      <PageHeader title={`IČO ${ico}`} crumbs={[{ name: "Katalog firem", path: "/firmy" }]} lead="Údaje z registru ARES teď nejsou k dispozici." />
      <div className="container-page py-10">
        <section className="card max-w-2xl space-y-4">
          <p>
            Tento subjekt zatím není v našem katalogu, proto jeho údaje načítáme živě z registru ARES Ministerstva financí. ARES nám teď neodpověděl
            – zkuste stránku obnovit za pár minut.
          </p>
          <p>
            Údaje si můžete ověřit i přímo v{" "}
            <a href={aresUrl(ico)} className="text-brand-700 underline underline-offset-4" rel="noopener" target="_blank">
              ARES
            </a>
            , nebo zkusit naši{" "}
            <Link href="/kontrola-ico" className="text-brand-700 underline underline-offset-4">
              kontrolu IČO
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
