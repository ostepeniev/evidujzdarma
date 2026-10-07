/**
 * R8.2 (рецензія №5, B В-1, Д-1, Д-6; rozhodnutí kontrolora – varianta b) – odhlášení z novinek je jiná věc než zrušení
 * předregistrace.
 *  - záznam se souhlasem: „Odhlásit jen novinky“ = odvolání souhlasu; předregistrace, pořadí, zájmy, app-ready a kód zůstávají;
 *  - „Zrušit předregistraci“ = záznam-blokace z R7.3, navíc bez confirm_token_issued_at a locale (Д-6);
 *  - one-click (RFC 8058): rozsah je v podepsaném odkazu – z obchodního sdělení jen souhlas, ze služebního e-mailu zrušení;
 *  - opakované odhlášení nic neposouvá (Д-1);
 *  - texty stránky, zásad a pravidel akce doslovně z recenze.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pageText } from "../helpers/render-text";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { GET: unsubscribeGet, POST: unsubscribePost } = await import("@/app/api/odhlasit/route");
const { runRetention } = await import("@/lib/server/lifecycle");
const { unsubscribeTokenFor, newsUnsubscribeTokenFor, confirmPreregistration, queueDisLaunch } = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const DAY = 86_400_000;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.82.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = (email: string) => getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) });
const mail = async (email: string, template: string) =>
  (await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.template, template))))[0];
const url = (token: string) => `http://localhost/api/odhlasit?token=${encodeURIComponent(token)}`;
const form = (token: string, action: string) =>
  unsubscribePost(new Request(url(token), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `action=${action}` }));
const oneClick = (token: string) =>
  unsubscribePost(new Request(url(token), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }));
const html = async (res: Response) => (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** Potvrzená předregistrace k pokladně (app-ready ve frontě); se souhlasem i s e-mailem dis-launch. */
async function confirmed(email: string, consent: boolean) {
  await post({ email, ico: "12345679", marketingConsent: consent, ref: "abcd1234" });
  const confirm = await mail(email, "prereg-confirm");
  expect(await confirmPreregistration((confirm!.payload as { confirmToken: string }).confirmToken)).toBe(true);
  if (consent) await queueDisLaunch();
  return (await rowOf(email))!;
}

