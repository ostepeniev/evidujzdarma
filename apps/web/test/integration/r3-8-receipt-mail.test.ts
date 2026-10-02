/**
 * R3.8 – účtenky e-mailem nejsou kanál na spam: v ukázkovém a testovacím režimu jen vlastníkovi,
 * třetím osobám jen v ostrém provozu s certifikátem na EIČ účtu; limity; odkazy z hlavičky nejsou klikací.
 */
import { randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { storeCertificate } from "@/lib/server/fiscal";
import { ingestSales } from "@/lib/server/sales";
import { sha256 } from "@/lib/server/tokens";
import { testCert } from "../helpers/certs";
import { deviceContext, deviceSale, seedAccount } from "../helpers/fixtures";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
const { POST } = await import("@/app/api/pokladna/uctenka/route");
const { renderEmail } = await import("@/lib/emails");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

async function setup(mode: "mock" | "production") {
  const s = await seedAccount({ mode });
  const token = randomBytes(32).toString("base64url");
  await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
  const sale = deviceSale(s.unit.id, { mode });
  await ingestSales(await deviceContext(s.device.id), [sale as never]);
  const send = (email: string) =>
    POST(new Request("http://localhost/api/pokladna/uctenka", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ saleId: sale.id, email }) }));
  return { s, send };
}

describe("R3.8 – receipt e-mails", () => {
  it("gate: in mock/playground only the owner's address may receive a receipt", async () => {
    const { s, send } = await setup("mock");
    expect((await send("cizi@example.cz")).status).toBe(403);
    expect((await send(s.user.email)).status).toBe(200);
  });

  it("third parties only in production with a certificate for the account's EIČ", async () => {
    const { s, send } = await setup("production");
    expect((await send("zakaznik@example.cz")).status).toBe(403);
    await storeCertificate(s.account.id, testCert({ eic: "CZ87654321", issuer: "EET CA 1" }).cert, "production");
    expect((await send("zakaznik@example.cz")).status).toBe(403);
    await storeCertificate(s.account.id, testCert({ eic: "CZ12345679", issuer: "EET CA 1" }).cert, "production");
    expect((await send("zakaznik@example.cz")).status).toBe(200);
  });

  it("one recipient gets at most 5 receipts a day", async () => {
    const { s, send } = await setup("mock");
    for (let i = 0; i < 5; i++) expect((await send(s.user.email)).status).toBe(200);
    expect((await send(s.user.email)).status).toBe(429);
  });

  it("URLs from the merchant's texts are not clickable; the e-mail has an abuse report line", () => {
    const e = renderEmail("receipt", { merchant: "Salon", total: "350 Kč", receiptText: "Navštivte https://evil.example/login a www.evil.example\nDěkujeme", url: "https://evidujzdarma.cz/u/abc" });
    expect(e.text).not.toContain("https://evil.example");
    expect(e.html).not.toContain("https://evil.example");
    expect(e.text).not.toContain("www.evil.example");
    expect(e.text + e.html).toMatch(/Nahlásit zneužití/);
    expect(e.html).toContain('href="https://evidujzdarma.cz/u/abc"');
  });
});
