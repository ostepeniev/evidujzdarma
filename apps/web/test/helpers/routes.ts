/**
 * Routy aplikace z adresáře src/app – stejná pravidla jako internal-links.test.ts (R2.9): skupiny (x) se vynechávají,
 * [param] je libovolný segment. Navíc zná slugy návodů a nápovědy (dynamicParams = false → jiný slug je 404).
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APP = join(__dirname, "../../src/app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function appRoutes(): string[][] {
  return walk(APP)
    .filter((f) => /\/(page\.tsx|route\.tsx?)$/.test(f))
    .map((f) =>
      relative(APP, f)
        .split("/")
        .slice(0, -1)
        .filter((s) => !/^\(.*\)$/.test(s)),
    );
}

/** Vede interní cesta (bez # a ?) na existující stránku? */
export function resolvesPath(path: string, slugs: { navody: ReadonlySet<string>; napoveda: ReadonlySet<string> }, routes = appRoutes()): boolean {
  const segs = path.split(/[?#]/)[0]!.split("/").filter(Boolean);
  return routes.some((r) => {
    if (r.length !== segs.length) return false;
    return r.every((s, i) => {
      if (!/^\[.+\]$/.test(s)) return s === decodeURIComponent(segs[i]!);
      if (r[0] === "navody" && i === 1) return slugs.navody.has(segs[i]!);
      if (r[0] === "napoveda" && i === 1) return slugs.napoveda.has(segs[i]!);
      return true;
    });
  });
}
