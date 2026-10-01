import Link from "next/link";
import { aresUrl, dateCs, objectionPath } from "./paths";

/** Odkud jsou údaje + k jakému datu + odkaz na oficiální záznam a na námitku. Na každé stránce katalogu. */
export function SourceNote({ ico, icp, source }: { ico: string; icp?: string; source: { kind: "ares" | "res"; date: string } }) {
  return (
    <section aria-label="Zdroj údajů" className="rounded-2xl border border-line bg-surface p-5 text-[15px] text-ink-soft">
      <p className="font-semibold text-ink">
        {source.kind === "ares" ? (
          <>
            Údaje ověřeny v ARES k <time dateTime={source.date}>{dateCs(source.date)}</time>
          </>
        ) : (
          <>
            Údaje z Registru ekonomických subjektů ČSÚ, načteno <time dateTime={source.date}>{dateCs(source.date)}</time> (zatím neověřeno v ARES)
          </>
        )}
      </p>
      <p className="mt-1">
        Zobrazujeme jen veřejné údaje z registrů (ARES, živnostenský rejstřík, RES ČSÚ) bez vlastních popisů a hodnocení.{" "}
        <a href={aresUrl(ico)} className="font-medium text-brand-700 underline underline-offset-4" rel="noopener" target="_blank">
          Oficiální záznam v ARES
        </a>
        {" · "}
        <Link href={objectionPath({ ico, icp })} className="font-medium text-brand-700 underline underline-offset-4" rel="nofollow">
          Nahlásit chybu / námitka
        </Link>
      </p>
    </section>
  );
}
