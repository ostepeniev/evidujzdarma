/**
 * R7.3 (рецензія №4, B N3, Z1) – odhlášení nesmí prodloužit uchování předregistrace z 90 dnů na 3 roky.
 *  - bez souhlasu: zůstane jen adresa a datum odhlášení (záznam, že jí nic neposíláme), ostatní se smaže;
 *  - se souhlasem: zůstane jen doklad souhlasu a odvolání (e-mail, consentEvidence, marketingConsentAt, confirmedAt, unsubscribedAt).
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const INDUSTRY = (await import("@/content/industries")).INDUSTRY_SLUGS[0];
const { POST: unsubscribePost } = await import("@/app/api/odhlasit/route");
const { runRetention } = await import("@/lib/server/lifecycle");
const { unsubscribeTokenFor, confirmPreregistration } = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const DAY = 86_400_000;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.7.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = (email: string) => getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) });
const unsubscribe = async (id: string) =>
  unsubscribePost(new Request(`http://localhost/api/odhlasit?token=${encodeURIComponent(unsubscribeTokenFor(id))}`, { method: "POST", body: "confirm=1" }));

describe("R7.3 – unsubscribing keeps only what blocks further e-mails (and the consent proof)", () => {
  it("gate: unconfirmed pre-registration without consent → only e-mail and unsubscribedAt remain (also after 120 days)", async () => {
    await post({ email: "victim@example.cz", ico: "12345679", industry: INDUSTRY, establishments: 2, needs: ["terminal"], utm: { utm_source: "fb" }, ref: "abcd1234" });
    const row = (await rowOf("victim@example.cz"))!;
    expect(row).toMatchObject({ ico: "12345679", referredBy: "abcd1234" });
    expect((await unsubscribe(row.id)).status).toBe(200);
    await runRetention(new Date(Date.now() + 120 * DAY));
    const after = await rowOf("victim@example.cz");
    if (after) {
      expect(after).toMatchObject({ ico: null, companyName: null, industry: null, establishmentsCount: null, needs: [], utm: null, referredBy: null, confirmedAt: null, consentEvidence: null, marketingConsentAt: null });
      expect(after.unsubscribedAt).not.toBeNull();
    }
  });

  it("gate: with consent → the consent proof stays, the rest is cleared", async () => {
    await post({ email: "fan@example.cz", ico: "12345679", marketingConsent: true, utm: { utm_source: "fb" } });
    const [mail] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "fan@example.cz"));
    expect(await confirmPreregistration((mail!.payload as { confirmToken: string }).confirmToken)).toBe(true);
    const row = (await rowOf("fan@example.cz"))!;
    await unsubscribe(row.id);
    const after = (await rowOf("fan@example.cz"))!;
    expect(after).toMatchObject({ ico: null, companyName: null, utm: null, marketingConsent: false });
    expect(after.consentEvidence).toMatch(/^souhlas:/);
    expect(after.marketingConsentAt).not.toBeNull();
    expect(after.confirmedAt).not.toBeNull();
    expect(after.unsubscribedAt).not.toBeNull();
  });

  it("gate: the privacy policy says so (verbatim from the review)", () => {
    const src = readFileSync(new URL("../../src/app/(site)/ochrana-osobnich-udaju/page.tsx", import.meta.url), "utf8");
    expect(src).toContain(
      "Odhlásíte-li se z našich e-mailů, ostatní údaje z předregistrace smažeme a ponecháme si jen e-mail a datum odhlášení, abychom vám už nic neposílali (3 roky).",
    );
    expect(src).toContain(
      "Do odvolání souhlasu. Doklad o souhlasu a jeho odvolání (e-mail, datum a verzi textu souhlasu) uchováváme ještě 3 roky po odvolání pro případ sporu; ostatní údaje z předregistrace po odvolání smažeme.",
    );
  });

  it("migration 0026 minimises rows unsubscribed before the fix", async () => {
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    await db.insert(schema.preregistrations).values([
      { email: "old@example.cz", ico: "12345679", companyName: "Jana", utm: { utm_source: "fb" }, referralCode: "oldcode1", confirmTokenHash: "a".repeat(64), confirmedAt: new Date(), unsubscribedAt: new Date() },
      { email: "oldfan@example.cz", ico: "12345679", referralCode: "oldcode2", confirmTokenHash: "b".repeat(64), marketingConsentAt: new Date(), consentEvidence: "souhlas:2026-09-20", confirmedAt: new Date(), unsubscribedAt: new Date() },
      { email: "active@example.cz", ico: "12345679", referralCode: "oldcode3", confirmTokenHash: "c".repeat(64) },
    ]);
    const migration = readFileSync(new URL("../../../../packages/db/migrations/0026_prereg_unsubscribed_minimise.sql", import.meta.url), "utf8");
    for (const stmt of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(stmt));
    expect(await rowOf("old@example.cz")).toMatchObject({ ico: null, companyName: null, utm: null, confirmedAt: null });
    const fan = (await rowOf("oldfan@example.cz"))!;
    expect(fan).toMatchObject({ ico: null, consentEvidence: "souhlas:2026-09-20" });
    expect(fan.confirmedAt).not.toBeNull();
    expect(fan.referralCode).not.toBe("oldcode2");
    expect(await rowOf("active@example.cz")).toMatchObject({ ico: "12345679", referralCode: "oldcode3" });
  });
});
