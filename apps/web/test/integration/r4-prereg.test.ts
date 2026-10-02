/**
 * R4 – předregistrace (B r1 Дрібне 8–11).
 *  - 8: honeypot mlčí (bot dostane stejnou odpověď jako člověk, nic se neuloží); UTM jen 5 klíčů utm_*.
 *  - 9: tokeny v DB jen jako hash; potvrzovací odkaz neplatí věčně (30 dní, dokud není potvrzeno).
 *  - 10: doklad souhlasu = verze textu souhlasu a čas (DOI), ne hash IP + UA.
 *  - 11: odpověď neprozradí, že e-mail už je registrovaný.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const unsubscribeRoute = await import("@/app/api/odhlasit/route");
const prereg = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.9.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = (email: string) => getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) });
const outbox = (email: string) => getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));

describe("Дрібне 8 – honeypot and UTM", () => {
  it("gate: a filled honeypot gets the normal success answer and nothing is stored", async () => {
    const res = await post({ email: "bot@example.cz", website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await rowOf("bot@example.cz")).toBeUndefined();
  });

  it("gate: only the five utm_* keys are kept", async () => {
    const utm = Object.fromEntries([...Array.from({ length: 200 }, (_, i) => [`k${i}`, "x"]), ["utm_source", "fb"], ["utm_campaign", "jaro"]]);
    expect((await post({ email: "utm@example.cz", utm })).status).toBe(200);
    expect((await rowOf("utm@example.cz"))!.utm).toEqual({ utm_source: "fb", utm_campaign: "jaro" });
  });
});

describe("Дрібне 11 – no enumeration", () => {
  it("gate: a new and an already registered e-mail get the same answer", async () => {
    const a = await (await post({ email: "same@example.cz" })).json();
    const b = await (await post({ email: "same@example.cz" })).json();
    expect(b).toEqual(a);
    expect(a).toEqual({ ok: true });
    // druhá žádost poslala nový potvrzovací odkaz (nepotvrzený e-mail)
    expect((await outbox("same@example.cz")).map((m) => m.template)).toEqual(["prereg-confirm", "prereg-confirm"]);
  });
});

describe("Дрібне 9 – tokens are stored hashed, the confirmation link expires", () => {
  it("gate: the database holds no usable token; the e-mailed one confirms", async () => {
    await post({ email: "hash@example.cz", marketingConsent: true });
    const [mail] = await outbox("hash@example.cz");
    const token = String((mail!.payload as { confirmToken: string }).confirmToken);
    const raw = (await t.pg.query("select * from preregistrations where email = $1", ["hash@example.cz"])).rows[0] as Record<string, unknown>;
    expect(Object.values(raw).map(String)).not.toContain(token);
    expect("confirm_token" in raw).toBe(false);
    expect("unsubscribe_token" in raw).toBe(false);
    expect(await prereg.confirmPreregistration(token)).toBe(true);
  });

  it("gate: an unconfirmed link older than 30 days no longer works; a confirmed one keeps showing the status", async () => {
    await post({ email: "old@example.cz" });
    const token = String(((await outbox("old@example.cz"))[0]!.payload as { confirmToken: string }).confirmToken);
    await getDb().update(schema.preregistrations).set({ confirmTokenIssuedAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(schema.preregistrations.email, "old@example.cz"));
    expect(await prereg.lookupPreregistration(token)).toBeNull();
    expect(await prereg.confirmPreregistration(token)).toBe(false);

    await post({ email: "ok@example.cz" });
    const t2 = String(((await outbox("ok@example.cz"))[0]!.payload as { confirmToken: string }).confirmToken);
    expect(await prereg.confirmPreregistration(t2)).toBe(true);
    await getDb().update(schema.preregistrations).set({ confirmTokenIssuedAt: new Date(Date.now() - 400 * 86_400_000) }).where(eq(schema.preregistrations.email, "ok@example.cz"));
    expect((await prereg.lookupPreregistration(t2))!.confirmed).toBe(true);
  });

  it("the unsubscribe link from the e-mail works without a stored token", async () => {
    await post({ email: "unsub@example.cz", marketingConsent: true });
    const token = String(((await outbox("unsub@example.cz"))[0]!.payload as { unsubscribeToken: string }).unsubscribeToken);
    const res = await unsubscribeRoute.POST(new Request(`http://localhost/api/odhlasit?token=${encodeURIComponent(token)}`, { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(res.status).toBe(204);
    expect((await rowOf("unsub@example.cz"))!.unsubscribedAt).not.toBeNull();
    // podvržený podpis neodhlásí nikoho
    const forged = token.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect((await unsubscribeRoute.POST(new Request(`http://localhost/api/odhlasit?token=${encodeURIComponent(forged)}`, { method: "POST", body: "List-Unsubscribe=One-Click" }))).status).toBe(404);
  });
});

describe("Дрібне 10 – consent evidence", () => {
  it("gate: the evidence is the consent text version, not a hash of IP and browser", async () => {
    await post({ email: "consent@example.cz", marketingConsent: true });
    const row = (await rowOf("consent@example.cz"))!;
    expect(row.consentEvidence).toMatch(/^souhlas:/);
    await post({ email: "noconsent@example.cz" });
    expect((await rowOf("noconsent@example.cz"))!.consentEvidence).toBeNull();
  });
});

describe("Дрібне 9 – migration backfill", () => {
  it("the SQL hash in migration 0021 equals the app's sha256, so links from sent e-mails keep working", async () => {
    const { sha256 } = await import("@/lib/server/tokens");
    const token = "Ab_-0123456789xyzXYZ_legacy";
    const { rows } = await t.pg.query<{ h: string }>("select encode(sha256(convert_to($1, 'UTF8')), 'hex') as h", [token]);
    expect(rows[0]!.h).toBe(sha256(token));
    // starý odhlašovací odkaz (náhodný token, v DB po migraci jen jeho hash) dál odhlásí
    await getDb().insert(schema.preregistrations).values({ email: "legacy@example.cz", referralCode: "legacy01", confirmTokenHash: sha256("c".repeat(30)), unsubscribeTokenHash: rows[0]!.h, marketingConsent: true });
    const res = await unsubscribeRoute.POST(new Request(`http://localhost/api/odhlasit?token=${token}`, { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(res.status).toBe(204);
  });
});
