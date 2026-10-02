/**
 * R4 – fronta odesílání (A r2 Д-2, Д-3, Д-9, Д-11; A r1 Дрібне 9, 16).
 *  - Д-2: audit `in_flight` s uuid zprávy a first_sent_at ještě před POST (pád procesu uuid neztratí).
 *  - Д-3: pozdní ověřený POK se použije (tržba se nepošle znovu); EET_TIMEOUT_MS ≤ 30 s.
 *  - Д-9: tržba s neznámým režimem se blokuje, nejde přes mock.
 *  - Д-11: řádek, ze kterého už nejde sestavit tržbu, je vidět (blok), ne tichý INTERNAL.
 *  - Дрібне 9: attempts nepřeteče; chyba jedné tržby nezastaví celou frontu.
 */
import type { SendResult } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as fiscal from "@/lib/server/fiscal";
import { __setTransportFactoryForTests, processPending, processSale, salesNeedingAttention, storeCertificate } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { testCert } from "../helpers/certs";
import { fakeTransports } from "../helpers/fake-transport";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());
afterEach(() => {
  __setTransportFactoryForTests(null);
  delete process.env.EET_TIMEOUT_MS;
});

const POK = "11111111-2222-4333-8444-555555555555-ff";
const ok = (messageUuid: string): SendResult => ({ ok: true, confirmationCode: POK, test: true, receivedAt: new Date().toISOString(), messageUuid, warnings: [] });
const row = (id: string) => getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) });
const attempts = (id: string) => getDb().select().from(schema.saleAttempts).where(eq(schema.saleAttempts.saleId, id));

async function playgroundSale() {
  const s = await seedAccount({ mode: "playground" });
  await storeCertificate(s.account.id, testCert({ issuer: "EETv2 Playground CA" }).cert, "playground");
  const sale = deviceSale(s.unit.id, { mode: "playground" });
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  return { s, sale };
}

describe("Д-2 – the attempt is audited before the POST", () => {
  it("gate: during the send there is an in_flight audit row with the message uuid and first_sent_at is set", async () => {
    const { sale } = await playgroundSale();
    const seen: { inFlight: unknown[]; firstSentAt: Date | null }[] = [];
    __setTransportFactoryForTests(() => ({
      name: "fake-playground",
      async send(_s, ctx) {
        const messageUuid = crypto.randomUUID();
        await ctx.onPrepared?.({ messageUuid, sha256: "a".repeat(64) });
        const a = await attempts(sale.id);
        seen.push({ inFlight: a.filter((x) => x.result === "in_flight" && x.messageUuid === messageUuid && x.requestSha256 === "a".repeat(64)), firstSentAt: (await row(sale.id))!.firstSentAt });
        return ok(messageUuid);
      },
    }));
    await processSale(sale.id);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.inFlight).toHaveLength(1);
    expect(seen[0]!.firstSentAt).not.toBeNull();
    // po odpovědi zůstává jediný řádek auditu – aktualizovaný na výsledek
    const a = await attempts(sale.id);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ result: "confirmed", pok: POK, requestSha256: "a".repeat(64) });
  });

  it("an in_flight row does not break the invalid streak or the code-8 series counting", async () => {
    const { sale } = await playgroundSale();
    const chyba8 = (u: string): SendResult => ({ ok: false, retryable: true, errorClass: "ambiguous", code: "EET_8", message: "Chyba", messageUuid: u });
    __setTransportFactoryForTests(() => ({
      name: "fake-playground",
      async send(_s, ctx) {
        const u = crypto.randomUUID();
        await ctx.onPrepared?.({ messageUuid: u, sha256: "b".repeat(64) });
        return chyba8(u);
      },
    }));
    for (let i = 0; i < 3; i++) {
      await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(schema.sales.id, sale.id));
      await processSale(sale.id);
    }
    expect((await row(sale.id))!.status).toBe("rejected");
  });
});

