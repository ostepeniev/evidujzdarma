/**
 * R7.12 (рецензія №4, A N1; invariant 1) – „Evidováno jinak“ jen pro tržby, které vlastník viděl.
 *  - nastavení posílá id zobrazených tržeb; server označí jen je, a přibyla-li mezitím další neodeslaná ostrá tržba,
 *    vrátí 409 s aktuálním seznamem a neoznačí nic;
 *  - volání bez id (stará stránka) → 409;
 *  - nová neodeslaná ostrá tržba na zrušeném účtu se ukáže v seznamu a vlastník dostane e-mail;
 *  - limit 500 nerozdělí „všech N“ a skutečné označení.
 */
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accountState } from "@/lib/server/account";
import { HttpError } from "@/lib/server/auth";
import { closeAccount, runRetention, settleElsewhere } from "@/lib/server/lifecycle";
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

const DAY = 86_400_000;

type Closure = { unsentProduction: number; quarantineProduction: number; unsentIds: string[]; unsentSales: { id: string; soldAt: string; total: number; registerId: string; sequence: string }[] };

async function closedWithOne() {
  const s = await seedAccount({ mode: "production" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  const a = deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 120_000).toISOString() });
  await ingestSales(await deviceContext(s.device.id), [a as never]);
  await closeAccount(s.account.id, { confirm: true });
  const user = { id: s.user.id, email: s.user.email, memberships: [{ role: "owner", accountKind: "business", accountId: s.account.id }] } as never;
  const shown = async () => ((await accountState(user)) as unknown as { closure: Closure }).closure;
  return { s, a, shown };
}

const settled = async (id: string) => (await getDb().query.sales.findFirst({ where: eq(schema.sales.id, id) }))?.settledElsewhereAt ?? null;

describe("R7.12 – 'Evidováno jinak' only for the sales the owner saw", () => {
  it("gate N1: a sale uploaded after the page was shown is not settled; 409 with the fresh list; the account stays held", async () => {
    const { s, a, shown } = await closedWithOne();
    const seen = await shown();
    expect(seen.unsentIds).toEqual([a.id]);
    // offline pokladna mezitím dovezla starší tržbu prodanou před zrušením
    const b = deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 60_000).toISOString() });
    const [rb] = await ingestSales(await deviceContext(s.device.id), [b as never]);
    expect(rb).toMatchObject({ ok: true });

    const err = (await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, ids: seen.unsentIds }).catch((e: unknown) => e)) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(409);
    const fresh = (err.details as { unsent: { ids: string[] } }).unsent;
    expect(fresh.ids.sort()).toEqual([a.id, b.id].sort());
    // nic se neoznačilo – potvrzení „všech 1“ neplatí pro dvě tržby
    expect(await settled(b.id)).toBeNull();
    expect(await settled(a.id)).toBeNull();
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 1 });
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, b.id) })).toBeTruthy();
  });

  it("gate: a call without ids (an old page) → 409, nothing settled", async () => {
    const { s, a } = await closedWithOne();
    const err = (await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email }).catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(409);
    expect(await settled(a.id)).toBeNull();
  });

  it("gate: the route requires the ids of what the owner saw (body without ids → 409)", async () => {
    const src = (await import("node:fs")).readFileSync(new URL("../../src/app/api/ucet/zrusit/evidovano-jinak/route.ts", import.meta.url), "utf8");
    expect(src).toMatch(/ids/);
    const ui = (await import("node:fs")).readFileSync(new URL("../../src/components/setup/setup-app.tsx", import.meta.url), "utf8");
    // R8.7 N16: id, u dlouhého seznamu počet a čas posledního přijetí
    expect(ui).toMatch(/\{ ids: c\.unsentIds \} : \{ seen: c\.unsentSeen \}[\s\S]{0,200}evidovano-jinak/);
  });

  it("the shown list settles exactly those sales (and the shown quarantine); unknown or foreign ids are ignored", async () => {
    const { s, a, shown } = await closedWithOne();
    // produkční tržba v otevřené karanténě (neznámá jednotka)
    await ingestSales(await deviceContext(s.device.id), [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - 60_000).toISOString(), unitId: randomUUID() }) as never]);
    const other = await seedAccount({ mode: "production" });
    await storeVerifiedCertificate(other.account.id, testCert().cert, "production");
    const foreign = deviceSale(other.unit.id, { mode: "production" });
    await ingestSales(await deviceContext(other.device.id), [foreign as never]);

    const seen = await shown();
    expect(seen.unsentProduction).toBe(1);
    expect(seen.quarantineProduction).toBe(1);
    expect(seen.unsentIds).toHaveLength(2);
    expect(seen.unsentSales.map((x) => x.id)).toEqual([a.id]);
    const out = await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, ids: [...seen.unsentIds, foreign.id, randomUUID()] });
    expect(out).toEqual({ sales: 1, quarantine: 1 });
    expect(await settled(a.id)).not.toBeNull();
    expect(await settled(foreign.id)).toBeNull();
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 0 });
  });

  it("gate: a new unsent production sale on a closed account e-mails the owner (once a day)", async () => {
    const { s } = await closedWithOne();
    const ctx = await deviceContext(s.device.id);
    for (const ago of [90_000, 80_000]) await ingestSales(ctx, [deviceSale(s.unit.id, { mode: "production", soldAt: new Date(Date.now() - ago).toISOString() }) as never]);
    const mails = await getDb()
      .select()
      .from(schema.emailOutbox)
      .where(and(eq(schema.emailOutbox.to, s.user.email), like(schema.emailOutbox.dedupeKey, "closed-unsent:%")));
    expect(mails).toHaveLength(1);
    const p = mails[0]!.payload as { subject: string; text: string; url: string };
    expect(p.text).toMatch(/Evidováno jinak/);
    expect(p.url).toMatch(/\/pokladna\/nastaveni/);
  });

  it("gate: the 500 limit does not split 'všech N' and what gets settled", async () => {
    const { s, a, shown } = await closedWithOne();
    const base = Date.now() - 3_600_000;
    const rows = Array.from({ length: 501 }, (_, i) => ({
      id: randomUUID(),
      accountId: s.account.id,
      deviceId: s.device.id,
      unitId: s.unit.id,
      registerId: "P1",
      fsUnitId: 303,
      sequence: `BULK-${i}`,
      soldAt: new Date(base + i * 1000),
      total: 10000,
      payments: [{ method: "cash", amount: 10000 }],
      evidencedTotal: 10000,
      mode: "production",
      deadlineAt: new Date(base + 2 * DAY),
    }));
    await getDb().insert(schema.sales).values(rows);
    const seen = await shown();
    expect(seen.unsentProduction).toBe(502);
    expect(seen.unsentIds).toHaveLength(502);
    const out = await settleElsewhere(s.account.id, { confirm: true, actor: s.user.email, ids: seen.unsentIds });
    expect(out.sales).toBe(502);
    const left = await getDb()
      .select({ id: schema.sales.id })
      .from(schema.sales)
      .where(and(inArray(schema.sales.id, [a.id, ...rows.map((r) => r.id)]), isNull(schema.sales.settledElsewhereAt)));
    expect(left).toHaveLength(0);
    expect(await runRetention(new Date(Date.now() + 31 * DAY))).toMatchObject({ accountsHeld: 0 });
  });
});
