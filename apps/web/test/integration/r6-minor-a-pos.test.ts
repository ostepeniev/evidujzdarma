/**
 * Рецензія №3, A – дрібне kolem pokladny:
 *  - Д-3: stará pokladna (před R5.5) žádá schválení vratky bez tržby a částky → srozumitelná výzva k aktualizaci;
 *  - Д-5: dokud je konfigurace zastaralá, pokladna ji zkouší načíst při každé synchronizaci, ne až za 5 min;
 *  - Д-8: hodiny pokladny pozadu o méně než 30 s (to pokladna sama neopraví) – tržba v nižším režimu prodaná těsně
 *    „před“ přepnutím nahoru jde k rozhodnutí vlastníka, ne tiše do starého režimu.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as pinPost } from "@/app/api/pokladna/pin/route";
import { shouldRefreshConfig } from "@/lib/pos/sync-result";
import { ingestSales } from "@/lib/server/sales";
import { sha256 } from "@/lib/server/tokens";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString();

describe("Д-3 – an old POS asking for a refund approval without sale and amount", () => {
  it("gate: 400 tells the cashier to reload the POS (new version)", async () => {
    const s = await seedAccount();
    const token = "d".repeat(40);
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    const res = await pinPost(
      new Request("http://localhost/api/pokladna/pin", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ staffId: s.owner.id, pin: "1234", purpose: "refund" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/starší verz|obnovte/i);
  });
});

describe("Д-5 – stale config is retried on every sync tick", () => {
  it("gate: stale → refresh now, even right after the last attempt; fresh → only after 5 min", () => {
    const now = 1_000_000_000;
    expect(shouldRefreshConfig({ stale: true, lastConfigAt: now - 1000, now })).toBe(true);
    expect(shouldRefreshConfig({ stale: false, lastConfigAt: now - 1000, now })).toBe(false);
    expect(shouldRefreshConfig({ stale: false, lastConfigAt: now - 6 * 60_000, now })).toBe(true);
  });
});

describe("Д-8 – clock lag under 30 s around an upward mode switch", () => {
  async function switched(from: "mock" | "production", to: "mock" | "production") {
    const s = await seedAccount({ mode: from });
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const t0 = Date.now() - 5 * 60_000;
    await getDb().update(schema.accounts).set({ eetMode: to, eetModeChangedAt: new Date(t0) }).where(eq(schema.accounts.id, s.account.id));
    return { s, t0, ctx: await deviceContext(s.device.id) };
  }

  it("gate: mock sale stamped 10 s before the switch to production → MODE_MISMATCH (owner decides)", async () => {
    const { s, t0, ctx } = await switched("mock", "production");
    const [r] = await ingestSales(ctx, [deviceSale(s.unit.id, { mode: "mock", soldAt: iso(t0 - 10_000) }) as never]);
    expect(r).toMatchObject({ quarantined: true, code: "MODE_MISMATCH" });
  });

  it("control: mock sale a minute before the switch stays mock", async () => {
    const { s, t0, ctx } = await switched("mock", "production");
    const [r] = await ingestSales(ctx, [deviceSale(s.unit.id, { mode: "mock", soldAt: iso(t0 - 60_000) }) as never]);
    expect(r).toMatchObject({ ok: true });
  });

  it("control: a production sale 10 s before a switch down to mock is sent in production (its own mode)", async () => {
    const { s, t0, ctx } = await switched("production", "mock");
    const sale = deviceSale(s.unit.id, { mode: "production", soldAt: iso(t0 - 10_000) });
    const [r] = await ingestSales(ctx, [sale as never]);
    expect(r).toMatchObject({ ok: true });
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) }))!.mode).toBe("production");
  });
});
