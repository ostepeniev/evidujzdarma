/**
 * R7.6 (рецензія №4, B M7, M11, M12) – veřejná část nevede do uzavřené:
 *  - /namitka bez odkazů do katalogu, JSON-LD aplikace a manifest bez /pokladna, dokud je pokladna zavřená;
 *  - llms.txt a výzvy k akci mluví o předregistraci, ne o hotové pokladně;
 *  - „Pokladna je připravena“ (app-ready) se při zavřené pokladně neodešle – jen se odloží;
 *  - e-mail ke spuštění DIS+ (dis-launch) jen ručním spuštěním (tvrdí fakt o FS).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isClosed } from "@/lib/launch";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);

describe("R7.6 – the public part does not lead into the closed one", () => {
  it("gate: /namitka renders no link into the closed catalogue", async () => {
    const { default: Namitka } = await import("@/app/(site)/namitka/page");
    const html = renderToStaticMarkup(await Namitka({ searchParams: Promise.resolve({}) } as never));
    expect(hrefs(html).filter((h) => h.startsWith("/") && isClosed(h.split(/[?#]/)[0]!))).toEqual([]);
  });

  it("gate: SoftwareApplication JSON-LD and the manifest do not point to the closed /pokladna", async () => {
    const { softwareApplicationLd } = await import("@/lib/jsonld");
    expect(isClosed(new URL(String(softwareApplicationLd().url)).pathname)).toBe(false);
    const { default: manifest } = await import("@/app/manifest");
    const m = manifest();
    expect(isClosed(String(m.start_url))).toBe(false);
  });

  it("gate: llms.txt talks about pre-registration while the cash register is closed (verbatim)", async () => {
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toContain("EvidujZdarma připravuje bezplatnou pokladnu pro EET 2.0. Pokladnu právě spouštíme; zatím je otevřená předregistrace.");
    expect(llmsTxt()).not.toMatch(/je bezplatná pokladna pro evidenci/);
  });

  it("gate: the tool CTA invites to pre-register (verbatim)", async () => {
    const { ToolCta } = await import("@/components/tool-cta");
    const html = renderToStaticMarkup(createElement(ToolCta, {}));
    expect(html).toContain("Předregistrujte se zdarma");
    expect(html).toContain("Předregistrovat zdarma");
  });

  it("gate: app-ready is not sent while /pokladna is closed – it is postponed, not cancelled", async () => {
    const { enqueueEmail, processOutbox } = await import("@/lib/server/mail");
    await getDb().insert(schema.preregistrations).values({ email: "wait@example.cz", referralCode: "waitcode", confirmTokenHash: "a".repeat(64), confirmedAt: new Date() });
    await enqueueEmail({ to: "wait@example.cz", template: "app-ready", payload: { unsubscribeToken: "x" } });
    await processOutbox(10);
    const [row] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "wait@example.cz"));
    expect(row!.status).toBe("queued");
    expect(row!.lastError).toBe("NOT_LAUNCHED");
    expect(row!.sendAfter.getTime()).toBeGreaterThan(Date.now() + 3_600_000);
  });

  it("gate: DOI no longer schedules dis-launch; the internal trigger queues it for confirmed consenting addresses", async () => {
    const { POST: preregister } = await import("@/app/api/preregistrace/route");
    const { confirmPreregistration } = await import("@/lib/server/preregistration");
    await preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.4.0.1" }, body: JSON.stringify({ email: "fan@example.cz", marketingConsent: true }) }));
    const [mail] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "fan@example.cz"));
    await confirmPreregistration((mail!.payload as { confirmToken: string }).confirmToken);
    const templates = async () => (await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "fan@example.cz"))).map((m) => m.template);
    expect(await templates()).not.toContain("dis-launch");
    process.env.CRON_SECRET ??= "s".repeat(32);
    const { POST: trigger } = await import("@/app/api/internal/dis-launch/route");
    expect((await trigger(new Request("http://localhost/api/internal/dis-launch", { method: "POST", body: JSON.stringify({ confirm: true }) }))).status).toBe(401);
    const res = await trigger(new Request("http://localhost/api/internal/dis-launch", { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) }));
    expect(res.status).toBe(200);
    expect(await templates()).toContain("dis-launch");
  });

  it("migration 0030 removes the automatically scheduled dis-launch e-mails", async () => {
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    await db.insert(schema.emailOutbox).values([
      { to: "a@example.cz", template: "dis-launch", payload: {}, dedupeKey: "dis-launch:a", sendAfter: new Date("2026-11-01T07:00:00Z") },
      { to: "b@example.cz", template: "dis-launch", payload: {}, dedupeKey: "dis-launch:b", status: "sent" },
    ]);
    const migration = readFileSync(new URL("../../../../packages/db/migrations/0030_dis_launch_manual.sql", import.meta.url), "utf8");
    for (const stmt of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(stmt));
    const rows = await db.select().from(schema.emailOutbox);
    expect(rows.map((r) => r.to)).toEqual(["b@example.cz"]);
  });
});
