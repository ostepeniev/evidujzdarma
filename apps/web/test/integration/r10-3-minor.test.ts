/**
 * R10.3 (рецензія №7, A):
 *  - M1: llms-full.txt – „Aktualizováno“ z guideModified(g) (poslední záznam historie), ne z g.updated;
 *  - M3: doklad o odvolaném souhlasu se smaže 3 roky po odvolání bez ohledu na termOver – dřív zůstal navždy, když si
 *    člověk mezitím založil účet (termOver vyžaduje „bez účtu“);
 *  - og:image: gate na sloučenou metadatu (accumulateMetadata z Next, jako při renderu) – /cenik a návod mají og:image.
 */
import { createRequire } from "node:module";
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GUIDES, getGuide, guideModified } from "@/content/guides";
import { guideMetadata } from "@/lib/guide-page";
import { absoluteUrl } from "@/lib/site";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const YEAR = 365 * 86_400_000;

describe("R10.3 M1 – llms-full shows the date of the last change", () => {
  it("gate: every indexable guide in llms-full.txt carries guideModified(g)", async () => {
    const { llmsFullTxt } = await import("@/lib/llms");
    const full = llmsFullTxt();
    const differs = GUIDES.filter((g) => full.includes(`/navody/${g.slug} ·`) && guideModified(g) !== g.updated);
    expect(differs.length).toBeGreaterThan(0);
    for (const g of differs) {
      expect(full, g.slug).toContain(`${absoluteUrl(`/navody/${g.slug}`)} · Aktualizováno: ${guideModified(g)}`);
      expect(full, g.slug).not.toContain(`${absoluteUrl(`/navody/${g.slug}`)} · Aktualizováno: ${g.updated}`);
    }
  });
});

describe("R10.3 M3 – the consent proof is deleted 3 years after withdrawal, account or not", () => {
  it("gate: proof of a person who later created an account disappears after 3 years; a live pre-registration and a block stay", async () => {
    const { POST: preregister } = await import("@/app/api/preregistrace/route");
    const { POST: unsubscribePost } = await import("@/app/api/odhlasit/route");
    const { runRetention } = await import("@/lib/server/lifecycle");
    const { confirmPreregistration, unsubscribeTokenFor } = await import("@/lib/server/preregistration");
    const email = "proof-account@example.cz";
    await preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.103.0.1" }, body: JSON.stringify({ email, marketingConsent: true }) }));
    const [m] = await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.template, "prereg-confirm")));
    expect(await confirmPreregistration((m!.payload as { confirmToken: string }).confirmToken)).toBe(true);
    const [live] = await getDb().select().from(schema.preregistrations).where(eq(schema.preregistrations.email, email));
    await unsubscribePost(new Request(`http://localhost/api/odhlasit?token=${encodeURIComponent(unsubscribeTokenFor(live!.id))}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "action=news" }));
    await runRetention(new Date("2028-01-15T10:00:00Z"));
    const [proof] = await getDb().select().from(schema.preregistrations).where(eq(schema.preregistrations.email, email));
    expect(proof).toMatchObject({ confirmTokenIssuedAt: null, unsubscribedAt: null });
    // člověk si potom založí účet → termOver (bez účtu) už neplatí
    await getDb().insert(schema.users).values({ email });

    const withdrawnAt = proof!.marketingConsentWithdrawnAt!;
    await runRetention(new Date(withdrawnAt.getTime() + 3 * YEAR - 86_400_000));
    expect(await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.id, proof!.id) }), "before 3 years").toBeTruthy();

    // živá předregistrace (se souhlasem, potvrzená) a čerstvá blokace jiných adres – starý doklad o odvolání mají, ale
    // pravidlo pro zmenšený doklad se jich nesmí dotknout (ostatní pravidla retention je tu nemažou)
    const at = new Date(withdrawnAt.getTime() + 3 * YEAR + 2 * 86_400_000);
    const other = "other-live@example.cz";
    await getDb()
      .insert(schema.preregistrations)
      .values({ email: other, referralCode: "r103live", confirmTokenHash: "x".repeat(64), confirmTokenIssuedAt: new Date(), confirmedAt: new Date(), marketingConsent: true, marketingConsentWithdrawnAt: new Date("2020-01-01") });
    await getDb()
      .insert(schema.preregistrations)
      .values({ email: "blocked@example.cz", referralCode: "r103blok", confirmTokenHash: "y".repeat(64), confirmTokenIssuedAt: null, unsubscribedAt: new Date(at.getTime() - 86_400_000), marketingConsentWithdrawnAt: new Date("2020-01-01") });

    const out = await runRetention(at);
    expect(await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.id, proof!.id) }), "after 3 years").toBeUndefined();
    expect(out.consentProofs).toBe(1);
    expect(await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, other) })).toBeTruthy();
    expect(await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, "blocked@example.cz") })).toBeTruthy();
  });
});

describe("R10.3 – og:image in the merged metadata (as Next renders it)", () => {
  /** Sloučení vrstev root layout → (site) layout → stránka funkcí accumulateMetadata z Next; obrázek z app/opengraph-image.tsx je jen u kořene. */
  async function merged(page: Metadata, pathname: string) {
    const req = createRequire(import.meta.url);
    const path = req.resolve("next/dist/lib/metadata/resolve-metadata.js");
    const fromNext = createRequire(path);
    const so = fromNext.resolve("server-only");
    fromNext.cache[so] = { id: so, filename: so, loaded: true, exports: {} } as never;
    const { accumulateMetadata } = fromNext(path) as { accumulateMetadata: (...a: unknown[]) => Promise<Metadata & { openGraph: { images?: { url: string }[]; url?: string } }> };
    const root = (await import("@/app/layout")).metadata;
    const fileImage = [{ url: "/opengraph-image?f1le", width: 1200, height: 630, type: "image/png", alt: "EvidujZdarma" }];
    return accumulateMetadata(pathname, [[root, { openGraph: fileImage, twitter: fileImage }], [null, null], [page, null]], Promise.resolve(pathname), { trailingSlash: false, isStaticMetadataRouteFile: false });
  }

  it.each([
    ["/cenik", async () => (await import("@/app/(site)/cenik/page")).metadata],
    ["/navody/kontaktni-platba", async () => guideMetadata(getGuide("kontaktni-platba")!)],
  ] as [string, () => Promise<Metadata>][])("gate: %s – og:image present, og:url = the page", async (pathname, load) => {
    const r = await merged(await load(), pathname);
    expect(r.openGraph.images?.map((i) => i.url)).toEqual([absoluteUrl("/opengraph-image")]);
    expect(String(r.openGraph.url)).toBe(absoluteUrl(pathname));
  });

  it("control: a page openGraph without images loses the file image – what the gate guards against", async () => {
    const r = await merged({ openGraph: { title: "x", url: "/x" } }, "/x");
    expect(r.openGraph.images ?? []).toEqual([]);
  });
});
