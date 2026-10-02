/**
 * R2.9 – žádné interní 404: každý interní odkaz ve zdrojích (href, path, markdown, absoluteUrl, sitemap)
 * musí odpovídat existující routě; odkazy na návody jen na existující slugy. A llms*.txt jen z indexovaných návodů.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES, isIndexable } from "@/content/guides";
import { llmsFullTxt, llmsTxt } from "@/lib/llms";
import { STATIC_PAGES } from "@/lib/static-pages";

const ROOT = join(__dirname, "..");
const APP = join(ROOT, "src/app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Routy z adresáře app/: skupiny (x) se vynechávají, [param] je libovolný segment. */
const ROUTES = walk(APP)
  .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f) || /\/(sitemap|robots|opengraph-image|icon|manifest)\.(ts|tsx)$/.test(f))
  .map((f) => {
    const rel = relative(APP, f).split("/").slice(0, -1).filter((s) => !/^\(.*\)$/.test(s));
    const name = f.split("/").pop()!.replace(/\.(ts|tsx)$/, "");
    if (["sitemap", "robots", "manifest"].includes(name)) rel.push(name === "sitemap" ? "sitemap.xml" : name === "robots" ? "robots.txt" : "manifest.webmanifest");
    if (name === "opengraph-image" || name === "icon") rel.push(name);
    return rel;
  });

const GUIDE_SLUGS = new Set(GUIDES.map((g) => g.slug));

function resolves(path: string): boolean {
  const segs = path.split("/").filter(Boolean);
  return ROUTES.some((r) => {
    if (r.length !== segs.length) return false;
    return r.every((s, i) => {
      if (!/^\[.+\]$/.test(s)) return s === decodeURIComponent(segs[i]!);
      if (r[0] === "navody" && i === 1) return GUIDE_SLUGS.has(segs[i]!);
      return true;
    });
  });
}

const PATTERNS = [/href=["'{`]+(\/[^"'`}\s)#?]*)/g, /href: ["'`](\/[^"'`#?]*)/g, /path: ["'`](\/[^"'`#?]*)/g, /\]\((\/[^)#?\s]*)/g, /absoluteUrl\(["'`](\/[^"'`#?]*)/g, /url: absoluteUrl\(["'`](\/[^"'`#?]*)/g];
const IGNORE = /\$\{|^\/api\/|^\/_next|\.(svg|png|ico|txt|xml|webmanifest)$|^\/u\/|^\/pozvanka\//;

describe("R2.9 – no internal 404", () => {
  it("every internal link in the sources resolves to a route", () => {
    const broken: string[] = [];
    for (const file of walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const text = readFileSync(file, "utf8");
      for (const re of PATTERNS) {
        for (const m of text.matchAll(re)) {
          const path = m[1]!.replace(/\/$/, "") || "/";
          if (IGNORE.test(path)) continue;
          if (!resolves(path)) broken.push(`${relative(ROOT, file)}: ${path}`);
        }
      }
    }
    expect([...new Set(broken)]).toEqual([]);
  });

  it("sitemap static pages resolve", () => {
    expect(STATIC_PAGES.filter((p) => !resolves(p.path)).map((p) => p.path)).toEqual([]);
  });

  it("llms.txt and llms-full.txt list only indexable guides", () => {
    const hidden = GUIDES.filter((g) => !isIndexable(g));
    for (const g of hidden) {
      expect(llmsTxt(), g.slug).not.toContain(`/navody/${g.slug})`);
      expect(llmsFullTxt(), g.slug).not.toContain(`/navody/${g.slug} ·`);
    }
    for (const g of GUIDES.filter(isIndexable)) expect(llmsTxt()).toContain(`/navody/${g.slug})`);
  });
});
