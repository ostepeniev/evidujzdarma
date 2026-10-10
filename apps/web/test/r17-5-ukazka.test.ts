/**
 * R17.5 (docs/tasks/2026-10-10-r17.md) – „Vyzkoušet bez registrace“: /ukazka.
 *  - hlavní obrazovka pokladny v ukázkovém režimu: 6 položek, platba hotově nebo kartou, pak účtenka;
 *  - nic na server (kromě měření /api/m z layoutu), žádné IndexedDB, localStorage ani cookies – stav jen v paměti;
 *  - texty doslovně; tlačítko SERVICE_COPY.startCta; odkaz z úvodní stránky a z /cenik; stránka je v sitePages().
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }), usePathname: () => "/ukazka" }));
mockLaunch("closed");

const SRC = new URL("../src/", import.meta.url).pathname;
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");
const T = {
  title: "Ukázka pokladny EvidujZdarma",
  h1: "Vyzkoušejte si pokladnu bez registrace",
  band: "Ukázka. Nic se neukládá ani neodesílá Finanční správě.",
  receipt: "Ukázka – účtenka nebyla odeslána Finanční správě",
};

/** Lokální moduly, které soubor (tranzitivně) importuje – @/… a relativní cesty v src. */
function localGraph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = readFileSync(entry, "utf8");
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)) {
    const spec = m[1]!;
    const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? join(dirname(entry), spec) : null;
    if (!base) continue;
    const file = [".tsx", ".ts", "/index.ts", "/index.tsx"].map((e) => base + e).find((f) => existsSync(f));
    if (file) localGraph(file, seen);
  }
  return seen;
}

describe("R17.5 – /ukazka", () => {
  it("gate: title, h1, the band and the start button (verbatim)", async () => {
    const mod = await import("@/app/(site)/ukazka/page");
    expect((mod.metadata.title as { absolute: string }).absolute).toBe(T.title);
    const h = text(renderToStaticMarkup(createElement(mod.default as FC)));
    expect(h).toContain(T.h1);
    expect(h).toContain(T.band);
    const { SERVICE_COPY } = await import("@/lib/site");
    expect(renderToStaticMarkup(createElement(mod.default as FC))).toMatch(new RegExp(`<a [^>]*href="${SERVICE_COPY.startCta.href}"[^>]*>${SERVICE_COPY.startCta.label}</a>`));
  });

  it("gate: six products with prices; cash or card; the receipt says it was not sent (no FIK/BKP/POK)", async () => {
    const { DemoPos, DemoReceipt, DEMO_CATALOG, DEMO_RECEIPT_NOTE } = await import("@/components/demo/demo-pos");
    expect(DEMO_CATALOG.map((i) => [i.name, i.price])).toEqual([
      ["Káva", 5900],
      ["Cappuccino", 6900],
      ["Croissant", 4500],
      ["Bageta", 8900],
      ["Voda", 3500],
      ["Dort", 7900],
    ]);
    const h = text(renderToStaticMarkup(createElement(DemoPos)));
    // ceny ve formátu pokladny (kc z components/pos/ui: „59,00 Kč“)
    for (const [name, kc] of [["Káva", "59"], ["Cappuccino", "69"], ["Croissant", "45"], ["Bageta", "89"], ["Voda", "35"], ["Dort", "79"]]) {
      expect(h, name).toMatch(new RegExp(`${name} ${kc},00 Kč`));
    }
    expect(DEMO_RECEIPT_NOTE).toBe(T.receipt);
    const r = text(renderToStaticMarkup(createElement(DemoReceipt, { lines: [{ name: "Káva", qty: 2, unitPrice: 5900, vatRate: 0 }], method: "card", onNew: () => {} })));
    expect(r).toContain(T.receipt);
    expect(r).toContain("118,00 Kč");
    expect(r).toContain("Karta");
    expect(r).not.toMatch(/\b(FIK|BKP|POK)\b/);
    const payment = readFileSync(join(SRC, "components/demo/demo-pos.tsx"), "utf8");
    expect(payment).toMatch(/"cash"/);
    expect(payment).toMatch(/"card"/);
  });

  it("gate: no request to /api (except /api/m from the layout) and no browser storage anywhere in the page's code", () => {
    const files = [...localGraph(join(SRC, "app/(site)/ukazka/page.tsx"))];
    expect(files.some((f) => f.endsWith("components/pos/register-screen.tsx")), "reuses the register screen").toBe(true);
    const bad: string[] = [];
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      // adresy /api/… smí být v seznamech (lib/launch.ts), požadavky ne – adresu hlídáme jen v komponentách a stránce
      const ui = /\/(components|app)\//.test(f.slice(SRC.length - 1));
      for (const re of [/fetch\(/, /indexedDB/, /localStorage/, /sessionStorage/, /document\.cookie/, /sendBeacon/, /XMLHttpRequest/, /@\/lib\/pos\/(db|sync|storage)/, ...(ui ? [/["'`]\/api\//] : [])]) {
        if (re.test(s)) bad.push(`${f.slice(SRC.length)}: ${re}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("gate: linked from the home page (second button on the first screen) and /cenik; in sitePages()", async () => {
    const { default: Home } = await import("@/app/(site)/page");
    const home = renderToStaticMarkup(createElement(Home as FC));
    const hero = home.slice(0, home.indexOf('aria-labelledby="zdarma"'));
    expect(hero).toMatch(/<a [^>]*href="\/ukazka"[^>]*>Vyzkoušet ukázku pokladny<\/a>/);
    const { default: Cenik } = await import("@/app/(site)/cenik/page");
    expect(renderToStaticMarkup(createElement(Cenik as FC))).toMatch(/href="\/ukazka"/);
    const { sitePages } = await import("@/lib/site-pages");
    expect(sitePages().map((p) => p.path)).toContain("/ukazka");
  });
});
