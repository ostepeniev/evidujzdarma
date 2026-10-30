/**
 * S8 – přijetí proti skutečnému Playgroundu FS (rozd. 13). Spouští se jen s EZ_PG_E2E=1 a cestou k oficiálnímu
 * archivu testovacích certifikátů FS (CAEET_Playground_2026_v1.zip, rozbalený):
 *   EZ_PG_E2E=1 EZ_PG_CERT_DIR=/cesta npx vitest run test/e2e/s8-playground.test.ts
 * Certifikáty ani heslo se do repozitáře neukládají (archiv je veřejný na eet.gov.cz, ale nepatří do kódu).
 */
import { readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { join } from "node:path";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as salesPOST } from "@/app/api/v1/sales/route";
import { GET as saleGET } from "@/app/api/v1/sales/[id]/route";
import { POST as refundPOST } from "@/app/api/v1/sales/[id]/refund/route";
import { importCertificate } from "@/lib/server/certificates";
import { processPending } from "@/lib/server/fiscal";
import { createEndpoint, deliverWebhooks, __setWebhookNetForTests } from "@/lib/server/webhooks";
import { call } from "../helpers/api";
import { seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

const ON = process.env.EZ_PG_E2E === "1" && !!process.env.EZ_PG_CERT_DIR;
const DIR = process.env.EZ_PG_CERT_DIR ?? "";
const EIC = "CZ00000019";

let t: TestDb;
beforeAll(async () => {
  if (ON) t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());

describe.runIf(ON)("S8 – EET API v1 proti FS Playground", () => {
  it("tržba → POK (…ff), opakování stejné, vratka → POK, webhook sale.confirmed s platným podpisem", async () => {
    const s = await seedAccount({ mode: "playground", eic: EIC });
    await getDb().update(schema.accounts).set({ dic: EIC }).where(eq(schema.accounts.id, s.account.id));
    const password = readFileSync(join(DIR, "password_pokladni_cert_playground.txt"), "utf8").trim();
    await importCertificate(s.account.id, { file: readFileSync(join(DIR, `CA_EET-Playground-${EIC}.p12`)), password, expected: "playground" });
    const { createIntegration } = await import("@/lib/server/integrations");
    const { token, integration } = await createIntegration(s.account.id, s.user.id, {
      name: "ALiSiO",
      environment: "test",
      scopes: ["sales:write", "sales:read", "refunds:write", "units:read", "closings:read", "webhooks:manage"],
      unitIds: [s.unit.id],
    });

    // webhook do paměti (síť podstrčená: ověřujeme podpis a obsah, ne DNS)
    const received: { headers: Record<string, string>; body: string }[] = [];
    __setWebhookNetForTests({
      resolve: async () => ["93.184.216.34"],
      send: async (req: { url: string; headers: Record<string, string>; body: string }) => {
        received.push({ headers: req.headers, body: req.body });
        return { status: 200 };
      },
    });
    const { secret } = await createEndpoint(integration.id, "https://pms.alisio.example/eet/webhook", ["sale.confirmed"]);

    const sale = {
      id: randomUUID(),
      externalRef: `ALI-E2E-${Date.now()}`,
      unitId: s.unit.id,
      soldAt: new Date(Math.floor(Date.now() / 1000) * 1000).toISOString(),
      lines: [{ name: "Ubytování 1 noc", qty: 1, unitPrice: 150000, vatRate: 12, kind: "goods" }],
      payments: [{ method: "card", amount: 150000 }],
    };
    const r1 = await call(salesPOST, { path: "/api/v1/sales", token, body: { sales: [sale] } });
    expect(r1.status).toBe(200);
    let st = r1.json.results[0];
    for (let i = 0; i < 10 && st.status !== "confirmed" && st.status !== "rejected"; i++) {
      await processPending();
      st = (await call(saleGET, { path: `/api/v1/sales/${sale.id}`, token, params: { id: sale.id } })).json;
    }
    console.log("[e2e] sale", { status: st.status, pok: st.pok ? `${String(st.pok).slice(0, 8)}…${String(st.pok).slice(-4)}` : null, error: st.error });
    expect(st.status).toBe("confirmed");
    expect(String(st.pok)).toMatch(/ff$/i);
    expect(st.receipt.pok).toBe(st.pok);

    const r2 = await call(salesPOST, { path: "/api/v1/sales", token, body: { sales: [sale] } });
    expect(r2.json.results[0].pok).toBe(st.pok);

    const refundId = randomUUID();
    const rf = await call(refundPOST, { path: `/api/v1/sales/${sale.id}/refund`, token, params: { id: sale.id }, body: { id: refundId, externalRef: `${sale.externalRef}-R` } });
    let rs = rf.json;
    for (let i = 0; i < 10 && rs.status !== "confirmed" && rs.status !== "rejected"; i++) {
      await processPending();
      rs = (await call(saleGET, { path: `/api/v1/sales/${refundId}`, token, params: { id: refundId } })).json;
    }
    console.log("[e2e] refund", { http: rf.status, status: rs.status, error: rs.error });
    expect(rs.status).toBe("confirmed");
    expect(String(rs.pok)).toMatch(/ff$/i);

    await deliverWebhooks(new Date(Date.now() + 1000));
    const ev = received.find((x) => JSON.parse(x.body).type === "sale.confirmed" && JSON.parse(x.body).data.id === sale.id);
    expect(ev, "webhook sale.confirmed").toBeTruthy();
    const sig = Object.entries(ev!.headers).find(([k]) => k.toLowerCase() === "ez-signature")![1];
    const [, ts] = /t=(\d+)/.exec(sig)!;
    const [, v1] = /v1=([0-9a-f]+)/.exec(sig)!;
    expect(createHmac("sha256", secret).update(`${ts}.${ev!.body}`).digest("hex")).toBe(v1);
    console.log("[e2e] webhook sale.confirmed – podpis platný");
  }, 180_000);
});
