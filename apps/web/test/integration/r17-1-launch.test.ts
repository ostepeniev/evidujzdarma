/**
 * R17.1 (docs/tasks/2026-10-10-r17.md) – datum spuštění pokladny 2. 11. 2026 všude (1. 12. je datum MOJE eet, ne naše).
 *  - RETENTION.launch, e-mail „Pokladna je připravena“ (app-ready) 2. 11. v 8:00 Praha; odklad NOT_LAUNCHED zůstává;
 *  - už zařazené app-ready s datem 1. 12. přesune migrace 0035 na 2. 11. 8:00;
 *  - zásady (řádek předregistrace) a návod pokladna-v-mobilu-zdarma (oba stavy) doslovně.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { and, eq, sql } from "drizzle-orm";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockLaunch } from "../helpers/launch";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
// zavřená pokladna simulovaná ze skutečných seznamů – commit otevření 2. 11. testy nerozbije (R17.2)
mockLaunch("closed");
afterEach(() => {
  mockLaunch("closed");
});

const sqlRaw = (text: string) => sql.raw(text.replace(/--> statement-breakpoint/g, ""));
const LAUNCH_8AM = new Date("2026-11-02T07:00:00Z"); // 8:00 v Praze (SEČ, po změně času 25. 10.)
const NOTE_CLOSED =
  "Pokladnu EvidujZdarma připravujeme: zdarma pro až 5 uživatelů a 3 evidenční jednotky, s prodejem bez signálu a dodatečným odesláním do 48 hodin. Spouštíme ji 2. 11. 2026, předregistrovat se můžete už teď.";
const NOTE_OPEN = "Pokladna EvidujZdarma je zdarma pro až 5 uživatelů a 3 evidenční jednotky, s prodejem bez signálu a dodatečným odesláním do 48 hodin. Začít můžete hned.";
const noteOf = async () => {
  const { getGuide } = await import("@/content/guides");
  // poznámka o naší pokladně (druhá poznámka návodu je o tiskárně)
  return getGuide("pokladna-v-mobilu-zdarma")!.sections.flatMap((s) => s.blocks).flatMap((b) => ("note" in b && b.note.includes("EvidujZdarma") ? [b.note] : []));
};

describe("R17.1 – launch date 2. 11. 2026", () => {
  it("gate: RETENTION.launch is 2026-11-02", async () => {
    const { RETENTION } = await import("@/lib/legal");
    expect(RETENTION.launch).toBe("2026-11-02");
  });

  it("gate: app-ready after DOI is scheduled for 2. 11. at 8:00 Prague time", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-15T10:00:00Z"), toFake: ["Date"] });
    try {
      const { POST } = await import("@/app/api/preregistrace/route");
      const { confirmPreregistration } = await import("@/lib/server/preregistration");
      const email = "launch@example.cz";
      await POST(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.117.0.1" }, body: JSON.stringify({ email }) }));
      const [m] = await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.template, "prereg-confirm")));
      expect(await confirmPreregistration((m!.payload as { confirmToken: string }).confirmToken)).toBe(true);
      const [app] = await getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.template, "app-ready")));
      expect(app!.sendAfter.toISOString()).toBe(LAUNCH_8AM.toISOString());
    } finally {
      vi.useRealTimers();
    }
  });

  it("gate: migration 0035 moves already queued app-ready from 1. 12. to 2. 11. 8:00 (only queued app-ready)", async () => {
    const text = readFileSync(new URL("../../../../packages/db/migrations/0035_app_ready_launch.sql", import.meta.url), "utf8");
    const DEC1 = new Date("2026-12-01T07:00:00Z");
    const db = getDb();
    const rows = await db
      .insert(schema.emailOutbox)
      .values([
        { to: "a@example.cz", template: "app-ready", payload: {}, dedupeKey: "app-ready:a", sendAfter: DEC1 },
        { to: "b@example.cz", template: "app-ready", payload: {}, dedupeKey: "app-ready:b", sendAfter: DEC1, status: "cancelled" },
        { to: "c@example.cz", template: "notice", payload: {}, dedupeKey: "notice:c", sendAfter: DEC1 },
      ])
      .returning({ id: schema.emailOutbox.id, dedupeKey: schema.emailOutbox.dedupeKey });
    // migrace se v testovací DB spustila před vložením řádků – tady ji pustíme znovu nad nimi
    await db.execute(sqlRaw(text));
    const after = await db.select({ dedupeKey: schema.emailOutbox.dedupeKey, sendAfter: schema.emailOutbox.sendAfter }).from(schema.emailOutbox);
    const at = (k: string) => after.find((r) => r.dedupeKey === k)!.sendAfter.toISOString();
    expect(rows).toHaveLength(3);
    expect(at("app-ready:a")).toBe(LAUNCH_8AM.toISOString());
    expect(at("app-ready:b")).toBe(DEC1.toISOString());
    expect(at("notice:c")).toBe(DEC1.toISOString());
  });

  it("gate: zásady – „Do spuštění pokladny (2. 11. 2026)“", async () => {
    const { default: Privacy } = await import("@/app/(site)/ochrana-osobnich-udaju/page");
    const html = renderToStaticMarkup(createElement(Privacy as FC));
    expect(html).toContain("Do spuštění pokladny (2. 11. 2026)");
    expect(html).not.toContain("Do spuštění pokladny (1. 12. 2026)");
  });

  it("gate: the guide note – closed (verbatim)", async () => {
    expect(await noteOf()).toEqual([NOTE_CLOSED]);
  });

  it("gate: the guide note – open (verbatim)", async () => {
    mockLaunch("open");
    expect(await noteOf()).toEqual([NOTE_OPEN]);
  });
});
