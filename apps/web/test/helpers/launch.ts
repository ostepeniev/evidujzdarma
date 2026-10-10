/**
 * Stav „pokladna zavřená / otevřená“ pro testy (R17.2). Testy nečtou natvrdo zapsané seznamy: vezmou skutečné
 * CLOSED_SECTIONS / CLOSED_API z lib/launch.ts a jen přidají nebo uberou sekce pokladny. Commit otevření (kontrolor,
 * 2. 11.) tak testy nerozbije – „zavřený“ test si zavřený stav nasimuluje, „otevřený“ otevřený.
 * Katalog (/firmy, /firma, /provozovna, /obor) zůstává, jak je ve skutečném seznamu.
 */
import { vi } from "vitest";

/** Sekce pokladny, které commit otevření odebere z CLOSED_SECTIONS. */
export const POS_SECTIONS = ["/pokladna", "/prihlaseni", "/kabinet", "/pozvanka", "/u"] as const;
/** API pokladny se session cookie, které commit otevření odebere z CLOSED_API. */
export const POS_API = ["/api/ucet", "/api/auth", "/api/kabinet", "/api/pozvanka"] as const;

type Launch = typeof import("@/lib/launch");

export function launchAs(real: Launch, state: "open" | "closed"): Launch {
  const pos = new Set<string>([...POS_SECTIONS, ...POS_API]);
  const sections = (state === "open" ? real.CLOSED_SECTIONS.filter((p) => !pos.has(p)) : [...new Set([...POS_SECTIONS, ...real.CLOSED_SECTIONS])]) as unknown as Launch["CLOSED_SECTIONS"];
  const api = (state === "open" ? real.CLOSED_API.filter((p) => !pos.has(p)) : [...new Set([...POS_API, ...real.CLOSED_API])]) as unknown as Launch["CLOSED_API"];
  const isClosed = (path: string) => [...sections, ...api].some((p) => path === p || path.startsWith(`${p}/`));
  return { ...real, CLOSED_SECTIONS: sections, CLOSED_API: api, isClosed, CATALOG_CLOSED: isClosed("/firmy") };
}

/** Přepne stav pro další importy: resetModules + doMock. Moduly závislé na lib/launch importujte až potom (dynamicky). */
export function mockLaunch(state: "open" | "closed"): void {
  vi.resetModules();
  vi.doMock("@/lib/launch", async (orig) => launchAs(await orig<Launch>(), state));
}
