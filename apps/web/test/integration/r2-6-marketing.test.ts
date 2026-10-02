/**
 * R2.6 / R2.7 (Р5) – marketing jen s DOI + souhlasem + bez odhlášení v okamžiku odeslání;
 * potvrzení a odhlášení mění stav jen přes POST.
 */
import { createHash, randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { enqueueEmail, processOutbox, MARKETING_TEMPLATES } = await import("@/lib/server/mail");
const { POST: preregister } = await import("@/app/api/preregistrace/route");
const unsubscribeRoute = await import("@/app/api/odhlasit/route");
const confirmRoute = await import("@/app/api/registrace/potvrdit/route");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const token = () => randomBytes(18).toString("base64url");
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
async function prereg(o: { confirmed?: boolean; consent?: boolean; unsubscribed?: boolean }) {
  const confirmToken = token();
  const unsubscribeToken = token();
  const [row] = await getDb()
    .insert(schema.preregistrations)
    .values({
      email: `p-${token()}@example.cz`,
      marketingConsent: !!o.consent,
      marketingConsentAt: o.consent ? new Date() : null,
      confirmedAt: o.confirmed ? new Date() : null,
      unsubscribedAt: o.unsubscribed ? new Date() : null,
      referralCode: token().slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "a"),
      // v DB jen hashe (B Дрібне 9); starší odhlašovací odkaz = náhodný token s uloženým hashem
      confirmTokenHash: sha(confirmToken),
      unsubscribeTokenHash: sha(unsubscribeToken),
    })
    .returning();
  return { ...row!, confirmToken, unsubscribeToken };
}

describe("R2.6 – marketing e-mails only with proof of consent at send time", () => {
  it("SQL gate: no marketing template is ever sent to an unconfirmed, non-consenting or unsubscribed address", async () => {
    const rows = [await prereg({ consent: true }), await prereg({ confirmed: true, consent: true }), await prereg({ confirmed: true, consent: true, unsubscribed: true }), await prereg({ confirmed: true })];
    for (const r of rows) for (const template of MARKETING_TEMPLATES) await enqueueEmail({ to: r.email, template, payload: { unsubscribeToken: r.unsubscribeToken } });
    await processOutbox(100);
    const bad = await t.pg.query<{ n: number }>(`
      select count(*)::int as n from email_outbox o join preregistrations p on lower(p.email) = lower(o."to")
      where o.template in (${[...MARKETING_TEMPLATES].map((m) => `'${m}'`).join(",")}) and o.status = 'sent'
        and (p.confirmed_at is null or not p.marketing_consent or p.unsubscribed_at is not null)`);
    expect(bad.rows[0]!.n).toBe(0);
    const sent = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.status, "sent"));
    expect(sent.map((s) => s.to)).toEqual(MARKETING_TEMPLATES.size ? [...MARKETING_TEMPLATES].map(() => rows[1]!.email) : []);
  });

  it("registration with consent queues no marketing e-mail until the address is confirmed (POST)", async () => {
    const email = `new-${token()}@example.cz`.toLowerCase();
    const res = await preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.1.1.1" }, body: JSON.stringify({ email, marketingConsent: true }) }));
    expect(res.status).toBe(200);
    const queued = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));
    expect(queued.map((q) => q.template)).toEqual(["prereg-confirm"]);
    const mail = (await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email)))[0]!;
    const form = new URLSearchParams({ token: String((mail.payload as { confirmToken: string }).confirmToken) });
    const c = await confirmRoute.POST(new Request("http://localhost/api/registrace/potvrdit", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form }));
    expect(c.status).toBe(303);
    const after = await getDb().select({ template: schema.emailOutbox.template }).from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));
    expect(after.map((a) => a.template).sort()).toEqual(["app-ready", "dis-launch", "prereg-confirm"].filter((x) => x !== "dis-launch" || new Date() < new Date("2026-11-01T08:00:00+01:00")).sort());
  });

  it("transactional confirmation e-mail carries no referral block; marketing is marked as obchodní sdělení", async () => {
    const { renderEmail } = await import("@/lib/emails");
    const confirm = renderEmail("prereg-confirm", { confirmToken: "x".repeat(24), referralCode: "abcdefgh", unsubscribeToken: "y".repeat(24) });
    expect(confirm.text + confirm.html).not.toMatch(/\?ref=|Premium na 3 měsíce/);
    for (const m of MARKETING_TEMPLATES) {
      const e = renderEmail(m, { unsubscribeToken: "y".repeat(24) });
      expect(e.text, m).toContain("obchodní sdělení");
      expect(e.html, m).toContain("obchodní sdělení");
    }
  });

  it("the pre-registration form text is informational, not a consent", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(new URL("../../src/components/prereg-form.tsx", import.meta.url), "utf8")).not.toContain("Odesláním souhlasíte");
  });
});

describe("R2.7 – GET never changes state", () => {
  it("GET /api/odhlasit only shows a confirmation; POST unsubscribes (incl. RFC 8058 one-click)", async () => {
    const r = await prereg({ confirmed: true, consent: true });
    const get = await unsubscribeRoute.GET(new Request(`http://localhost/api/odhlasit?token=${r.unsubscribeToken}`));
    expect(get.status).toBe(200);
    expect(await get.text()).toContain('method="post"');
    expect((await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.id, r.id) }))!.unsubscribedAt).toBeNull();
    const post = await unsubscribeRoute.POST(new Request(`http://localhost/api/odhlasit?token=${r.unsubscribeToken}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }));
    expect(post.status).toBe(204);
    const after = (await getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.id, r.id) }))!;
    expect(after.unsubscribedAt).not.toBeNull();
    expect(after.marketingConsent).toBe(false);
  });

  it("the confirmation page does not confirm on GET", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync(new URL("../../src/app/(site)/registrace/potvrzeni/page.tsx", import.meta.url), "utf8");
    expect(page).not.toMatch(/\.update\(|confirmPreregistration|enqueueEmail/);
    expect(page).toContain('method="post"');
    const r = await prereg({ consent: false });
    const { lookupPreregistration } = await import("@/lib/server/preregistration");
    expect((await lookupPreregistration(r.confirmToken))!.confirmed).toBe(false);
    expect((await t.pg.query("select confirmed_at from preregistrations where id = $1", [r.id])).rows[0]).toMatchObject({ confirmed_at: null });
  });
});
