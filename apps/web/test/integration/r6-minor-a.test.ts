/**
 * Рецензія №3, A – дрібне: Д-4 (souběžný POST stejné tržby), Д-6 (onPrepared po ztrátě claimu),
 * Д-7 (starý šifrovaný klíč aad_version 1), Д-10 (vyřízená karanténa se znovu neotevírá).
 */
import type { SendResult, Transport } from "@ez/fiscal-core";
import { encryptSecret, LocalKeyEncryptor } from "@ez/fiscal-core/server";
import { getDb, schema } from "@ez/db";
import { and, eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, forgetCredential, loadCredential, processSale } from "@/lib/server/fiscal";
import { resolveQuarantine } from "@/lib/server/quarantine";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

type R = { id: string; ok: boolean; quarantined?: boolean; code?: string };

describe("Д-4 – the same sale in two parallel POSTs is not a false conflict", () => {
  it("gate: the insert loses the race on sales_device_seq_uq, the twin row is the same sale → ok, no quarantine", async () => {
    const s = await seedAccount();
    const ctx = await deviceContext(s.device.id);
    const sale = deviceSale(s.unit.id);
    const db = getDb() as unknown as { insert: (table: unknown) => unknown };
    const original = db.insert.bind(db);
    // druhý požadavek: souběžný první už řádek uložil, náš INSERT narazí na unikátní (zařízení, pořadové číslo)
    db.insert = (table: unknown) => {
      if (table !== schema.sales) return original(table);
      db.insert = original;
      const real = original(table) as { values: (v: unknown) => { onConflictDoNothing: (o: unknown) => { returning: (r: unknown) => Promise<unknown> } } };
      return {
        values: (v: unknown) => ({
          onConflictDoNothing: (o: unknown) => ({
            returning: async (r: unknown) => {
              await real.values(v).onConflictDoNothing(o).returning(r);
              throw Object.assign(new Error('duplicate key value violates unique constraint "sales_device_seq_uq"'), { constraint_name: "sales_device_seq_uq" });
            },
          }),
        }),
      };
    };
    try {
      const [r] = (await ingestSales(ctx, [sale as never])) as R[];
      expect(r).toMatchObject({ ok: true });
    } finally {
      db.insert = original;
    }
    expect(await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, sale.id) })).toBeUndefined();
  });

  it("control: a different sale with the same sequence is still a SEQUENCE_CONFLICT", async () => {
    const s = await seedAccount();
    const ctx = await deviceContext(s.device.id);
    const a = deviceSale(s.unit.id);
    await ingestSales(ctx, [a as never]);
    const [r] = (await ingestSales(ctx, [deviceSale(s.unit.id, { sequence: a.sequence }) as never])) as R[];
    expect(r).toMatchObject({ ok: false, quarantined: true, code: "SEQUENCE_CONFLICT" });
  });
});

describe("Д-6 – onPrepared refuses to let the POST happen when the claim is lost", () => {
  it("gate: claim token changed before onPrepared → it throws, the transport does not POST", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const sale = deviceSale(s.unit.id, { mode: "production" });
    let posted = 0;
    let prepareError: unknown = null;
    const transport: Transport = {
      name: "fake-production",
      async send(_sale, ctx): Promise<SendResult> {
        // jiný proces mezitím tržbu převzal (např. po uvolnění zaseknutého „sending“)
        await getDb().update(schema.sales).set({ claimToken: crypto.randomUUID() }).where(eq(schema.sales.id, sale.id));
        try {
          await ctx.onPrepared?.({ messageUuid: crypto.randomUUID(), sha256: "a".repeat(64) });
        } catch (e) {
          prepareError = e;
          return { ok: false, retryable: true, blocked: "PREPARE", code: "PREPARE", message: String(e), messageUuid: crypto.randomUUID() };
        }
        posted++;
        return { ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-0a", test: false, receivedAt: new Date().toISOString(), messageUuid: crypto.randomUUID(), warnings: [] };
      },
    };
    __setTransportFactoryForTests(() => transport);
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    await processSale(sale.id);
    expect(prepareError).toBeInstanceOf(Error);
    expect(posted).toBe(0);
  });
});

describe("Д-7 – a key sealed before aad_version 2 still decrypts", () => {
  it("gate: AAD cert:${accountId} with aad_version 1 → loadCredential OK; the same row marked aad_version 2 → refused", async () => {
    const s = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const credential = await loadCredential(s.account.id, "production");
    const sealed = await encryptSecret(LocalKeyEncryptor.fromEnv(), Buffer.from(JSON.stringify(credential)), `cert:${s.account.id}`);
    const where = and(eq(schema.certificates.accountId, s.account.id), eq(schema.certificates.environment, "production"));
    await getDb().update(schema.certificates).set({ encryptedKey: sealed.ciphertext, encryptedDek: sealed.encryptedDek, keyVersion: sealed.keyVersion, aadVersion: 1 }).where(where);
    forgetCredential(s.account.id);
    expect((await loadCredential(s.account.id, "production")).certificatePem).toBe(credential.certificatePem);
    await getDb().update(schema.certificates).set({ aadVersion: 2 }).where(where);
    forgetCredential(s.account.id);
    await expect(loadCredential(s.account.id, "production")).rejects.toThrow();
  });
});

describe("Д-10 – a dismissed quarantine is not reopened by a repeated POST", () => {
  it("gate: owner dismissed it; the POS sends the same sale again → stays dismissed, no new e-mail", async () => {
    const s = await seedAccount();
    const ctx = await deviceContext(s.device.id);
    const sale = deviceSale(s.unit.id, { soldAt: new Date(Date.now() + 3_600_000).toISOString() }); // budoucí čas
    const [first] = (await ingestSales(ctx, [sale as never])) as R[];
    expect(first).toMatchObject({ quarantined: true, code: "FUTURE_DATE" });
    await resolveQuarantine(s.account.id, sale.id, { action: "dismiss", note: "Vyřízeno ručně" });
    await getDb().delete(schema.emailOutbox).where(like(schema.emailOutbox.dedupeKey, "quarantine:%"));
    const [again] = (await ingestSales(ctx, [sale as never])) as R[];
    expect(again).toMatchObject({ ok: false, quarantined: true });
    const q = await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, sale.id) });
    expect(q).toMatchObject({ resolution: "dismissed", note: "Vyřízeno ručně" });
    expect(q!.resolvedAt).not.toBeNull();
    expect(await getDb().select().from(schema.emailOutbox).where(like(schema.emailOutbox.dedupeKey, "quarantine:%"))).toHaveLength(0);
  });
});
