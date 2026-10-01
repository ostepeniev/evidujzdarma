import Link from "next/link";
import { objectionPath } from "./paths";

/** Akce pro majitele: připravit EET, ověřit (převzít) profil, nahlásit chybu. */
export function OwnerCta({ ico, icp, claimed, claimLabel = "Ověřit profil" }: { ico: string; icp?: string; claimed: boolean; claimLabel?: string }) {
  return (
    <aside aria-labelledby="owner-cta" className="rounded-2xl bg-brand-700 p-6 text-white">
      <h2 id="owner-cta" className="text-xl font-bold">
        Jste majitel? Připravte EET
      </h2>
      <p className="mt-2 text-[15px] text-brand-100">EET 2.0 platí od 1. 1. 2027. Zjistěte, co musíte udělat, a evidujte v pokladně zdarma.</p>
      <div className="mt-5 flex flex-col gap-2">
        <Link href={`/kontrola-ico?ico=${ico}`} className="btn bg-white text-brand-700 hover:bg-brand-50" rel="nofollow">
          Zkontrolovat EET pro IČO {ico}
        </Link>
        <Link href="/#registrace" className="btn border border-brand-200/40 text-white hover:bg-brand-600">
          Pokladna zdarma – předregistrace
        </Link>
      </div>
      <div className="mt-6 border-t border-brand-200/30 pt-5 text-[15px]">
        {claimed ? (
          <p className="text-brand-100">Profil ověřil vlastník.</p>
        ) : (
          <Link href="/#registrace" className="font-semibold text-white underline underline-offset-4">
            {claimLabel}
          </Link>
        )}
        <p className="mt-2">
          <Link href={objectionPath({ ico, icp })} className="text-brand-100 underline underline-offset-4" rel="nofollow">
            Nahlásit chybu / námitka
          </Link>
        </p>
      </div>
    </aside>
  );
}
