/**
 * R9.3 (рецензія №6, A3) – předregistrace zmenšená retention na doklad o odvolaném souhlasu (bez confirm_token_issued_at,
 * bez odhlášení, ale s confirmed_at) vypadala jako živá: fungovala stránka stavu, app-ready, připomenutí „už potvrzeno“ a
 * „Zrušit“ z ní dělal novou 3letou blokaci. Nově je doklad pro formulář, odkazy i e-maily neexistující adresa:
 * lookupPreregistration → null, odhlašovací odkaz neplatí, app-ready se neodešle, nový formulář založí běžnou předregistraci
 * (unikátní index na e-mail doklad nezahrnuje).
 */
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
// pokladna „spuštěná“, aby app-ready rozhodoval jen záznam předregistrace (blockedReason), ne NOT_LAUNCHED
vi.mock("@/lib/launch", async (orig) => {
  const real = await orig<typeof import("@/lib/launch")>();
  return { ...real, isClosed: (p: string) => (p === "/pokladna" ? false : real.isClosed(p)) };
});

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { GET: unsubscribeGet, POST: unsubscribePost } = await import("@/app/api/odhlasit/route");
const { runRetention } = await import("@/lib/server/lifecycle");
const { enqueueEmail, processOutbox } = await import("@/lib/server/mail");
const { confirmPreregistration, lookupPreregistration, statusTokenFor, unsubscribeTokenFor } = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const EMAIL = "proof@example.cz";
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.93.0.${++ip}` }, body: JSON.stringify(body) }));
const rows = () => getDb().select().from(schema.preregistrations).where(eq(schema.preregistrations.email, EMAIL));
const mails = (template: string) => getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, EMAIL), eq(schema.emailOutbox.template, template)));
const url = (token: string) => `http://localhost/api/odhlasit?token=${encodeURIComponent(token)}`;

/** Potvrzená předregistrace k pokladně se souhlasem → „Odhlásit jen novinky“ → konec lhůty (spuštění + 12 m.) → doklad. */
async function consentProof() {
  await post({ email: EMAIL, marketingConsent: true });
  const [confirm] = await mails("prereg-confirm");
  expect(await confirmPreregistration((confirm!.payload as { confirmToken: string }).confirmToken)).toBe(true);
  const [live] = await rows();
  await unsubscribePost(new Request(url(unsubscribeTokenFor(live!.id)), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "action=news" }));
  // app-ready z potvrzení necháme odejít „před“ zmenšením, ať ve frontě nic nezůstane
  await getDb().delete(schema.emailOutbox);
  await runRetention(new Date("2028-01-15T10:00:00Z"));
  const [proof] = await rows();
  expect(proof).toMatchObject({ id: live!.id, confirmTokenIssuedAt: null, unsubscribedAt: null, marketingConsent: false });
  expect(proof!.confirmedAt).not.toBeNull();
  return proof!;
}

describe("R9.3 – a minimised consent proof is not a live pre-registration", () => {
  it("gate: lookupPreregistration → null (status page shows nothing)", async () => {
    const proof = await consentProof();
    expect(await lookupPreregistration(statusTokenFor(proof.id))).toBeNull();
  });

  it("gate: the unsubscribe link of a proof is invalid – no new 3-year block", async () => {
    const proof = await consentProof();
    const page = await (await unsubscribeGet(new Request(url(unsubscribeTokenFor(proof.id))))).text();
    expect(page).toContain("Odkaz je neplatný");
    const oneClick = await unsubscribePost(new Request(url(unsubscribeTokenFor(proof.id)), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }));
    expect(oneClick.status).toBe(404);
    const form = await unsubscribePost(new Request(url(unsubscribeTokenFor(proof.id)), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "action=all" }));
    expect(await form.text()).toContain("Odkaz je neplatný");
    const [after] = await rows();
    expect(after).toMatchObject({ unsubscribedAt: null, confirmTokenIssuedAt: null });
  });

  it("gate: app-ready for the proof's address is not sent (blockedReason ignores the proof)", async () => {
    await consentProof();
    await enqueueEmail({ to: EMAIL, template: "app-ready", payload: {}, dedupeKey: "app-ready:stale" });
    await processOutbox(10);
    const [m] = await mails("app-ready");
    expect(m).toMatchObject({ status: "cancelled", lastError: "UNCONFIRMED" });
  });

  it("gate: the form treats the address as new – an ordinary pre-registration with DOI; the proof stays intact", async () => {
    const proof = await consentProof();
    const res = await post({ email: EMAIL, interest: "pokladna" });
    expect(res.status).toBe(200);
    const all = await rows();
    expect(all).toHaveLength(2);
    const fresh = all.find((r) => r.id !== proof.id)!;
    expect(fresh).toMatchObject({ confirmedAt: null, unsubscribedAt: null, marketingConsent: false });
    expect(fresh.confirmTokenIssuedAt).not.toBeNull();
    expect(all.find((r) => r.id === proof.id)).toEqual(proof);
    // nový potvrzovací e-mail (ne připomenutí „už potvrzeno“), žádný zájem ani app-ready k dokladu
    const confirms = await mails("prereg-confirm");
    expect(confirms.map((m) => m.dedupeKey)).toEqual([`prereg-confirm:${fresh.id}`]);
    expect((confirms[0]!.payload as { alreadyConfirmed?: boolean }).alreadyConfirmed).toBeUndefined();
    expect(await getDb().select().from(schema.preregistrationInterests).where(eq(schema.preregistrationInterests.preregistrationId, proof.id))).toEqual([]);
    expect(await confirmPreregistration((confirms[0]!.payload as { confirmToken: string }).confirmToken)).toBe(true);
    expect((await mails("app-ready")).map((m) => m.dedupeKey)).toEqual([`app-ready:${fresh.id}`]);
    // další vyplnění už narazí na novou předregistraci (připomenutí), ne na doklad
    await post({ email: EMAIL, interest: "pokladna" });
    expect(await rows()).toHaveLength(2);
    expect((await lookupPreregistration(statusTokenFor(fresh.id)))?.confirmed).toBe(true);
  });

  it("a cancelled pre-registration (block) still blocks the address – the partial index keeps blocks unique", async () => {
    await post({ email: EMAIL });
    const [live] = await rows();
    await unsubscribePost(new Request(url(unsubscribeTokenFor(live!.id)), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "action=all" }));
    await post({ email: EMAIL });
    expect(await rows()).toHaveLength(1);
  });
});
