import type { ReactNode } from "react";

/**
 * Odkaz mimo EvidujZdarma (zdroje, eet.gov.cz, ARES…): vždy v nové kartě, bez předání okna a refereru (R8.1).
 * Čtečka obrazovky slyší, že se otevře nové okno.
 */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (otevře se v novém okně)</span>
    </a>
  );
}
