import Link from "next/link";
import { dateCs } from "./paths";
import { ExternalLink } from "@/components/external-link";

/** Zdroj a datum dat pro seznamové stránky katalogu + odkaz na námitku. */
export function ListSource({ date }: { date: string | null }) {
  return (
    <p className="mt-6 text-sm text-muted">
      Zdroj: Registr ekonomických subjektů ČSÚ a{" "}
      <ExternalLink href="https://ares.gov.cz/" className="underline underline-offset-4">
        ARES
      </ExternalLink>
      {date && (
        <>
          , data k <time dateTime={date}>{dateCs(date)}</time>
        </>
      )}
      . EET relevance je odhad podle oboru činnosti CZ-NACE, nikoli právní posouzení.{" "}
      <Link href="/navody/koho-se-eet-tyka" className="underline underline-offset-4">
        Koho se EET týká
      </Link>{" "}
      ·{" "}
      <Link href="/namitka" className="underline underline-offset-4" rel="nofollow">
        Námitka / oprava údajů
      </Link>
    </p>
  );
}
