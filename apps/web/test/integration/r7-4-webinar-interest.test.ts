/**
 * R7.4 (рецензія №4, B N4, Z2, Z3) – webinář (a zájem o kabinet) odděleně od předregistrace k pokladně:
 *  - zájem je vlastní záznam (preregistration_interests); nová adresa ho potvrdí stejným DOI;
 *  - už známá adresa dostane samostatný e-mail s potvrzením zájmu (POST), záznam předregistrace se nemění (Д3-9);
 *  - „Pokladna je připravena“ (app-ready) jen tomu, kdo se předregistroval k pokladně.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { confirmPreregistration, unsubscribeTokenFor } = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.6.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = (email: string) => getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) });
const outbox = (email: string) => getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));
const interests = (id: string) => getDb().select().from(schema.preregistrationInterests).where(eq(schema.preregistrationInterests.preregistrationId, id));
const confirmFromMail = async (email: string) => {
  const mail = (await outbox(email)).find((m) => m.template === "prereg-confirm")!;
  return confirmPreregistration((mail.payload as { confirmToken: string }).confirmToken);
};

describe("R7.4 – webinar interest is separate from the cash-register pre-registration", () => {
  it("gate: a webinar sign-up confirmed by DOI gets no app-ready e-mail", async () => {
    await post({ email: "ucetni@example.cz", interest: "webinar", utm: { utm_source: "ucetni" } });
    expect(await confirmFromMail("ucetni@example.cz")).toBe(true);
    expect((await outbox("ucetni@example.cz")).map((m) => m.template)).not.toContain("app-ready");
    const row = (await rowOf("ucetni@example.cz"))!;
    expect((await interests(row.id)).map((i) => [i.campaign, !!i.confirmedAt])).toEqual([["webinar", true]]);
  });

  it("control: a cash-register pre-registration still gets app-ready after DOI", async () => {
    await post({ email: "pokladna@example.cz" });
    await confirmFromMail("pokladna@example.cz");
    expect((await outbox("pokladna@example.cz")).map((m) => m.template)).toContain("app-ready");
  });

  it("gate: a known address signing up for a webinar → pending interest + its own confirmation e-mail; the pre-registration is unchanged", async () => {
    await post({ email: "known@example.cz", ico: "12345679" });
    await confirmFromMail("known@example.cz");
    const before = (await rowOf("known@example.cz"))!;
    await post({ email: "known@example.cz", interest: "webinar", utm: { utm_source: "ucetni" } });
    const after = (await rowOf("known@example.cz"))!;
    expect(after).toEqual(before);
    const pending = (await interests(before.id)).find((i) => i.campaign === "webinar")!;
    expect(pending.confirmedAt).toBeNull();
    const mail = (await outbox("known@example.cz")).find((m) => m.template === "interest-confirm")!;
    expect(mail).toBeTruthy();
    // potvrzení zájmu jen POSTem (GET stránka nic nemění – inv. 7)
    const { POST: confirmInterestPost } = await import("@/app/api/registrace/zajem/route");
    const form = new FormData();
    form.set("token", (mail.payload as { confirmToken: string }).confirmToken);
    const res = await confirmInterestPost(new Request("http://localhost/api/registrace/zajem", { method: "POST", body: form }));
    expect(res.status).toBe(303);
    const done = (await interests(before.id)).find((i) => i.campaign === "webinar")!;
    expect(done.confirmedAt).not.toBeNull();
    expect((await outbox("known@example.cz")).filter((m) => m.template === "app-ready")).toHaveLength(1); // jen z předregistrace k pokladně
  });

  it("an unsubscribed known address gets no interest record and no e-mail", async () => {
    await post({ email: "gone@example.cz" });
    const row = (await rowOf("gone@example.cz"))!;
    const { POST: unsubscribePost } = await import("@/app/api/odhlasit/route");
    await unsubscribePost(new Request(`http://localhost/api/odhlasit?token=${encodeURIComponent(unsubscribeTokenFor(row.id))}`, { method: "POST", body: "confirm=1" }));
    const mails = (await outbox("gone@example.cz")).length;
    await post({ email: "gone@example.cz", interest: "kabinet", utm: { utm_source: "ucetni" } });
    expect(await interests(row.id)).toEqual([]);
    expect((await outbox("gone@example.cz")).length).toBe(mails);
  });

  it("gate: texts – form footnote verbatim, no dead 'duplicate' branch, no Event JSON-LD or fixed dates, privacy policy data", async () => {
    const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");
    const form = src("components/accountant/webinar-form.tsx");
    // text R8.3 (рецензія №5) – platí pro webinář i kabinet
    expect(form).toContain("E-mail a IČO použijeme jen k vyřízení vaší žádosti (webinář nebo zpráva o spuštění Účetního kabinetu). Podrobnosti najdete v");
    expect(form).toContain("zásadách ochrany osobních údajů");
    expect(form).not.toMatch(/duplicate/);
    expect(form).not.toMatch(/souhlasíte se zpracováním/);
    const { default: Ucetni } = await import("@/app/(site)/ucetni/page");
    const html = renderToStaticMarkup(createElement(Ucetni));
    expect(html).not.toMatch(/"@type":"Event"/);
    expect(html).not.toMatch(/5\. 11\. 2026|3\. 12\. 2026/);
    expect(html).toContain("Pro účetní chystáme krátké webináře o EET 2.0. Zanechte e-mail a termín i odkaz vám pošleme, jakmile ho vypíšeme.");
    expect(src("app/(site)/ochrana-osobnich-udaju/page.tsx")).toContain("zdroj návštěvy (UTM), u webinářů a Účetního kabinetu, o co máte zájem.");
  });

  it("migration 0028 backfills interests and cancels app-ready for webinar sign-ups", async () => {
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    const [a] = await db.insert(schema.preregistrations).values({ email: "w@example.cz", referralCode: "wcode001", confirmTokenHash: "a".repeat(64), utm: { utm_source: "ucetni", utm_campaign: "webinar-2026-11-05" }, confirmedAt: new Date() }).returning();
    const [b] = await db.insert(schema.preregistrations).values({ email: "p@example.cz", referralCode: "pcode001", confirmTokenHash: "b".repeat(64) }).returning();
    await db.insert(schema.emailOutbox).values([
      { to: "w@example.cz", template: "app-ready", payload: {}, sendAfter: new Date(Date.now() + 86_400_000) },
      { to: "p@example.cz", template: "app-ready", payload: {}, sendAfter: new Date(Date.now() + 86_400_000) },
    ]);
    const migration = readFileSync(new URL("../../../../packages/db/migrations/0028_prereg_interests_backfill.sql", import.meta.url), "utf8");
    for (const stmt of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(stmt));
    expect((await interests(a!.id)).map((i) => [i.campaign, !!i.confirmedAt])).toEqual([["webinar", true]]);
    expect((await interests(b!.id)).map((i) => [i.campaign, !!i.confirmedAt])).toEqual([["pokladna", false]]);
    const mails = await db.select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.template, "app-ready")));
    expect(mails.find((m) => m.to === "w@example.cz")!.status).toBe("cancelled");
    expect(mails.find((m) => m.to === "p@example.cz")!.status).toBe("queued");
  });
});
