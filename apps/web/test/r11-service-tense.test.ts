/**
 * R11 (рецензія №8) – zbylé texty o pokladně v přítomném čase. Pět s přepínačem v SERVICE_COPY (lib/site.ts,
 * isClosed("/pokladna")) – po otevření pokladny se vrátí dnešní text; pět natrvalo bez času („i bez signálu“). Texty doslovně.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "./helpers/launch";

// úvodní stránka má klientský formulář s useRouter – pro statický render stačí atrapa
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }) }));

const CLOSED = {
  hero: "Bezplatná pokladna pro EET 2.0, která bude fungovat i bez signálu.",
  toolCta: "Pokladnu pro EET 2.0 připravujeme: zdarma navždy, i bez signálu, pro až 5 uživatelů, s účtenkou e-mailem i QR.",
  guideSidebar: "Připravujeme: i bez signálu, pro až 5 uživatelů.",
  calculatorCta: "Rozhodli jste se evidovat? Pokladnu EvidujZdarma připravujeme – zdarma navždy a i bez signálu. Předregistrujte se už teď.",
  compareCta: "Zkontrolujte své IČO za 10 vteřin, nebo se rovnou předregistrujte k bezplatné pokladně, která bude fungovat i bez signálu.",
};
const OPEN = {
  hero: "Bezplatná pokladna pro EET 2.0, která funguje i bez signálu.",
  toolCta: "Pokladna pro EET 2.0 zdarma navždy: funguje i bez signálu, až 5 uživatelů, účtenka e-mailem i QR.",
  guideSidebar: "Funguje i bez signálu, až 5 uživatelů.",
  calculatorCta: "Rozhodli jste se evidovat? Pokladna EvidujZdarma je zdarma navždy, funguje i bez signálu a zvládne ji každý za 15 minut.",
  compareCta: "Zkontrolujte své IČO za 10 vteřin, nebo se rovnou předregistrujte k bezplatné pokladně, která funguje i bez signálu.",
};
const PRESENT = /[Ff]unguje i bez signálu/;

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ");

async function renderPages() {
  const out: Record<string, string> = {};
  for (const p of ["page", "kalkulacka-eet-off/page", "srovnani/moje-eet/page", "o-nas/page"]) {
    const C = (await import(`@/app/(site)/${p}`)).default as FC;
    out[p] = text(renderToStaticMarkup(createElement(C)));
  }
  const { default: GuidePage } = await import("@/app/(site)/navody/[slug]/page");
  out.guide = text(renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: "kontaktni-platba" }) } as never)) as ReactElement));
  return out;
}

// zavřená pokladna simulovaná ze skutečných seznamů – commit otevření 2. 11. testy nerozbije (R17.2)
mockLaunch("closed");
afterEach(() => {
  mockLaunch("closed");
});

describe("R11 – no present tense about the register while /pokladna is closed", () => {
  it("gate: closed – home, a guide, /kalkulacka-eet-off, /srovnani/moje-eet and /o-nas have no 'funguje i bez signálu'; the switched texts (verbatim)", async () => {
    const pages = await renderPages();
    for (const [name, t] of Object.entries(pages)) expect(t, name).not.toMatch(PRESENT);
    expect(pages.page).toContain(CLOSED.hero);
    expect(pages.guide).toContain(CLOSED.guideSidebar);
    expect(pages["kalkulacka-eet-off/page"]).toContain(CLOSED.calculatorCta);
    expect(pages["srovnani/moje-eet/page"]).toContain(CLOSED.compareCta);
    // ToolCta bez vlastního textu (např. /navody)
    const { ToolCta } = await import("@/components/tool-cta");
    expect(text(renderToStaticMarkup(createElement(ToolCta)))).toContain(CLOSED.toolCta);
  });

  it("gate: texts without tense, for good (verbatim)", async () => {
    const pages = await renderPages();
    expect(pages.page).toContain("I bez signálu");
    expect(pages.page).toContain("Tržby se uloží v zařízení a odešlou se samy, jakmile bude připojení. Lhůtu pro dodatečné odeslání pohlídáme.");
    expect(pages["o-nas/page"]).toContain("a když ano, evidovat v naší pokladně – zdarma navždy a i bez signálu.");
    const og = await import("@/app/opengraph-image");
    expect(og.alt).toBe("EvidujZdarma – evidence tržeb EET 2.0 zdarma, i bez signálu");
    expect(readFileSync(new URL("../src/app/opengraph-image.tsx", import.meta.url), "utf8")).toContain("Bezplatná pokladna pro EET 2.0 – i bez signálu.");
    const { default: manifest } = await import("@/app/manifest");
    expect(manifest().description).toBe("Bezplatná pokladna pro evidenci tržeb EET 2.0 – i bez signálu.");
  });

  it("open (mock) – today's texts come back", async () => {
    mockLaunch("open");
    const { SERVICE_COPY } = await import("@/lib/site");
    expect(SERVICE_COPY).toMatchObject(OPEN);
    const pages = await renderPages();
    expect(pages.page).toContain(OPEN.hero);
    expect(pages.guide).toContain(OPEN.guideSidebar);
    expect(pages["kalkulacka-eet-off/page"]).toContain(OPEN.calculatorCta);
    expect(pages["srovnani/moje-eet/page"]).toContain(OPEN.compareCta);
  });

  it("gate: the switched texts live only in lib/site.ts", () => {
    const SRC = new URL("../src", import.meta.url).pathname;
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
      });
    const hits: string[] = [];
    for (const f of files(SRC)) {
      if (f.endsWith("/lib/site.ts")) continue;
      const src = readFileSync(f, "utf8").replace(/\s+/g, " ");
      for (const t of [...Object.values(CLOSED), ...Object.values(OPEN)]) if (src.includes(t)) hits.push(`${f.slice(SRC.length + 1)}: ${t.slice(0, 50)}`);
    }
    expect(hits).toEqual([]);
  });
});
