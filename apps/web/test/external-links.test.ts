/**
 * R8.1 (рецензія №5, B В-2; chyba hlášená vlastníkem) – externí odkazy se otevírají v nové kartě.
 *  - sken: žádné <a> s externím href mimo ExternalLink (výjimka: HTML kód odznaku v partner-badge, který si účetní vkládá na svůj web);
 *  - render: každý <a href="http…"> v hlavičce, patičce, RichText, na úvodní stránce, /evidencni-jednotky, /srovnani/moje-eet
 *    a v zásadách má target="_blank" a rel s noopener i noreferrer.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// úvodní stránka má klientský formulář s useRouter – pro statický render stačí atrapa
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }) }));

const SRC = new URL("../src", import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : f.endsWith(".tsx") ? [p] : [];
  });
}

/** href, který zůstává na webu: "/…", "#…", "mailto:…" (i jako šablona `/…`). */
const INTERNAL = /^(?:"(?:\/|#|mailto:)|\{`(?:\/|#|mailto:)|\{"(?:\/|#|mailto:))/;

describe("R8.1 – external links open in a new tab", () => {
  it("gate: no <a> with an external href outside ExternalLink (except the partner badge HTML snippet)", () => {
    const out: string[] = [];
    for (const f of files(SRC)) {
      const rel = relative(SRC, f);
      if (rel === "components/external-link.tsx") continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/<a\b([^>]*)>/g)) {
        // HTML kód odznaku je řetězec (šablona), ne JSX – účetní ho vkládá na svůj web (B-r5 розд. 5)
        if (rel === "components/accountant/partner-badge.tsx" && src[m.index! - 1] === "`") continue;
        const href = /\bhref=("[^"]*"|\{[^}]*\})/.exec(m[1]!)?.[1];
        if (!href || !INTERNAL.test(href)) out.push(`${rel}:${src.slice(0, m.index).split("\n").length} ${href ?? "(bez href)"}`);
      }
    }
    expect(out).toEqual([]);
  });

  it("gate: rendered header, footer, RichText and public pages – every external <a> has target=_blank and rel noopener noreferrer", async () => {
    const { SiteHeader } = await import("@/components/site-header");
    const { SiteFooter } = await import("@/components/site-footer");
    const { RichText } = await import("@/components/rich-text");
    const pages: [string, FC][] = [
      ["header", SiteHeader as FC],
      ["footer", SiteFooter as FC],
      ["RichText", () => createElement(RichText, { text: "viz [zdroj](https://a.cz)" })],
    ];
    for (const p of ["page", "evidencni-jednotky/page", "srovnani/moje-eet/page", "ochrana-osobnich-udaju/page"]) {
      pages.push([p, (await import(`@/app/(site)/${p}`)).default as FC]);
    }
    const bad: string[] = [];
    let external = 0;
    for (const [name, C] of pages) {
      const html = renderToStaticMarkup(createElement(C));
      for (const m of html.matchAll(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>/g)) {
        external++;
        const tag = m[0];
        const rel = /rel="([^"]*)"/.exec(tag)?.[1] ?? "";
        if (!/target="_blank"/.test(tag) || !/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) bad.push(`${name}: ${m[1]} ${tag}`);
      }
    }
    expect(external).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });

  it("gate: screen readers hear that the link opens a new window", async () => {
    const { ExternalLink } = await import("@/components/external-link");
    const html = renderToStaticMarkup(createElement(ExternalLink, { href: "https://eet.gov.cz", className: "underline", children: "eet.gov.cz" }));
    expect(html).toBe('<a href="https://eet.gov.cz" class="underline" target="_blank" rel="noopener noreferrer">eet.gov.cz<span class="sr-only"> (otevře se v novém okně)</span></a>');
  });
});
