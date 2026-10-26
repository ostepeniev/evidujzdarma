/**
 * S5-SLUŽBY: POST /api/poptavka – poptávka „Nastavení EET na klíč“ jde e-mailem jen provozovateli (SITE.email);
 * zákazníkovi nic (formulář nesmí sloužit k rozesílání na cizí adresy); validace, honeypot a limity.
 */
import { getDb, schema } from "@ez/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST } = await import("@/app/api/poptavka/route");
const { SITE } = await import("@/lib/site");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ipSeq = 0;
const post = (body: unknown, ip = `10.55.${++ipSeq % 250}.1`) =>
  POST(new Request("http://localhost/api/poptavka", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": ip }, body: JSON.stringify(body) }));
const outbox = () => getDb().select().from(schema.emailOutbox);

describe("S5 – /api/poptavka", () => {
  it("gate: a valid order → one notice e-mail to the operator with the details, nothing to the customer", async () => {
    const res = await post({ email: "Kadernice@Example.cz", ico: "12345679", establishments: "2", message: "Jedna provozovna, DIS+ zatím ne." });
    expect(res.status).toBe(200);
    const rows = await outbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.to).toBe(SITE.email);
    expect(rows[0]!.template).toBe("notice");
    const p = rows[0]!.payload as { subject: string; text: string };
    expect(p.subject).toBe("Poptávka: Nastavení EET na klíč – kadernice@example.cz");
    for (const s of ["kadernice@example.cz", "IČO: 12345679", "Počet provozoven: 2", "DIS+ zatím ne."]) expect(p.text).toContain(s);
    expect(rows.some((r) => r.to.toLowerCase() === "kadernice@example.cz")).toBe(false);
  });

  it("gate: validation – bad e-mail and bad IČO are refused with the field name", async () => {
    const r1 = await post({ email: "neni-email" });
    expect(r1.status).toBe(400);
    expect((await r1.json()).field).toBe("email");
    const r2 = await post({ email: "a@example.cz", ico: "12345678" });
    expect(r2.status).toBe(400);
    expect((await r2.json()).field).toBe("ico");
    expect(await outbox()).toHaveLength(0);
  });

  it("gate: honeypot → 200 and nothing queued; non-JSON → 415", async () => {
    expect((await post({ email: "bot@example.cz", website: "http://spam" })).status).toBe(200);
    expect(await outbox()).toHaveLength(0);
    const res = await POST(new Request("http://localhost/api/poptavka", { method: "POST", headers: { "content-type": "text/plain", "x-real-ip": "10.56.0.1" }, body: "email=a@b.cz" }));
    expect(res.status).toBe(415);
  });

  it("gate: the same address at most 3× a day, even from different IPs", async () => {
    for (let i = 0; i < 5; i++) await post({ email: "repeat@example.cz", message: `zpráva ${i}` });
    expect((await outbox()).length).toBeLessThanOrEqual(3);
  });
});
