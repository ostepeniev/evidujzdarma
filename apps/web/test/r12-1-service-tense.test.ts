/**
 * R12.1 (рецензія №9) – poslední čtyři texty o pokladně v přítomném čase: odstavec nad srovnáním na úvodní stránce,
 * FAQ „Co když nemám signál?“, note v návodu eet-bez-internetu a komentář v myths.ts. Přepínač v SERVICE_COPY
 * (lib/site.ts, isClosed("/pokladna")); po otevření pokladny se vrátí dnešní text. Texty doslovně.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type FC, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FACTS } from "@/content/facts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }) }));

const CLOSED = {
  compareIntro:
    "Státní aplikace MOJE eet je dobrá volba pro nejmenší podnikatele. Naše pokladna navíc bude umět prodávat bez signálu, tisknout na tiskárnu a posílat účtenky e-mailem; nástroje pro účetní nabízíme už teď. Tyto funkce MOJE eet podle dosud zveřejněných informací nemá.",
  offlineFaq: "Naše pokladna bude tržbu ukládat v zařízení, odešle ji sama, jakmile bude spojení, a ukáže, kolik času do konce lhůty zbývá.",
  offlineNote: "Pokladna EvidujZdarma, kterou připravujeme, bude u každé neodeslané tržby ukazovat, kolik času do konce lhůty zbývá, a upozorní vás dřív, než lhůta vyprší.",
  certificateComment: "Pro podnikatele je to detail – důležité je, že bez certifikátu z DIS+ evidovat nejde. Naše pokladna bude podpis řešit sama, certifikát jen nahrajete.",
};
const OPEN = {
  compareIntro:
    "Státní aplikace MOJE eet je dobrá volba pro nejmenší podnikatele. My navíc nabízíme práci bez signálu, tiskárny, účtenky e-mailem a nástroje pro účetní – funkce, které MOJE eet podle dosud zveřejněných informací nemá.",
  offlineFaq: "Naše pokladna tržbu uloží v zařízení, odešle ji sama, jakmile je spojení, a ukazuje, kolik času do konce lhůty zbývá.",
  offlineNote: "Pokladna EvidujZdarma ukazuje u každé neodeslané tržby, kolik času do konce lhůty zbývá, a upozorní vás dřív, než lhůta vyprší.",
  certificateComment: "Pro podnikatele je to detail – důležité je, že bez certifikátu z DIS+ evidovat nejde. Naše pokladna podpis řeší sama, certifikát jen nahrajete.",
};
const PRESENT = /nabízíme práci bez signálu|Naše pokladna tržbu uloží|ukazuje u každé neodeslané tržby|podpis řeší sama/;

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ");

async function publicTexts() {
  const out: Record<string, string> = {};
  for (const p of ["page", "co-se-o-eet-pise-spatne/page"]) out[p] = text(renderToStaticMarkup(createElement((await import(`@/app/(site)/${p}`)).default as FC)));
  const { default: GuidePage } = await import("@/app/(site)/navody/[slug]/page");
  out.guide = text(renderToStaticMarkup((await GuidePage({ params: Promise.resolve({ slug: "eet-bez-internetu" }) } as never)) as ReactElement));
  const { llmsFullTxt } = await import("@/lib/llms");
  out["llms-full"] = llmsFullTxt();
  return out;
}

afterEach(() => {
  vi.doUnmock("@/lib/launch");
  vi.resetModules();
});

describe("R12.1 – the last present-tense texts about the register", () => {
  it("gate: closed – no public page has the present-tense phrases; the four texts (verbatim)", async () => {
    const pages = await publicTexts();
    for (const [name, t] of Object.entries(pages)) expect(t, name).not.toMatch(PRESENT);
    expect(pages.page).toContain(CLOSED.compareIntro);
    expect(pages.page).toContain(`${FACTS.offline.summary} ${CLOSED.offlineFaq}`);
    expect(pages.guide).toContain(CLOSED.offlineNote);
    expect(pages["co-se-o-eet-pise-spatne/page"]).toContain(CLOSED.certificateComment);
    // ověřený návod: mění se jen čas slovesa, historie změn bez nového záznamu
    const { getGuide } = await import("@/content/guides");
    expect(getGuide("eet-bez-internetu")!.changelog?.[0]?.text).toBe("Návod prošel odbornou revizí (Helena Jeřábková).");
  });

  it("open (mock) – today's texts come back", async () => {
    vi.resetModules();
    vi.doMock("@/lib/launch", async (orig) => {
      const real = await orig<typeof import("@/lib/launch")>();
      return { ...real, isClosed: (p: string) => (p === "/pokladna" ? false : real.isClosed(p)) };
    });
    const { SERVICE_COPY } = await import("@/lib/site");
    expect(SERVICE_COPY).toMatchObject(OPEN);
    const pages = await publicTexts();
    expect(pages.page).toContain(OPEN.compareIntro);
    expect(pages.page).toContain(`${FACTS.offline.summary} ${OPEN.offlineFaq}`);
    expect(pages.guide).toContain(OPEN.offlineNote);
    expect(pages["co-se-o-eet-pise-spatne/page"]).toContain(OPEN.certificateComment);
  });

  it("gate: all four pairs live only in lib/site.ts", () => {
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
      if (PRESENT.test(src)) hits.push(`${f.slice(SRC.length + 1)}: present-tense phrase`);
    }
    expect(hits).toEqual([]);
  });
});
