/**
 * Рецензія №6 (B):
 *  - R9.7 (B-I1) – „Odhlásit jen novinky“ slibovalo odkaz na pokladnu i tam, kde nepřijde (jen webinář/kabinet, nepotvrzený
 *    záznam, app-ready už odešel). Text podle stavu: A = app-ready ve frontě, B = potvrzené zájmy (mimo pokladnu – ta má
 *    slib jen s A), C = nic z toho.
 *  - R9.8 (B-I2) – formuláře neslibují, že kdo se odhlásil jen z novinek, e-mail nedostane.
 *  - R9.9 (B-M1) – záznam bez pokladny (jen webinář/kabinet) nepřijde o pořadí ani o odkaz pro pozvání – ty stránka stavu
 *    ukazuje jen předregistraci k pokladně (forPos).
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { GET: unsubscribeGet } = await import("@/app/api/odhlasit/route");
const { confirmPreregistration, newsUnsubscribeTokenFor, unsubscribeTokenFor } = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.97.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = async (email: string) => (await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) }))!;
const mail = async (email: string, template: string) =>
  (await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.template, template))))[0];
const page = async (token: string) =>
  (await (await unsubscribeGet(new Request(`http://localhost/api/odhlasit?token=${encodeURIComponent(token)}`))).text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

async function registered(email: string, interest: string, consent: boolean, confirm = true) {
  await post({ email, interest, marketingConsent: consent });
  if (confirm) {
    const m = await mail(email, "prereg-confirm");
    expect(await confirmPreregistration((m!.payload as { confirmToken: string }).confirmToken)).toBe(true);
  }
  return rowOf(email);
}

/** Další zájem už potvrzené adresy, potvrzený vlastním odkazem (R7.4). */
async function addInterest(email: string, interest: string) {
  const { confirmInterest } = await import("@/lib/server/preregistration");
  await post({ email, interest });
  const all = await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.template, "interest-confirm")));
  const m = all.find((x) => (x.payload as { interest: string }).interest === interest);
  expect(await confirmInterest((m!.payload as { confirmToken: string }).confirmToken)).toBe(true);
}

const A = "Předregistrace zůstane: pošleme vám odkaz, až pokladnu spustíme.";
const C = "Předregistrace zůstane. Dál vám pošleme jen e-maily, které se jí týkají.";
const ALL_POS = "Přijdete o pořadí na včasný přístup, odkaz pro pozvání kolegů a přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali.";
const ALL_OTHER = "Přijdete o přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali.";

describe("R9.7 – 'Odhlásit jen novinky' promises only what will come", () => {
  it("gate: A – app-ready queued → the link to the cash register", async () => {
    const row = await registered("a@example.cz", "pokladna", true);
    expect(await mail("a@example.cz", "app-ready")).toMatchObject({ status: "queued", dedupeKey: `app-ready:${row.id}` });
    const text = await page(newsUnsubscribeTokenFor(row.id));
    expect(text).toContain(A);
    expect(text).not.toContain(C);
  });

  it("gate: B – no app-ready, confirmed webinar → INTEREST_NEXT of the webinar", async () => {
    const row = await registered("b@example.cz", "webinar", true);
    expect(await mail("b@example.cz", "app-ready")).toBeUndefined();
    const text = await page(newsUnsubscribeTokenFor(row.id));
    expect(text).toContain("Předregistrace zůstane. Termín a odkaz na webinář vám pošleme, jakmile ho vypíšeme.");
    expect(text).not.toContain(A);
  });

  it("gate: C – app-ready already sent, nothing else confirmed → no promise", async () => {
    const row = await registered("c@example.cz", "pokladna", true);
    await getDb().update(schema.emailOutbox).set({ status: "sent", sentAt: new Date() }).where(eq(schema.emailOutbox.dedupeKey, `app-ready:${row.id}`));
    const text = await page(newsUnsubscribeTokenFor(row.id));
    expect(text).toContain(C);
    expect(text).not.toContain(A);
    expect(text).not.toContain("Až pokladnu spustíme");
  });

  it("B lists the confirmed non-cash-register interests in their order; the cash register needs A", async () => {
    const row = await registered("bk@example.cz", "pokladna", true);
    await getDb().update(schema.emailOutbox).set({ status: "sent", sentAt: new Date() }).where(eq(schema.emailOutbox.dedupeKey, `app-ready:${row.id}`));
    await addInterest("bk@example.cz", "kabinet");
    await addInterest("bk@example.cz", "webinar");
    const text = await page(newsUnsubscribeTokenFor(row.id));
    expect(text).toContain("Předregistrace zůstane. Termín a odkaz na webinář vám pošleme, jakmile ho vypíšeme. O spuštění Účetního kabinetu vám dáme vědět.");
  });

  it("an unconfirmed record (consent, webinar) gets C – nothing is confirmed yet", async () => {
    const row = await registered("u@example.cz", "webinar", true, false);
    expect(await page(newsUnsubscribeTokenFor(row.id))).toContain(C);
  });
});

describe("R9.9 – cancelling a record without the cash register", () => {
  it("gate: with consent, webinar only → 'Přijdete o přihlášky (webinář, kabinet)…'; the cash-register record keeps the old text", async () => {
    const other = await registered("wc@example.cz", "webinar", true);
    const t1 = await page(unsubscribeTokenFor(other.id));
    expect(t1).toContain(ALL_OTHER);
    expect(t1).not.toContain("pořadí na včasný přístup");
    const pos = await registered("pc@example.cz", "pokladna", true);
    expect(await page(unsubscribeTokenFor(pos.id))).toContain(ALL_POS);
  });

  it("gate: without consent, kabinet only → 'Odhlášením ji zrušíte i s přihláškami…'", async () => {
    const other = await registered("kn@example.cz", "kabinet", false);
    const text = await page(unsubscribeTokenFor(other.id));
    expect(text).toContain(
      "Posíláme vám jen e-maily k vaší předregistraci. Odhlášením ji zrušíte i s přihláškami (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali.",
    );
    expect(text).not.toContain("pořadí na včasný přístup");
  });
});

describe("R9.8 – the forms do not promise silence to news-only unsubscribers", () => {
  it("gate: prereg-form and webinar-form (verbatim)", () => {
    const NEW = "Pokud jste dříve předregistraci zrušili, e-mail vám nepřijde – napište nám na {SITE.email}.";
    for (const f of ["components/prereg-form.tsx", "components/accountant/webinar-form.tsx"]) {
      const src = readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
      expect(src, f).toContain(NEW);
      expect(src, f).not.toContain("z našich e-mailů odhlásili");
    }
  });
});
