/**
 * R15.3 (docs/tasks/2026-10-09-r15.md) – texty doslovně a klientský skript bez úložiště v prohlížeči.
 *  - zásady: nový pododdíl „Měření návštěvnosti“, PRIVACY_VERSION 2026-10-r15;
 *  - R14.1 karta 3 v nové podobě;
 *  - beacon: žádné cookie / localStorage / sessionStorage / IndexedDB, DNT a GPC = nic neposílat; jen na marketingových stránkách.
 */
import { readFileSync } from "node:fs";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }) }));

const MEASURING =
  "Měření návštěvnosti. Abychom věděli, které stránky lidem pomáhají, počítáme návštěvy webu vlastním nástrojem na našem serveru. Nepoužíváme cookies ani jiné ukládání do vašeho zařízení a vaši IP adresu neukládáme: z IP adresy a typu prohlížeče se po dobu jednoho dne vypočítá anonymní otisk, který se o půlnoci zahodí. Uchováváme jen souhrnná čísla za den (počet zobrazení stránek, počet návštěvníků, odkud přišli a z jakého typu zařízení) po dobu 25 měsíců. Pokud máte v prohlížeči zapnutý signál Do Not Track nebo Global Privacy Control, nepočítáme vás vůbec. Právním základem je náš oprávněný zájem na zlepšování webu.";
const CARD3 = "Na webu nemáme reklamu ani sledovací cookies a vaše údaje nikomu neprodáváme.";
const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

describe("R15.3 – texts", () => {
  it("gate: the privacy policy has the new subsection verbatim (bold lead-in) and PRIVACY_VERSION 2026-10-r15", async () => {
    const { default: Privacy } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const html = renderToStaticMarkup(createElement(Privacy as FC));
    expect(text(html)).toContain(MEASURING);
    expect(html).toContain("<strong>Měření návštěvnosti.</strong>");
    const { PRIVACY_VERSION, RETENTION } = await import("@/lib/legal");
    expect(PRIVACY_VERSION).toBe("2026-10-r15");
    expect(RETENTION.analyticsMonths).toBe(25);
  });

  it("gate: R14.1 card 3 in the R15.3 wording", async () => {
    const { WHY_FREE } = await import("@/content/why-free");
    expect(WHY_FREE.cards[2]).toEqual({ title: "Nežijeme z reklamy ani z vašich dat", text: CARD3 });
  });
});

describe("R15.1 – the client script", () => {
  it("gate: it never touches cookies or browser storage, respects DNT/GPC and only beacons to /api/m", () => {
    const s = src("components/analytics-beacon.tsx");
    expect(s).not.toMatch(/document\.cookie|localStorage|sessionStorage|indexedDB|caches\./);
    expect(s).toMatch(/doNotTrack/);
    expect(s).toMatch(/globalPrivacyControl/);
    expect(s).toMatch(/sendBeacon\("\/api\/m"/);
    expect(s).toMatch(/visibilitychange/);
    expect(s).toMatch(/pagehide/);
    // žádný skript odjinud
    expect(s).not.toMatch(/https?:\/\//);
  });

  it("gate: on marketing pages only – the (site) layout has it, the app and admin layouts not", async () => {
    expect(src("app/(site)/layout.tsx")).toMatch(/<AnalyticsBeacon \/>/);
    expect(src("app/(app)/layout.tsx")).not.toMatch(/AnalyticsBeacon/);
    expect(src("app/(admin)/admin/layout.tsx")).not.toMatch(/AnalyticsBeacon/);
    expect(src("app/layout.tsx")).not.toMatch(/AnalyticsBeacon/);
  });

  it("gate: the quiz and the calculator report their funnel events", () => {
    expect(src("components/tools/quiz.tsx")).toMatch(/trackEvent\("quiz_done"\)/);
    expect(src("components/tools/eet-off-calculator.tsx")).toMatch(/trackEvent\("calculator_used"\)/);
  });

  it("gate: marketing page responses carry no Set-Cookie (proxy passes them through untouched)", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    for (const p of ["/", "/cenik", "/kontrola-ico?ico=12345679", "/navody/eet-off"]) {
      expect(proxy(new NextRequest(`http://localhost${p}`)).headers.get("set-cookie"), p).toBeNull();
    }
  });
});
