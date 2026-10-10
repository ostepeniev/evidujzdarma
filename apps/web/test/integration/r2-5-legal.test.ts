/**
 * R2.5 / Р8 – právní texty neslibují nic, co kód nedělá: heslo .p12 neukládáme, šifrujeme jen klíče
 * certifikátů; „zrušit účet“, „odstranit certifikát“, „zrušit propojení s účetní“ existují; doby uložení
 * vykonává cron; přijetí podmínek se zaznamenává.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountInput, upsertAccount } from "@/lib/server/account";
import { HttpError } from "@/lib/server/auth";
import { closeAccount, removeCertificate, runRetention, unlinkAccountant } from "@/lib/server/lifecycle";
import { loadCredential, storeCertificate } from "@/lib/server/fiscal";
import { TERMS_VERSION } from "@/lib/legal";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { ingestSales } from "@/lib/server/sales";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const read = (p: string) => readFileSync(join(__dirname, "../..", p), "utf8");
const DAY = 86_400_000;

describe("R2.5 – legal texts match the code", () => {
  it("no claim that the .p12 password is stored or that all data is encrypted", () => {
    for (const f of ["src/app/(site)/ochrana-osobnich-udaju/page.tsx", "src/app/(site)/podminky/page.tsx", "src/app/(site)/o-nas/page.tsx", "src/app/(site)/page.tsx"]) {
      const s = read(f);
      expect(s, f).not.toMatch(/a jeho heslo|heslo ukládáme|Data i certifikáty|certifikáty ukládá provozovatel šifrovaně|i pokladní certifikáty ukládáme šifrovaně/);
    }
    expect(read("src/app/(site)/ochrana-osobnich-udaju/page.tsx")).toMatch(/heslo k (souboru )?certifikátu neukládáme/i);
  });

  it("privacy policy has the Účetní kabinet purpose; terms carry an Art. 28 processing clause", () => {
    expect(read("src/app/(site)/ochrana-osobnich-udaju/page.tsx")).toMatch(/purpose: "Účetní kabinet/);
    const terms = read("src/app/(site)/podminky/page.tsx");
    expect(terms).toMatch(/id: "zpracovani"/);
    expect(terms).toMatch(/čl\. 28/);
  });

  it("a new business account requires accepting the terms and records version and time", async () => {
    const [user] = await getDb().insert(schema.users).values({ email: "new-owner@example.cz" }).returning();
    const cu = { id: user!.id, email: user!.email, name: null, memberships: [] };
    const input = { name: "Nová firma", ico: "12345679" };
    await expect(upsertAccount(cu, AccountInput.parse(input))).rejects.toBeInstanceOf(HttpError);
    await upsertAccount(cu, AccountInput.parse({ ...input, acceptTerms: true }));
    const u = (await getDb().query.users.findFirst({ where: eq(schema.users.id, user!.id) }))!;
    expect(u.termsVersion).toBe(TERMS_VERSION);
    expect(u.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it("'odstranit certifikát' revokes it and wipes the encrypted key", async () => {
    const s = await seedAccount({ mode: "playground" });
    const id = await storeCertificate(s.account.id, testCert({ issuer: "EET CA 1 Playground" }).cert, "playground");
    await removeCertificate(s.account.id, id);
    const c = (await getDb().query.certificates.findFirst({ where: eq(schema.certificates.id, id) }))!;
    expect(c.revokedAt).not.toBeNull();
    expect(c.encryptedKey).toBeNull();
    expect(c.encryptedDek).toBeNull();
    await expect(loadCredential(s.account.id, "playground")).rejects.toThrow();
    const other = await seedAccount();
    await expect(removeCertificate(other.account.id, id)).rejects.toBeInstanceOf(HttpError);
  });

  it("'zrušit propojení s účetní' unlinks the accountant from the client side", async () => {
    const client = await seedAccount();
    const [acc] = await getDb().insert(schema.accounts).values({ name: "Účetní s.r.o.", kind: "accountant" }).returning();
    const [link] = await getDb().insert(schema.accountantClients).values({ accountantAccountId: acc!.id, ico: "12345679", clientAccountId: client.account.id }).returning();
    await unlinkAccountant(client.account.id, link!.id);
    expect((await getDb().query.accountantClients.findFirst({ where: eq(schema.accountantClients.id, link!.id) }))!.clientAccountId).toBeNull();
  });

  it("'zrušit účet': certificates stop at once, POS only uploads stored sales, data is deleted by cron after 30 days", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert({ issuer: "EET CA 1 Playground" }).cert, "playground");
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "playground" }) as never]);
    // neodeslaná tržba → zrušení jen s výslovným potvrzením (R5.8, podmínky čl. 11.3)
    await expect(closeAccount(s.account.id)).rejects.toMatchObject({ status: 409 });
    await closeAccount(s.account.id, { confirm: true });
    const acc = (await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) }))!;
    expect(acc.closedAt).not.toBeNull();
    // zařízení se neodpojí – po zrušení smí jen dovyvézt uložené tržby (authenticateDevice allowClosed)
    expect((await getDb().query.devices.findFirst({ where: eq(schema.devices.id, s.device.id) }))!.revokedAt).toBeNull();
    expect((await getDb().select().from(schema.certificates).where(eq(schema.certificates.accountId, s.account.id))).every((c) => c.encryptedKey === null)).toBe(true);

    await runRetention(new Date(Date.now() + 29 * DAY));
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toBeTruthy();
    await runRetention(new Date(Date.now() + 31 * DAY));
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toBeUndefined();
    expect(await getDb().select().from(schema.sales).where(eq(schema.sales.accountId, s.account.id))).toHaveLength(0);
  });

  it("retention periods from the privacy policy are executed", async () => {
    const db = getDb();
    const base = { referralCode: "aaaa1111", confirmTokenHash: "c".repeat(64), unsubscribeTokenHash: "u".repeat(64) };
    const old = new Date("2026-10-01T00:00:00Z");
    await db.insert(schema.preregistrations).values([
      // potvrzená bez souhlasu (nepotvrzené maže dřív pravidlo 90 dnů – R4, test r4-ops)
      { ...base, email: "noconsent@example.cz", confirmedAt: old, createdAt: old },
      { ...base, email: "consent@example.cz", referralCode: "bbbb2222", confirmTokenHash: "d".repeat(64), unsubscribeTokenHash: "v".repeat(64), marketingConsent: true, confirmedAt: old, createdAt: old },
      { ...base, email: "unsub@example.cz", referralCode: "cccc3333", confirmTokenHash: "e".repeat(64), unsubscribeTokenHash: "w".repeat(64), unsubscribedAt: old, createdAt: old },
    ]);
    await db.insert(schema.objections).values({ name: "X", email: "x@example.cz", message: "m", status: "resolved", resolvedAt: old });
    await db.insert(schema.emailOutbox).values({ to: "x@example.cz", template: "notice", status: "sent", sendAfter: old, createdAt: old });
    await db.insert(schema.aresCache).values({ key: "subject:12345679", payload: {}, fetchedAt: old });

    // spuštění 2. 11. 2026 (R17.1) + 12 měsíců
    await runRetention(new Date("2027-10-31T00:00:00Z"));
    expect((await db.select().from(schema.preregistrations)).map((p) => p.email).sort()).toEqual(["consent@example.cz", "noconsent@example.cz", "unsub@example.cz"]);
    expect(await db.select().from(schema.emailOutbox)).toHaveLength(0); // 90 dnů
    expect(await db.select().from(schema.aresCache)).toHaveLength(0); // 24 h
    await runRetention(new Date("2027-11-03T00:00:00Z"));
    expect((await db.select().from(schema.preregistrations)).map((p) => p.email).sort()).toEqual(["consent@example.cz", "unsub@example.cz"]);
    await runRetention(new Date("2029-10-02T00:00:00Z")); // 3 roky po odhlášení a po vyřízení námitky
    expect((await db.select().from(schema.preregistrations)).map((p) => p.email)).toEqual(["consent@example.cz"]);
    expect(await db.select().from(schema.objections)).toHaveLength(0);
  });
});