describe("Д-3 – a late verified POK is applied", () => {
  it("gate: the claim was reset while the worker waited for FS; its POK still confirms the sale", async () => {
    const { sale } = await playgroundSale();
    __setTransportFactoryForTests(() => ({
      name: "fake-playground",
      async send(_s, ctx) {
        // processPending mezitím uvolní „zaseknutý“ claim (pád / dlouhý timeout)
        await getDb().update(schema.sales).set({ status: "queued", claimToken: null }).where(eq(schema.sales.id, sale.id));
        return ok(ctx.messageUuid ?? crypto.randomUUID());
      },
    }));
    await processSale(sale.id);
    const r = (await row(sale.id))!;
    expect(r).toMatchObject({ status: "confirmed", confirmationCode: POK });
    expect((await attempts(sale.id)).map((a) => a.result)).toEqual(["confirmed"]);
  });

  it("a late failure stays stale and does not touch the sale", async () => {
    const { sale } = await playgroundSale();
    __setTransportFactoryForTests(() => ({
      name: "fake-playground",
      async send() {
        await getDb().update(schema.sales).set({ status: "queued", claimToken: null }).where(eq(schema.sales.id, sale.id));
        return { ok: false, retryable: false, errorClass: "permanent", code: "EET_3", message: "Schema", messageUuid: crypto.randomUUID() };
      },
    }));
    await processSale(sale.id);
    expect((await row(sale.id))!.status).toBe("queued");
    expect((await attempts(sale.id)).map((a) => a.result)).toEqual(["stale"]);
  });

  it("EET_TIMEOUT_MS is validated and capped at 30 s", () => {
    const timeout = (fiscal as { eetTimeoutMs?: () => number }).eetTimeoutMs;
    expect(typeof timeout).toBe("function");
    for (const [v, want] of [[undefined, 10_000], ["abc", 10_000], ["0", 10_000], ["-5", 10_000], ["5000", 5000], ["600000", 30_000]] as const) {
      if (v === undefined) delete process.env.EET_TIMEOUT_MS;
      else process.env.EET_TIMEOUT_MS = v;
      expect(timeout!()).toBe(want);
    }
  });
});

describe("Д-9 – a sale with an unknown mode is blocked", () => {
  it("gate: legacy mode 'test' does not go through mock; it waits visibly", async () => {
    const s = await seedAccount({ mode: "mock" });
    const fake = fakeTransports();
    __setTransportFactoryForTests(fake.factory);
    const sale = deviceSale(s.unit.id);
    await ingestSales(await deviceContext(s.device.id), [sale as never]);
    await getDb().update(schema.sales).set({ mode: "test", status: "queued", confirmationCode: null }).where(eq(schema.sales.id, sale.id));
    await processSale(sale.id);
    expect(await row(sale.id)).toMatchObject({ status: "queued", blockedReason: "MODE_UNKNOWN", confirmationCode: null });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("Д-11 – a stored row that no longer builds a sale", () => {
  it("gate: blocked SALE_INVALID (visible to the owner, operator alerted), not a silent INTERNAL", async () => {
    const { s, sale } = await playgroundSale();
    __setTransportFactoryForTests(fakeTransports().factory);
    // snímek už existuje (první pokus proběhl), ale řádek neprojde přísnějším buildSale nového deploye
    await getDb().update(schema.sales).set({ eetData: { eic_popl: "CZ12345679", id_jednotky: 303, id_pokl: "P1", porad_cis: sale.sequence, dat_trzby: "2026-10-02T10:00:00Z", celk_trzba: "350.00" }, items: [] }).where(eq(schema.sales.id, sale.id));
    await processSale(sale.id);
    expect(await row(sale.id)).toMatchObject({ status: "queued", blockedReason: "SALE_INVALID" });
    expect((await salesNeedingAttention(s.account.id)).map((x) => x.id)).toContain(sale.id);
    const mail = await getDb().select().from(schema.emailOutbox);
    expect(mail.some((m) => String((m.payload as { subject?: string }).subject).includes("nejde sestavit"))).toBe(true);
  });
});

describe("Дрібне 9 – attempts and the queue loop", () => {
  it("gate: attempts past the smallint range does not break the claim", async () => {
    const { sale } = await playgroundSale();
    __setTransportFactoryForTests(fakeTransports().factory);
    await getDb().update(schema.sales).set({ attempts: 32_767 }).where(eq(schema.sales.id, sale.id));
    await processSale(sale.id);
    expect(await row(sale.id)).toMatchObject({ status: "confirmed", attempts: 32_768 });
  });

  it("gate: an unexpected error of one sale does not stop processPending", async () => {
    const s = await seedAccount({ mode: "playground" });
    await storeCertificate(s.account.id, testCert({ issuer: "EETv2 Playground CA" }).cert, "playground");
    const ctx = await deviceContext(s.device.id);
    const bad = deviceSale(s.unit.id, { mode: "playground", soldAt: new Date(Date.now() - 120_000).toISOString() });
    const good = deviceSale(s.unit.id, { mode: "playground", sequence: "P1-000099", soldAt: new Date(Date.now() - 60_000).toISOString() });
    await ingestSales(ctx, [bad as never, good as never]);
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 60_000) }).where(eq(schema.sales.id, bad.id));
    __setTransportFactoryForTests(() => ({
      name: "fake-playground",
      // neplatné uuid zprávy shodí zápis výsledku (mimo try v processSale)
      async send(sl) {
        return sl.id === bad.id ? { ok: false, retryable: true, code: "NETWORK", message: "x", messageUuid: "not-a-uuid" } : ok(crypto.randomUUID());
      },
    }));
    await expect(processPending(50, 1)).resolves.toMatchObject({ processed: 2 });
    expect((await row(good.id))!.status).toBe("confirmed");
  });
});
