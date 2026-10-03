/**
 * R7.16 (рецензія №4, B M4) – kdokoli může znovu vyplnit formulář s cizí potvrzenou adresou; odkaz na stránku stavu,
 * který vlastník už má, tím nesmí přestat platit. U potvrzeného záznamu se potvrzovací token nemění, připomenutí nese
 * vlastní (podepsaný) odkaz na stav. U nepotvrzeného se token dál obnovuje (nový potvrzovací odkaz).
 */
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { lookupPreregistration, confirmPreregistration, statusTokenFor, unsubscribeTokenFor, unsubscribeWhere } = await import("@/lib/server/preregistration");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const post = (body: Record<string, unknown>) =>
  preregister(new Request("http://localhost/api/preregistrace", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.16.0.${++ip}` }, body: JSON.stringify(body) }));
const rowOf = (email: string) => getDb().query.preregistrations.findFirst({ where: eq(schema.preregistrations.email, email) });
const outbox = (email: string) =>
  getDb()
    .select()
    .from(schema.emailOutbox)
    .where(and(eq(schema.emailOutbox.to, email), eq(schema.emailOutbox.template, "prereg-confirm")))
    .orderBy(schema.emailOutbox.createdAt);
const tokenOf = (m: { payload: unknown }) => (m.payload as { confirmToken: string }).confirmToken;

describe("R7.16 – a third party cannot kill the status link of a confirmed address", () => {
  it("gate M4: re-submitting a confirmed address keeps the owner's link working; the reminder carries a working status link", async () => {
    await post({ email: "conf@example.cz" });
    const [first] = await outbox("conf@example.cz");
    const token = tokenOf(first!);
    expect(await confirmPreregistration(token)).toBe(true);
    const before = (await rowOf("conf@example.cz"))!.confirmTokenHash;

    await post({ email: "conf@example.cz" });
    expect(await lookupPreregistration(token)).toMatchObject({ confirmed: true });
    expect((await rowOf("conf@example.cz"))!.confirmTokenHash).toBe(before);

    const mails = await outbox("conf@example.cz");
    expect(mails).toHaveLength(2);
    const reminder = tokenOf(mails[1]!);
    expect((mails[1]!.payload as { alreadyConfirmed: boolean }).alreadyConfirmed).toBe(true);
    expect(await lookupPreregistration(reminder)).toMatchObject({ confirmed: true });
  });

  it("the status token is valid only for a confirmed record and cannot confirm one", async () => {
    await post({ email: "new@example.cz" });
    const row = (await rowOf("new@example.cz"))!;
    const status = statusTokenFor(row.id);
    expect(await lookupPreregistration(status)).toBeNull();
    expect(await confirmPreregistration(status)).toBe(false);
    expect((await rowOf("new@example.cz"))!.confirmedAt).toBeNull();
    // podvržený podpis
    expect(await lookupPreregistration(`${row.id}.${"A".repeat(43)}`)).toBeNull();
    // odkaz na stav není odhlašovací odkaz (jiný podpis) – a naopak
    expect(unsubscribeWhere(status)).toBeNull();
    await confirmPreregistration(tokenOf((await outbox("new@example.cz"))[0]!));
    expect(await lookupPreregistration(unsubscribeTokenFor(row.id))).toBeNull();
    expect(await lookupPreregistration(status)).toMatchObject({ confirmed: true });
  });

  it("control: an unconfirmed address still gets a fresh confirmation link (token rotated)", async () => {
    await post({ email: "pend@example.cz" });
    const before = (await rowOf("pend@example.cz"))!.confirmTokenHash;
    await post({ email: "pend@example.cz" });
    const mails = await outbox("pend@example.cz");
    expect(mails).toHaveLength(2);
    expect((await rowOf("pend@example.cz"))!.confirmTokenHash).not.toBe(before);
    expect(await confirmPreregistration(tokenOf(mails[1]!))).toBe(true);
  });
});
