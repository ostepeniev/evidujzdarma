"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { icoFromHash } from "@/lib/hash-params";

/**
 * Kontrola IČO z odkazu katalogu: /kontrola-ico#ico=12345679. Fragment roboti neprocházejí (žádné nové URL z milionu
 * stránek firem, COMMON 9); v prohlížeči ho tady přečteme a načteme výsledek stejně jako po odeslání formuláře (?ico=,
 * výsledek je noindex). Neplatné IČO ve fragmentu se ignoruje.
 */
export function IcoHashRedirect({ path = "/kontrola-ico" }: { path?: string }) {
  const router = useRouter();
  useEffect(() => {
    const ico = icoFromHash(window.location.hash);
    if (ico) router.replace(`${path}?ico=${ico}`);
  }, [router, path]);
  return null;
}
