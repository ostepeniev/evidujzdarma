/**
 * R5.7 (A В-2) – pokladna vidí vyřešené „Odmítnuto“ a karanténa se opakovaným odesláním neotevírá znovu.
 */
import { randomBytes } from "node:crypto";
import type { SendResult } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as salesGet } from "@/app/api/pokladna/sales/route";
import { applyPolledStatuses, type ServerSaleStatus } from "@/lib/pos/sync-result";
import { __setTransportFactoryForTests, processSale, requeueSales, storeCertificate } from "@/lib/server/fiscal";
import { resolveQuarantine } from "@/lib/server/quarantine";
import { ingestSales } from "@/lib/server/sales";
import { sha256 } from "@/lib/server/tokens";
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
afterEach(() => __setTransportFactoryForTests(null));

async function setup() {
  const s = await seedAccount({ mode: "playground" });
  await storeCertificate(s.account.id, testCert({ issuer: "EET CA 1 Playground" }).cert, "playground");
  const token = randomBytes(32).toString("base64url");
  await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
  const poll = async (ids: string[]) =>
    ((await (await salesGet(new Request(`http://localhost/api/pokladna/sales?ids=${ids.join(",")}`, { headers: { authorization: `Bearer ${token}` } }))).json()) as { statuses: ServerSaleStatus[] }).statuses;
  return { s, ctx: await deviceContext(s.device.id), poll };
}

describe("R5.7 – resolved rejections reach the device", () => {
  it("FS rejected → owner resends → confirmed → the device's poll turns it confirmed", async () => {
    const { s, ctx, poll } = await setup();
    let answer: SendResult = { ok: false, retryable: false, errorClass: "permanent", code: "EET_3", message: "XSD", messageUuid: crypto.randomUUID() };
    __setTransportFactoryForTests(fakeTransports(() => answer).factory);
    const sale = deviceSale(s.unit.id, { mode: "playground" });
    await ingestSales(ctx, [sale as never]);
    await processSale(sale.id);
    answer = { ok: true, confirmationCode: "11111111-2222-4333-8444-555555555555-ff", test: true, receivedAt: new Date().toISOString(), messageUuid: crypto.randomUUID(), warnings: [] };
    await requeueSales(s.account.id, [sale.id]);
    await processSale(sale.id);
    const patch = new Map(applyPolledStatuses([sale.id], await poll([sale.id]), new Date(), { rejected: new Set([sale.id]) }));
    expect(patch.get(sale.id)).toMatchObject({ status: "confirmed" });
  });

  it("T10 resolved with the received time: re-posting the original keeps the quarantine 'ingested' and sends no new e-mail", async () => {
    const { s, ctx } = await setup();
    __setTransportFactoryForTests(fakeTransports().factory);
    const sale = deviceSale(s.unit.id, { mode: "playground", soldAt: new Date(Date.now() + 11 * 60_000).toISOString() });
    await ingestSales(ctx, [sale as never]);
    expect((await resolveQuarantine(s.account.id, sale.id, { action: "retry_with_received_time" })).ok).toBe(true);
    const mails = (await getDb().select().from(schema.emailOutbox)).length;

    const [again] = await ingestSales(ctx, [sale as never]); // pokladník klikne „Odeslat znovu“ s původním časem
    expect(again).toMatchObject({ ok: true });
    expect(await getDb().query.saleQuarantine.findFirst({ where: eq(schema.saleQuarantine.id, sale.id) })).toMatchObject({ resolution: "ingested" });
    expect((await getDb().select().from(schema.emailOutbox)).length).toBe(mails);
  });

  it("GET ?ids= reports the quarantine state of sales that are not in the sales table", async () => {
    const { s, ctx, poll } = await setup();
    const sale = deviceSale(s.unit.id, { mode: "playground", soldAt: new Date(Date.now() + 11 * 60_000).toISOString() });
    await ingestSales(ctx, [sale as never]);
    expect((await poll([sale.id]))[0]).toMatchObject({ id: sale.id, status: "rejected", quarantine: "open" });
    await resolveQuarantine(s.account.id, sale.id, { action: "dismiss", note: "Evidováno ručně v MOJE eet" });
    expect((await poll([sale.id]))[0]).toMatchObject({ id: sale.id, status: "rejected", quarantine: "dismissed", lastError: expect.stringMatching(/MOJE eet/) });
  });
});
