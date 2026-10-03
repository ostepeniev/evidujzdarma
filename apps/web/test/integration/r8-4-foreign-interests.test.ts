/**
 * R8.4 (рецензія №5, B Д-2, Д-3) – zájem, který k adrese přidá někdo jiný, se neukáže ani nepotvrdí sám.
 *  - D2: stránka stavu potvrzené adresy ukazuje jen potvrzené zájmy (ne „pořadí na pokladnu“ za cizí žádostí);
 *  - D3: zájem z opakovaného vyplnění formuláře s nepotvrzenou adresou má vlastní token – DOI ho nepotvrdí; po DOI
 *    přijde e-mail s potvrzením té žádosti, teprve ten ji potvrdí (a u pokladny naplánuje app-ready).
 */
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { confirmPreregistration, confirmInterest, lookupPreregistration, statusTokenFor } = await import("@/lib/server/preregistration");
const { default: ConfirmPage } = await import("@/app/(site)/registrace/potvrzeni/page");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.84.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = (email: string) => getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) });
const mails = (to: string, template?: string) =>
  getDb()
    .select()
    .from(schema.emailOutbox)
    .where(template ? and(eq(schema.emailOutbox.to, to), eq(schema.emailOutbox.template, template)) : eq(schema.emailOutbox.to, to))
    .orderBy(schema.emailOutbox.createdAt);
const interests = async (id: string) =>
  (await getDb().select().from(schema.preregistrationInterests).where(eq(schema.preregistrationInterests.preregistrationId, id))).map((i) => ({ c: i.campaign, confirmed: !!i.confirmedAt })).sort((a, b) => a.c.localeCompare(b.c));
const tokenOf = (m: { payload: unknown }) => (m.payload as { confirmToken: string }).confirmToken;

describe("R8.4 – interests added by someone else", () => {
  it("gate D2: confirmed webinar-only address, a third party asks for the cash register → the status page shows no POS position", async () => {
    await post({ email: "d2@example.cz", interest: "webinar", utm: { utm_source: "ucetni" } });
    const [m] = await mails("d2@example.cz", "prereg-confirm");
    expect(await confirmPreregistration(tokenOf(m!))).toBe(true);
    await post({ email: "d2@example.cz" }); // třetí osoba z úvodní stránky (interest=pokladna)
    const row = (await rowOf("d2@example.cz"))!;
    expect(await lookupPreregistration(statusTokenFor(row.id))).toMatchObject({ confirmed: true, interests: ["webinar"] });
    const html = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({ token: statusTokenFor(row.id) }) } as never));
    expect(html).not.toMatch(/v pořadí na včasný přístup k pokladně/);
  });

  it("gate D3: unconfirmed webinar registrant, a third party submits the landing form → the owner's DOI confirms only the webinar", async () => {
    await post({ email: "d3@example.cz", interest: "webinar", utm: { utm_source: "ucetni" } });
    await post({ email: "d3@example.cz" }); // třetí osoba, interest=pokladna
    const doi = await mails("d3@example.cz", "prereg-confirm");
    // připomenutí DOI mluví o tom, co DOI potvrdí (webinář), ne o cizí žádosti
    expect((doi.at(-1)!.payload as { interest: string }).interest).toBe("webinar");
    expect(await confirmPreregistration(tokenOf(doi.at(-1)!))).toBe(true);
    const row = (await rowOf("d3@example.cz"))!;
    expect(await interests(row.id)).toEqual([
      { c: "pokladna", confirmed: false },
      { c: "webinar", confirmed: true },
    ]);
    expect(await mails("d3@example.cz", "app-ready")).toHaveLength(0);
    // po DOI přijde potvrzení cizí žádosti – teprve to ji potvrdí
    const ask = await mails("d3@example.cz", "interest-confirm");
    expect(ask).toHaveLength(1);
    expect(ask[0]!.payload).toMatchObject({ interest: "pokladna" });
    expect(await confirmInterest(tokenOf(ask[0]!))).toBe(true);
    expect(await mails("d3@example.cz", "app-ready")).toHaveLength(1);
  });

  it("the status page of an unconfirmed address shows only what its DOI confirms", async () => {
    await post({ email: "u@example.cz", interest: "webinar", utm: { utm_source: "ucetni" } });
    await post({ email: "u@example.cz" });
    const doi = await mails("u@example.cz", "prereg-confirm");
    expect(await lookupPreregistration(tokenOf(doi.at(-1)!))).toMatchObject({ confirmed: false, interests: ["webinar"] });
  });

  it("control: the first registration's interest is confirmed by the DOI and the cash register gets app-ready", async () => {
    await post({ email: "c@example.cz" });
    const [m] = await mails("c@example.cz", "prereg-confirm");
    expect(await confirmPreregistration(tokenOf(m!))).toBe(true);
    const row = (await rowOf("c@example.cz"))!;
    expect(await interests(row.id)).toEqual([{ c: "pokladna", confirmed: true }]);
    expect(await mails("c@example.cz", "app-ready")).toHaveLength(1);
    expect(await mails("c@example.cz", "interest-confirm")).toHaveLength(0);
  });
});
