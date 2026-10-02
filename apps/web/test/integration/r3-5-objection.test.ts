/**
 * R3.5 – námitka: u právnických osob se stránka vyřadí z indexace až po potvrzení e-mailu (DOI),
 * u fyzických osob hned; provozovatel dostává denní přehled, ne e-mail ke každé žádosti.
 */
import { getDb, schema } from "@ez/db";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE } from "@/lib/site";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
const { POST } = await import("@/app/api/namitka/route");
const confirmRoute = await import("@/app/api/namitka/potvrdit/route");
const { runObjectionDigest } = await import("@/lib/server/objections");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ipN = 0;
async function firm(ico: string, legalForm: string) {
  await getDb().insert(schema.firms).values({ ico, name: `Firma ${ico}`, slug: `firma-${ico}`, legalForm } as never);
}
const submit = (ico: string) =>
  POST(new Request("http://localhost/api/namitka", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.9.0.${++ipN}` }, body: JSON.stringify({ ico, name: "Jan Novák", email: "jan@example.cz", message: "Prosím o odstranění stránky." }) }));
const noindex = async (ico: string) => (await getDb().query.firms.findFirst({ where: eq(schema.firms.ico, ico) }))!.noindex;

describe("R3.5 – objections", () => {
  it("gate: a legal person's page is deindexed only after the e-mail is confirmed (POST)", async () => {
    await firm("27074358", "112"); // s.r.o.
    expect((await submit("27074358")).status).toBe(200);
    expect(await noindex("27074358")).toBe(false);
    const mail = (await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "jan@example.cz")))[0]!;
    const url = String((mail.payload as { url: string }).url);
    const token = new URL(url).searchParams.get("token")!;
    const res = await confirmRoute.POST(new Request("http://localhost/api/namitka/potvrdit", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }));
    expect(res.status).toBe(303);
    expect(await noindex("27074358")).toBe(true);
  });

  it("a natural person's page is deindexed immediately (privacy first)", async () => {
    await firm("12345679", "101"); // OSVČ
    await submit("12345679");
    expect(await noindex("12345679")).toBe(true);
  });

  it("the operator gets one daily digest instead of an e-mail per request", async () => {
    await firm("27074358", "112");
    await firm("12345679", "101");
    await submit("27074358");
    await submit("12345679");
    expect(await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, SITE.email))).toHaveLength(0);
    await runObjectionDigest(new Date("2026-10-03T07:00:00Z"));
    await runObjectionDigest(new Date("2026-10-03T08:00:00Z"));
    const digests = await getDb().select().from(schema.emailOutbox).where(like(schema.emailOutbox.dedupeKey, "objection-digest:%"));
    expect(digests).toHaveLength(1);
    expect(String((digests[0]!.payload as { text: string }).text)).toMatch(/27074358[\s\S]*12345679|12345679[\s\S]*27074358/);
  });
});
