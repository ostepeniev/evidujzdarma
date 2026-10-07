/**
 * R9.13 (рецензія №6) – og:url ukazoval na úvodní stránku na každé stránce (kořenový layout), na návodech chyběl. Facebook
 * bere og:url jako adresu příspěvku, takže sdílený odkaz na /cenik se zobrazil jako úvodní stránka. Nově kořenový layout
 * og:url nemá a každá stránka s alternates.canonical bere canonical i og:url z jednoho helperu (lib/metadata.ts).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { GUIDES } from "@/content/guides";
import { guideMetadata } from "@/lib/guide-page";
import { SITE, SITE_URL } from "@/lib/site";

const SRC = new URL("../src", import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

/** og:url a canonical tak, jak je Next vyrenderuje (stejné resolvery jako při renderu stránky). */
async function resolved(m: Metadata, pathname: string) {
  const { resolveOpenGraph } = await import("next/dist/lib/metadata/resolvers/resolve-opengraph.js");
  const { resolveAlternates } = await import("next/dist/lib/metadata/resolvers/resolve-basics.js");
  const base = new URL(SITE_URL);
  const ctx = { trailingSlash: false, isStaticMetadataRouteFile: false } as never;
  const og = await resolveOpenGraph(m.openGraph as never, base, Promise.resolve(pathname), ctx, null as never);
  const alt = await resolveAlternates(m.alternates as never, base, Promise.resolve(pathname), ctx);
  return { ogUrl: og?.url ? String(og.url) : null, canonical: alt?.canonical?.url ? String(alt.canonical.url) : null };
}

const PAGES: [string, () => Promise<Metadata>][] = [
  ["/", async () => (await import("@/app/(site)/page")).metadata],
  ["/cenik", async () => (await import("@/app/(site)/cenik/page")).metadata],
  ["/kalkulacka-eet-off", async () => (await import("@/app/(site)/kalkulacka-eet-off/page")).metadata],
  [`/navody/${GUIDES[0]!.slug}`, async () => guideMetadata(GUIDES[0]!)],
  ["/ucetni", async () => (await import("@/app/(site)/ucetni/page")).metadata],
];

describe("R9.13 – og:url equals the canonical URL", () => {
  it("gate: the root layout no longer sets og:url (and keeps type, locale, siteName)", async () => {
    const { metadata } = await import("@/app/layout");
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og).not.toHaveProperty("url");
    expect(og).toMatchObject({ type: "website", locale: "cs_CZ", siteName: SITE.name });
  });

  it.each(PAGES)("gate: %s – og:url = canonical (as rendered), og keeps type/locale/siteName", async (path, load) => {
    const m = await load();
    expect((m.openGraph as { url?: unknown }).url).toBe((m.alternates as { canonical?: unknown }).canonical);
    const r = await resolved(m, path);
    expect(r.canonical).toBe(path === "/" ? SITE_URL : `${SITE_URL}${path}`);
    expect(r.ogUrl).toBe(r.canonical);
    expect(m.openGraph).toMatchObject({ locale: "cs_CZ", siteName: SITE.name });
    expect((m.openGraph as { type?: string }).type).toMatch(/^(website|article)$/);
  });

  it("gate: every page with a canonical URL takes it from canonicalMeta() – no hand-written alternates.canonical", () => {
    const hits: string[] = [];
    for (const f of files(SRC)) {
      const rel = f.slice(SRC.length + 1);
      if (rel === "lib/metadata.ts") continue;
      const text = readFileSync(f, "utf8");
      if (/alternates\s*:\s*\{\s*canonical/.test(text)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});
