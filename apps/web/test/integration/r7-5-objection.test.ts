/**
 * R7.5 (рецензія №4, B M1, M6) – námitka:
 *  - token potvrzení nezůstává v email_outbox po odeslání (Д3-5 doplněk), staré řádky čistí migrace 0029;
 *  - na jednu adresu nejvýš 3 e-maily denně, i z různých IP (formulář nesmí sloužit k rozesílání na cizí adresu).
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: objectionPost } = await import("@/app/api/namitka/route");
const { createObjection } = await import("@/lib/server/objections");
const { processOutbox } = await import("@/lib/server/mail");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const outbox = (email: string) => getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));

describe("R7.5 – objection confirmation token and per-address limit", () => {
  it("gate: the objection token is gone from the outbox payload after sending", async () => {
    await createObjection({ kind: "objection", ico: "12345679", icp: null, name: "Jan Novák", email: "obj@example.cz", message: "prosím o odstranění" });
    const [q] = await outbox("obj@example.cz");
    const token = new URL(String((q!.payload as { url: string }).url)).searchParams.get("token")!;
    expect(token).toBeTruthy();
    await processOutbox(10);
    const [sent] = await outbox("obj@example.cz");
    expect(sent!.status).toBe("sent");
    expect(JSON.stringify(sent!.payload)).not.toContain(token);
  });

  it("gate: 4 POSTs with the same e-mail from different IPs → at most 3 e-mails", async () => {
    for (let i = 1; i <= 4; i++) {
      await objectionPost(
        new Request("http://localhost/api/namitka", {
          method: "POST",
          headers: { "content-type": "application/json", "x-real-ip": `10.5.${i}.1` },
          body: JSON.stringify({ kind: "objection", ico: "12345679", name: "Jan Novák", email: "Target@Example.cz", message: "prosím o odstranění údajů" }),
        }),
      );
    }
    expect((await outbox("target@example.cz")).length).toBeLessThanOrEqual(3);
  });

  it("migration 0029 strips the token from old sent objection e-mails", async () => {
    const db = getDb();
    await db.insert(schema.emailOutbox).values([
      { to: "a@example.cz", template: "notice", payload: { subject: "x", text: "y", url: "https://evidujzdarma.cz/namitka/potvrzeni?token=OLDTOKENOLDTOKENOLDTOKEN" }, status: "sent" },
      { to: "b@example.cz", template: "notice", payload: { subject: "x", text: "y", url: "https://evidujzdarma.cz/namitka/potvrzeni?token=PENDINGPENDINGPENDING" }, status: "queued" },
      { to: "c@example.cz", template: "notice", payload: { subject: "x", text: "y", url: "https://evidujzdarma.cz/pokladna/nastaveni#problemove-trzby" }, status: "sent" },
    ]);
    const migration = readFileSync(new URL("../../../../packages/db/migrations/0029_outbox_strip_objection_token.sql", import.meta.url), "utf8");
    for (const stmt of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(stmt));
    const rows = await db.select().from(schema.emailOutbox);
    const by = (to: string) => JSON.stringify(rows.find((r) => r.to === to)!.payload);
    expect(by("a@example.cz")).not.toContain("OLDTOKEN");
    expect(by("b@example.cz")).toContain("PENDING");
    expect(by("c@example.cz")).toContain("#problemove-trzby");
  });
});
