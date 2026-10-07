/**
 * R10.5 (рецензія №7) – profil recenzentky podle odpovědi Heleny Jeřábkové (7. 10.): účetní s 22 lety praxe a citát.
 * Zápis v rejstříku Komory daňových poradců na webu být nesmí (její přání) – ani titul, ani číslo, ani sameAs/hasCredential.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getGuide } from "@/content/guides";
import { guideJsonLd } from "@/lib/guide-page";
import { REVIEWER_TITLE, SITE } from "@/lib/site";
import { pageText } from "./helpers/render-text";

const QUOTE =
  "EET 2.0 není jen spuštění nějaké aplikace – pro každého podnikatele to znamená další každodenní rutinu. Stát sice slibuje základní aplikaci, ale ruční zadávání každé účtenky se rychle změní v bolest hlavy a bude zabírat spoustu času. Abyste se vyhnuli frontám a chybám, připravte se už teď: nejlépe hned nastavte automatizaci, která za vás papírování vyřídí na pozadí.";
const SIGNATURE = `— Helena Jeřábková, ${REVIEWER_TITLE}`;
const SRC = new URL("../src", import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
const withoutComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1");
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("R10.5 – the reviewer's profile and quote", () => {
  it("gate: /o-nas #odborna-revize – first paragraph and the quote with signature (verbatim)", async () => {
    const { default: About } = await import("@/app/(site)/o-nas/page");
    const text = pageText(About as FC);
    expect(text).toContain(
      `Věcnou správnost návodů kontroluje Helena Jeřábková, ${REVIEWER_TITLE} s 22 lety praxe. U každého zkontrolovaného návodu uvádíme, kdo ho zkontroloval. Pokud v návodu najdete chybu, napište nám na ${SITE.email}.`,
    );
    const html = decode(renderToStaticMarkup(createElement(About as FC)));
    const section = html.slice(html.indexOf('id="odborna-revize"'));
    expect(section).toMatch(new RegExp(`<blockquote[^>]*>[\\s\\S]*${QUOTE.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    expect(text).toContain(QUOTE);
    expect(text).toContain(SIGNATURE);
  });

  it("gate: the same quote closes the intro of eet-2-0-kompletni-pruvodce, with a changelog entry", async () => {
    const g = getGuide("eet-2-0-kompletni-pruvodce")!;
    const intro = g.sections[0]!;
    expect(intro.blocks.at(-1)).toEqual({ quote: QUOTE, cite: `Helena Jeřábková, ${REVIEWER_TITLE}` });
    expect(g.changelog).toContainEqual({ date: "2026-10-07", text: "Doplněn citát odbornice (Helena Jeřábková)." });
    const { default: GuidePage } = await import("@/app/(site)/navody/[slug]/page");
    const html = decode(renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: g.slug }) } as never)) as ReactElement));
    expect(html).toMatch(/<blockquote[^>]*>/);
    expect(html).toContain(QUOTE);
    expect(html).toContain(SIGNATURE);
    const { llmsFullTxt } = await import("@/lib/llms");
    expect(llmsFullTxt()).toContain(QUOTE);
  });

  it("gate: JSON-LD reviewedBy has description 'účetní s 22 lety praxe', no sameAs or hasCredential", () => {
    for (const slug of ["eet-2-0-kompletni-pruvodce", "kontaktni-platba"]) {
      const article = guideJsonLd(getGuide(slug)!).find((x) => x["@type"] === "Article") as { reviewedBy: Record<string, unknown> };
      expect(article.reviewedBy.description, slug).toBe("účetní s 22 lety praxe");
      expect(article.reviewedBy, slug).not.toHaveProperty("sameAs");
      expect(article.reviewedBy, slug).not.toHaveProperty("hasCredential");
    }
  });

  it("gate: nowhere on the site 'daňová poradkyně', 'Komora daňových poradců' or a registry number with the reviewer", async () => {
    const hits: string[] = [];
    for (const f of files(SRC)) {
      for (const [i, line] of withoutComments(readFileSync(f, "utf8")).split("\n").entries()) {
        if (/poradkyn|Komor\w* daňových poradců|\bKDP\b|evidenční číslo|číslo osvědčení|hasCredential/i.test(line)) hits.push(`${f.slice(SRC.length + 1)}:${i + 1}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
    const { default: About } = await import("@/app/(site)/o-nas/page");
    expect(pageText(About as FC)).not.toMatch(/poradkyn|Komor\w* daňových poradců|\bKDP\b/i);
  });
});