describe("R8.2 – unsubscribing from news is not cancelling the pre-registration", () => {
  it("gate: with consent, 'Odhlásit jen novinky' withdraws the consent only – app-ready stays queued, the interest and the code stay", async () => {
    const row = await confirmed("fan@example.cz", true);
    const res = await form(unsubscribeTokenFor(row.id), "news");
    expect(await html(res)).toContain("Odhlášeno z novinek. Předregistrace zůstává.");
    const after = (await rowOf("fan@example.cz"))!;
    expect(after).toMatchObject({ marketingConsent: false, unsubscribedAt: null, referralCode: row.referralCode, referredBy: "abcd1234", ico: "12345679" });
    expect(after.confirmedAt).not.toBeNull();
    expect(after.marketingConsentWithdrawnAt).not.toBeNull();
    expect(after.consentEvidence).toMatch(/^souhlas:/);
    expect((await mail("fan@example.cz", "app-ready"))!.status).toBe("queued");
    expect((await mail("fan@example.cz", "dis-launch"))!.status).toBe("cancelled");
    const interests = await getDb().select().from(schema.preregistrationInterests).where(eq(schema.preregistrationInterests.preregistrationId, row.id));
    expect(interests.map((i) => i.campaign)).toEqual(["pokladna"]);
  });

  it("gate: 'Zrušit předregistraci' leaves the R7.3 block without confirm_token_issued_at and locale (Д-6)", async () => {
    const row = await confirmed("gone@example.cz", true);
    const res = await form(unsubscribeTokenFor(row.id), "all");
    expect(await html(res)).toContain("Předregistrace je zrušená. Už vám nic nepošleme.");
    const after = (await rowOf("gone@example.cz"))!;
    expect(after).toMatchObject({ ico: null, referredBy: null, utm: null, confirmTokenIssuedAt: null, locale: null, marketingConsent: false });
    expect(after.unsubscribedAt).not.toBeNull();
    expect(after.referralCode).not.toBe(row.referralCode);
    expect(after.marketingConsentWithdrawnAt).not.toBeNull();
    expect((await mail("gone@example.cz", "app-ready"))!.status).toBe("cancelled");
    expect(await getDb().select().from(schema.preregistrationInterests).where(eq(schema.preregistrationInterests.preregistrationId, row.id))).toHaveLength(0);
  });

  it("gate: one-click from a service e-mail cancels the pre-registration, from a marketing e-mail withdraws the consent only", async () => {
    const a = await confirmed("service@example.cz", true);
    // služební e-maily (prereg-confirm, app-ready) nesou odkaz se zrušením, obchodní sdělení (dis-launch) jen s novinkami
    expect((await mail("service@example.cz", "app-ready"))!.payload).toMatchObject({ unsubscribeToken: unsubscribeTokenFor(a.id) });
    expect((await mail("service@example.cz", "dis-launch"))!.payload).toMatchObject({ unsubscribeToken: newsUnsubscribeTokenFor(a.id) });
    expect((await oneClick(unsubscribeTokenFor(a.id))).status).toBe(204);
    expect((await rowOf("service@example.cz"))!.unsubscribedAt).not.toBeNull();

    const b = await confirmed("market@example.cz", true);
    expect((await oneClick(newsUnsubscribeTokenFor(b.id))).status).toBe(204);
    const after = (await rowOf("market@example.cz"))!;
    expect(after).toMatchObject({ marketingConsent: false, unsubscribedAt: null, referralCode: b.referralCode });
    expect((await mail("market@example.cz", "app-ready"))!.status).toBe("queued");
  });

  it("gate Д-1: a second POST changes neither unsubscribedAt nor the withdrawal date", async () => {
    const a = await confirmed("twice@example.cz", false);
    await form(unsubscribeTokenFor(a.id), "all");
    const first = (await rowOf("twice@example.cz"))!.unsubscribedAt!;
    await new Promise((r) => setTimeout(r, 15));
    const res = await oneClick(unsubscribeTokenFor(a.id));
    expect(res.status).toBe(204);
    expect((await rowOf("twice@example.cz"))!.unsubscribedAt!.getTime()).toBe(first.getTime());

    const b = await confirmed("twice-news@example.cz", true);
    await oneClick(newsUnsubscribeTokenFor(b.id));
    const withdrawn = (await rowOf("twice-news@example.cz"))!.marketingConsentWithdrawnAt!;
    await new Promise((r) => setTimeout(r, 15));
    await form(newsUnsubscribeTokenFor(b.id), "news");
    expect((await rowOf("twice-news@example.cz"))!.marketingConsentWithdrawnAt!.getTime()).toBe(withdrawn.getTime());
  });

  it("gate: the page for a record without consent says that unsubscribing cancels the pre-registration (verbatim)", async () => {
    const a = await confirmed("plain@example.cz", false);
    const text = await html(await unsubscribeGet(new Request(url(unsubscribeTokenFor(a.id)))));
    expect(text).toContain("Odhlášení z e-mailů");
    expect(text).toContain(
      "Posíláme vám jen e-maily k vaší předregistraci. Odhlášením ji zrušíte: přijdete o pořadí na včasný přístup, odkaz pro pozvání kolegů a přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali.",
    );
    expect(text).toContain("Zrušit předregistraci");
    expect(text).not.toContain("Odhlásit jen novinky");
    // GET nic nemění (Р5)
    expect((await rowOf("plain@example.cz"))!.unsubscribedAt).toBeNull();
  });

  it("gate: the page for a record with consent offers both (verbatim)", async () => {
    const a = await confirmed("both@example.cz", true);
    const text = await html(await unsubscribeGet(new Request(url(newsUnsubscribeTokenFor(a.id)))));
    expect(text).toContain("Odhlášení z e-mailů");
    expect(text).toContain("Můžete se odhlásit jen z novinek k EET, nebo zrušit celou předregistraci.");
    expect(text).toContain("Odhlásit jen novinky");
    expect(text).toContain("Předregistrace zůstane: pošleme vám odkaz, až pokladnu spustíme.");
    expect(text).toContain("Zrušit předregistraci");
    expect(text).toContain(
      "Přijdete o pořadí na včasný přístup, odkaz pro pozvání kolegů a přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali.",
    );
    expect((await rowOf("both@example.cz"))!.marketingConsent).toBe(true);
  });

  it("the consent proof outlives the pre-registration term: at the end it is minimised, not deleted, until 3 years after withdrawal", async () => {
    const a = await confirmed("proof@example.cz", true);
    await form(unsubscribeTokenFor(a.id), "news");
    // konec lhůty předregistrace (spuštění + 12 měsíců), souhlas odvolán před méně než 3 lety
    await runRetention(new Date("2028-01-15T10:00:00Z"));
    const kept = (await rowOf("proof@example.cz"))!;
    expect(kept).toMatchObject({ ico: null, referredBy: null, utm: null, confirmTokenIssuedAt: null, locale: null });
    expect(kept.consentEvidence).toMatch(/^souhlas:/);
    expect(kept.marketingConsentWithdrawnAt).not.toBeNull();
    await runRetention(new Date(Date.now() + 3 * 366 * DAY));
    expect(await rowOf("proof@example.cz")).toBeUndefined();
  });

  it("gate: privacy policy, referral rules and the version (verbatim)", async () => {
    const { default: Zasady } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const zasady = pageText(Zasady);
    expect(zasady).toContain(
      // „Odhlásit odběr“ – název odkazu v e-mailu (R9.12)
      "Zrušíte-li předregistraci (odkazem „Odhlásit odběr“ v e-mailu), ostatní údaje smažeme a ponecháme si jen e-mail, datum předregistrace a datum zrušení, abychom vám už nic neposílali (3 roky).",
    );
    expect(zasady).toContain(
      "Do odvolání souhlasu. Doklad o souhlasu a jeho odvolání (e-mail, datum a verzi textu souhlasu) uchováváme ještě 3 roky po odvolání pro případ sporu. Předregistrace po odvolání souhlasu trvá dál podle předchozího řádku.",
    );
    expect(zasady).not.toContain("Odhlásíte-li se z našich e-mailů");
    const rules = readFileSync(new URL("../../src/app/(site)/pravidla-doporuceni/page.tsx", import.meta.url), "utf8");
    expect(rules).toContain("b) má jiné IČO než doporučující a v EvidujZdarma dosud předregistrovaný nebyl,");
    expect(rules).toContain("c) do 31. 3. 2027 začne v EvidujZdarma evidovat tržby v ostrém režimu, tedy odešle Finanční správě alespoň jednu tržbu, a");
    expect(rules).toContain("d) předregistraci mezitím nezruší.");
    const { PRIVACY_VERSION, REFERRAL_RULES_VERSION_LABEL } = await import("@/lib/legal");
    expect(PRIVACY_VERSION).toBe("2026-10-07-r9");
    expect(REFERRAL_RULES_VERSION_LABEL).toBe("7. 10. 2026");
  });

  it("migration 0032: existing blocks lose confirm_token_issued_at and locale; earlier consent withdrawals get their date", async () => {
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    const at = new Date("2026-10-01T10:00:00Z");
    await db.insert(schema.preregistrations).values([
      { email: "blk@example.cz", referralCode: "blkcode1", confirmTokenHash: "a".repeat(64), unsubscribedAt: at },
      { email: "blkfan@example.cz", referralCode: "blkcode2", confirmTokenHash: "b".repeat(64), marketingConsentAt: at, consentEvidence: "souhlas:2026-09-20", unsubscribedAt: at },
      { email: "live@example.cz", referralCode: "livecode", confirmTokenHash: "c".repeat(64) },
    ]);
    const file = readFileSync(new URL("../../../../packages/db/migrations/0032_prereg_block_minimise.sql", import.meta.url), "utf8");
    for (const stmt of file.split("--> statement-breakpoint")) if (stmt.trim()) await db.execute(sql.raw(stmt));
    expect(await rowOf("blk@example.cz")).toMatchObject({ confirmTokenIssuedAt: null, locale: null, marketingConsentWithdrawnAt: null });
    expect((await rowOf("blkfan@example.cz"))!.marketingConsentWithdrawnAt!.getTime()).toBe(at.getTime());
    expect(await rowOf("live@example.cz")).toMatchObject({ locale: "cs" });
    expect((await rowOf("live@example.cz"))!.confirmTokenIssuedAt).not.toBeNull();
  });
});
