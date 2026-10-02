/**
 * R4 – provoz (B r1 Дрібне 2, 6, 12, 18, 19).
 *  - 18: e-mail zaseknutý ve stavu „sending“ (pád procesu) se vrátí do fronty.
 *  - 2: vlastník dostane e-mail o nové pokladně a o nahraném certifikátu.
 *  - 6: znovuzapnutí jednotky nepřekročí limit plánu.
 *  - 19: pokladna dostane jen srozumitelný text chyby (odmítnutí FS, blokace), ne interní zprávu serveru.
 *  - 12: nepotvrzená předregistrace (DOI nikdy neproběhlo) se po 90 dnech od posledního odkazu smaže.
 */
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/server/auth";
import { setUnitActive, registerDevice } from "@/lib/server/account";
import { importCertificate } from "@/lib/server/certificates";
import { BLOCK_TEXT, salesStatus } from "@/lib/server/fiscal";
import { runRetention } from "@/lib/server/lifecycle";
import { processOutbox } from "@/lib/server/mail";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const notices = (to: string) => getDb().select().from(schema.emailOutbox).where(and(eq(schema.emailOutbox.to, to), eq(schema.emailOutbox.template, "notice")));
const subject = (m: { payload: unknown }) => String((m.payload as { subject?: string }).subject);

describe("Дрібне 18 – outbox reaper", () => {
  it("gate: a row stuck in 'sending' for 15 minutes is sent again", async () => {
    const [row] = await getDb()
      .insert(schema.emailOutbox)
      .values({ to: "x@example.cz", template: "notice", payload: { subject: "a", text: "b" }, status: "sending", attempts: 1, claimedAt: new Date(Date.now() - 15 * 60_000) })
      .returning();
    await processOutbox(10);
    expect((await getDb().query.emailOutbox.findFirst({ where: eq(schema.emailOutbox.id, row!.id) }))!.status).toBe("sent");
  });

  it("a fresh claim (another worker is sending right now) is left alone", async () => {
    const [row] = await getDb()
      .insert(schema.emailOutbox)
      .values({ to: "y@example.cz", template: "notice", payload: { subject: "a", text: "b" }, status: "sending", attempts: 1, claimedAt: new Date() })
      .returning();
    await processOutbox(10);
    expect((await getDb().query.emailOutbox.findFirst({ where: eq(schema.emailOutbox.id, row!.id) }))!.status).toBe("sending");
  });
});

describe("Дрібне 2 – owner is told about new devices and certificates", () => {
  it("gate: registering a cash register and uploading a certificate e-mail the owner", async () => {
    const s = await seedAccount({ mode: "mock" });
    await registerDevice(s.account.id, { name: "Tablet u vchodu", registerId: "P9", unitId: s.unit.id });
    await importCertificate(s.account.id, { file: testCert({ issuer: "EETv2 Playground CA" }).p12, password: "x" });
    const subjects = (await notices(s.user.email)).map(subject);
    expect(subjects.some((x) => /pokladna/i.test(x) && x.includes("P9"))).toBe(true);
    expect(subjects.some((x) => /certifikát/i.test(x))).toBe(true);
  });
});

describe("Дрібне 6 – reactivating a unit respects the plan", () => {
  it("gate: on the free plan a deactivated unit cannot be switched back on over the limit", async () => {
    const s = await seedAccount();
    const db = getDb();
    const units = await db.select().from(schema.evidenceUnits).where(eq(schema.evidenceUnits.accountId, s.account.id));
    // doplnit aktivní jednotky do limitu free plánu a jednu navíc vypnutou
    for (let i = units.length; i < 3; i++) await db.insert(schema.evidenceUnits).values({ accountId: s.account.id, type: "stala_provozovna", label: `J${i}`, fsUnitId: 400 + i });
    const [off] = await db.insert(schema.evidenceUnits).values({ accountId: s.account.id, type: "stala_provozovna", label: "Vypnutá", fsUnitId: 499, active: false }).returning();
    const err = await setUnitActive(s.account.id, off!.id, true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    // vypnout jde vždy
    await expect(setUnitActive(s.account.id, units[0]!.id, false)).resolves.toBeTruthy();
    await expect(setUnitActive(s.account.id, off!.id, true)).resolves.toBeTruthy();
  });
});

describe("Дрібне 19 – what the device sees as an error", () => {
  it("gate: an internal server message is not passed to the device; FS refusals and blocks are", async () => {
    const s = await seedAccount({ mode: "mock" });
    const ctx = await deviceContext(s.device.id);
    const [a, b, c] = [deviceSale(s.unit.id), deviceSale(s.unit.id), deviceSale(s.unit.id)];
    await ingestSales(ctx, [a, b, c] as never);
    await getDb().update(schema.sales).set({ status: "queued", lastError: "INTERNAL: Failed query: update sales … params: secret" }).where(eq(schema.sales.id, a.id));
    await getDb().update(schema.sales).set({ status: "queued", blockedReason: "CERT_MISSING", lastError: "CERT_MISSING: …" }).where(eq(schema.sales.id, b.id));
    await getDb().update(schema.sales).set({ status: "rejected", lastError: "EET_4: Neplatny podpis – zkontrolujte certifikát" }).where(eq(schema.sales.id, c.id));
    const byId = new Map((await salesStatus([a.id, b.id, c.id], s.account.id)).map((x) => [x.id, x.lastError]));
    expect(byId.get(a.id)).toBeNull();
    expect(byId.get(b.id)).toBe(BLOCK_TEXT.CERT_MISSING);
    expect(byId.get(c.id)).toMatch(/^EET_4/);
  });
});

describe("Дрібне 12 – unconfirmed pre-registrations are deleted", () => {
  it("gate: never confirmed + last link issued over 90 days ago → deleted; confirmed ones stay", async () => {
    const db = getDb();
    const old = new Date(Date.now() - 91 * 86_400_000);
    await db.insert(schema.preregistrations).values([
      { email: "never@example.cz", referralCode: "never001", confirmTokenHash: "a".repeat(64), confirmTokenIssuedAt: old, marketingConsent: true, marketingConsentAt: old, createdAt: old },
      { email: "fresh@example.cz", referralCode: "fresh001", confirmTokenHash: "b".repeat(64), confirmTokenIssuedAt: new Date(), marketingConsent: true, createdAt: old },
      { email: "done@example.cz", referralCode: "done0001", confirmTokenHash: "c".repeat(64), confirmTokenIssuedAt: old, confirmedAt: old, marketingConsent: true, createdAt: old },
      // odhlášení je doklad – drží se 3 roky i bez potvrzení
      { email: "unsub@example.cz", referralCode: "unsub001", confirmTokenHash: "d".repeat(64), confirmTokenIssuedAt: old, unsubscribedAt: old, createdAt: old },
    ]);
    await runRetention();
    const left = (await db.select({ email: schema.preregistrations.email }).from(schema.preregistrations)).map((r) => r.email).sort();
    expect(left).toEqual(["done@example.cz", "fresh@example.cz", "unsub@example.cz"]);
  });
});
