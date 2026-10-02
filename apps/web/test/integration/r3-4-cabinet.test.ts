/**
 * R3.4 – kabinet účetní: pozvánku přijme jen firma se stejným IČO, token je v DB jen jako hash
 * a má platnost, klient dostane e-mail o novém propojení a může ho zrušit.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/server/auth";
import { acceptInvite, createInvite, inviteInfo } from "@/lib/server/cabinet";
import { sha256 } from "@/lib/server/tokens";
import { seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

async function setup(clientIco = "12345679", invitedIco = "12345679") {
  const client = await seedAccount();
  await getDb().update(schema.accounts).set({ ico: clientIco }).where(eq(schema.accounts.id, client.account.id));
  const [acc] = await getDb().insert(schema.accounts).values({ name: "Účetní Nováková s.r.o.", kind: "accountant" }).returning();
  const [link] = await getDb().insert(schema.accountantClients).values({ accountantAccountId: acc!.id, ico: invitedIco }).returning();
  const user = { id: client.user.id, email: client.user.email, name: null, memberships: [{ accountId: client.account.id, role: "owner" as const, accountName: "x", accountKind: "business" }] };
  return { client, acc: acc!, link: link!, user };
}

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof HttpError ? e.status : String(e);
  }
};

describe("R3.4 – accountant invitations", () => {
  it("the token is stored only as a hash and has an expiry", async () => {
    const { acc, link } = await setup();
    const token = await createInvite(acc.id, link.id);
    const row = (await getDb().query.accountantClients.findFirst({ where: eq(schema.accountantClients.id, link.id) }))!;
    expect(row.inviteTokenHash).toBe(sha256(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.inviteExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(await inviteInfo(token)).toMatchObject({ ico: "12345679" });
  });

  it("gate: a business with a different IČO cannot accept the invitation", async () => {
    const { acc, link, user } = await setup("27074358", "12345679");
    const token = await createInvite(acc.id, link.id);
    expect(await status(acceptInvite(user, token))).toBe(403);
    expect((await getDb().query.accountantClients.findFirst({ where: eq(schema.accountantClients.id, link.id) }))!.clientAccountId).toBeNull();
  });

  it("an expired invitation is refused", async () => {
    const { acc, link, user } = await setup();
    const token = await createInvite(acc.id, link.id);
    await getDb().update(schema.accountantClients).set({ inviteExpiresAt: new Date(Date.now() - 1000) }).where(eq(schema.accountantClients.id, link.id));
    expect(await inviteInfo(token)).toBeNull();
    expect(await status(acceptInvite(user, token))).toBe(404);
  });

  it("accepting links the accounts, burns the token and e-mails the client's owners", async () => {
    const { client, acc, link, user } = await setup();
    const token = await createInvite(acc.id, link.id);
    await acceptInvite(user, token);
    const row = (await getDb().query.accountantClients.findFirst({ where: eq(schema.accountantClients.id, link.id) }))!;
    expect(row.clientAccountId).toBe(client.account.id);
    expect(row.inviteTokenHash).toBeNull();
    expect(await status(acceptInvite(user, token))).toBe(404);
    const mails = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, client.user.email));
    expect(mails.some((m) => (m.payload as { subject?: string }).subject?.includes("Účetní Nováková s.r.o."))).toBe(true);
  });
});
