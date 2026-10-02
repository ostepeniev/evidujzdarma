/**
 * R5.3 – fronta podle třídy kódu Chyba (Popis v1.2, 3.5.4): záporné opakovat, 8 omezeně (3 pokusy ~1 h),
 * 2/3/4/6/7 odmítnuto s vysvětlením, neznámé kódy odmítnuto + upozornění provozovatele (ne tiše).
 */
import type { SendResult } from "@ez/fiscal-core";
import { classifyChyba } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __setTransportFactoryForTests, processSale, storeCertificate } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { SITE } from "@/lib/site";
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

const chyba = (kod: number): SendResult => {
  const errorClass = classifyChyba(kod);
  return { ok: false, retryable: errorClass === "temporary" || errorClass === "ambiguous", errorClass, code: `EET_${kod}`, message: `Chyba ${kod} z FS`, messageUuid: crypto.randomUUID() };
};

async function saleWith(kod: number) {
  const s = await seedAccount({ mode: "playground" });
  await storeCertificate(s.account.id, testCert({ issuer: "EET CA 1 Playground" }).cert, "playground");
  const fake = fakeTransports(() => chyba(kod));
  __setTransportFactoryForTests(fake.factory);
  const sale = deviceSale(s.unit.id, { mode: "playground" });
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  const row = () => getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
  const again = async () => {
    await getDb().update(schema.sales).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(schema.sales.id, sale.id));
    await processSale(sale.id);
  };
  return { s, sale, fake, row, again };
}

describe("R5.3 – queue outcome per Chyba class", () => {
  it("negative code: stays in the queue", async () => {
    const { sale, row } = await saleWith(-1);
    await processSale(sale.id);
    expect((await row())!.status).toBe("queued");
  });

  it("kod 8: retried at most 3 times within about an hour, then rejected with an explanation", async () => {
    const { sale, fake, row, again } = await saleWith(8);
    const before = Date.now();
    await processSale(sale.id);
    let r = (await row())!;
    expect(r.status).toBe("queued");
    const delay = r.nextAttemptAt.getTime() - before;
    expect(delay).toBeGreaterThanOrEqual(15 * 60_000);
    expect(delay).toBeLessThanOrEqual(30 * 60_000);
    await again();
    expect((await row())!.status).toBe("queued");
    await again();
    r = (await row())!;
    expect(r.status).toBe("rejected");
    expect(r.lastError).toMatch(/EET_8/);
    expect(r.lastError).toMatch(/opakovaně/);
    expect(fake.calls).toHaveLength(3);
  });

  it.each([2, 3, 4, 6, 7])("kod %i: rejected at once with a hint for the owner", async (kod) => {
    const { sale, fake, row } = await saleWith(kod);
    await processSale(sale.id);
    const r = (await row())!;
    expect(r.status).toBe("rejected");
    expect(r.lastError).toMatch(new RegExp(`EET_${kod}: Chyba ${kod} z FS – \\S`));
    expect(fake.calls).toHaveLength(1);
  });

  it.each([0, 9, 123])("unknown kod %i: rejected and the operator is alerted, not silently", async (kod) => {
    const { sale, row } = await saleWith(kod);
    await processSale(sale.id);
    expect((await row())!.status).toBe("rejected");
    const mails = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, SITE.email));
    expect(mails.map((m) => (m.payload as { subject: string }).subject).join(" ")).toMatch(new RegExp(`EET_${kod}`));
  });
});
