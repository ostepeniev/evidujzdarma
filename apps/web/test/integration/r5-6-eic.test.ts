/**
 * R5.6 – EIČ = CN pokladního certifikátu (produkce v1.1, 3.1.2). Účet nejde přepnout na jiné EIČ, snímek
 * s nesouhlasným EIČ nevznikne (blok EIC_CERT_MISMATCH). Snímek je neměnný (Р3); jediná výjimka je výslovná
 * akce vlastníka po určitém odmítnutí FS (Chyba 2, 3, 4, 6, 7): přestaví se jen eic_popl a id_jednotky.
 */
import type { EetData, SendResult } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountInput, upsertAccount } from "@/lib/server/account";
import { HttpError } from "@/lib/server/auth";
import { __setTransportFactoryForTests, processSale, rebuildSnapshots } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => __setTransportFactoryForTests(null));

const chyba = (kod: number): SendResult => ({ ok: false, retryable: false, errorClass: kod === 8 ? "ambiguous" : "permanent", code: `EET_${kod}`, message: "FS odmítla", messageUuid: crypto.randomUUID() });

async function setup() {
  const s = await seedAccount({ mode: "production" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production"); // CN = CZ12345679
  const user = { id: s.user.id, email: s.user.email, name: null, memberships: [{ accountId: s.account.id, role: "owner" as const, accountName: "x", accountKind: "business" }] } as never;
  const setEicDirectly = (eic: string) => getDb().update(schema.accounts).set({ eic, dic: eic }).where(eq(schema.accounts.id, s.account.id));
  const row = (id: string) => getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) });
  return { s, user, setEicDirectly, row };
}

describe("R5.6 – EIČ equals the certificate CN", () => {
  it("gate: the account cannot switch to an EIČ the active certificate does not carry", async () => {
    const { user } = await setup();
    const err = await upsertAccount(user, AccountInput.parse({ name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345678" })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    expect((err as Error).message).toMatch(/CZ12345679/);
    await expect(upsertAccount(user, AccountInput.parse({ name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345679" }))).resolves.toBeTruthy();
  });

  it("no snapshot with a mismatching EIČ: blocked EIC_CERT_MISMATCH, released once the EIČ is fixed", async () => {
    const { s, user, setEicDirectly, row } = await setup();
    await setEicDirectly("CZ12345678"); // stav z doby před R5.6
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    await processSale(sale.id);
    let r = (await row(sale.id))!;
    expect(r).toMatchObject({ status: "queued", blockedReason: "EIC_CERT_MISMATCH", eetData: null });
    expect(fake.calls).toHaveLength(0);

    await upsertAccount(user, AccountInput.parse({ name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345679" }));
    await processSale(sale.id);
    r = (await row(sale.id))!;
    expect(r.status).toBe("confirmed");
    expect(fake.calls.map((c) => c.ctx.snapshot?.eic_popl)).toEqual(["CZ12345679"]);
  });

  it("explicit 'odeslat s opravenými údaji' after a definite refusal rebuilds only eic_popl / id_jednotky and audits both hashes", async () => {
    const { s, setEicDirectly, row } = await setup();
    await setEicDirectly("CZ12345678");
    // starý snímek s chybným EIČ (vznikl před R5.6) a odmítnutí FS kódem 6
    let answer: SendResult = chyba(6);
    const fake = fakeTransports(() => answer);
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    const old = { eic_popl: "CZ12345678", id_jednotky: 303, id_pokl: "P1", porad_cis: sale.sequence, dat_trzby: sale.soldAt.replace(".000Z", "+00:00"), celk_trzba: "350.00" } as EetData;
    await getDb().update(schema.sales).set({ eetData: old }).where(eq(schema.sales.id, sale.id));
    await processSale(sale.id);
    expect((await row(sale.id))!.status).toBe("rejected");

    await setEicDirectly("CZ12345679");
    await getDb().update(schema.evidenceUnits).set({ fsUnitId: 404 }).where(eq(schema.evidenceUnits.id, s.unit.id));
    const out = await rebuildSnapshots(s.account.id, [sale.id]);
    expect(out.rebuilt).toEqual([sale.id]);
    const r = (await row(sale.id))!;
    expect(r.status).toBe("queued");
    expect(r.eetData).toEqual({ ...old, eic_popl: "CZ12345679", id_jednotky: 404 });
    const audit = await getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, sale.id));
    const rebuilt = audit.find((a) => a.result === "rebuilt")!;
    expect(rebuilt.message).toMatch(/[0-9a-f]{64}.*[0-9a-f]{64}/);

    answer = { ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-0a", test: false, receivedAt: new Date().toISOString(), messageUuid: crypto.randomUUID(), warnings: [] };
    await processSale(sale.id);
    expect(fake.calls.at(-1)!.ctx.snapshot).toMatchObject({ eic_popl: "CZ12345679", id_jednotky: 404, porad_cis: old.porad_cis, dat_trzby: old.dat_trzby, celk_trzba: old.celk_trzba });
    expect((await row(sale.id))!.status).toBe("confirmed");
  });

  it("no rebuild without a definite refusal (code 8, network, INVALID) – the snapshot stays", async () => {
    const { s, row } = await setup();
    const fake = fakeTransports(() => chyba(8));
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    for (let i = 0; i < 3; i++) {
      await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(schema.sales.id, sale.id));
      await processSale(sale.id);
    }
    expect((await row(sale.id))!.status).toBe("rejected");
    const before = (await row(sale.id))!.eetData;
    const out = await rebuildSnapshots(s.account.id, [sale.id]);
    expect(out.rebuilt).toEqual([]);
    expect(out.skipped[0]).toMatchObject({ id: sale.id });
    expect((await row(sale.id))!.eetData).toEqual(before);
  });
});
