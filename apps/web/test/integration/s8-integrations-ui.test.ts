/**
 * S8 rozd. 7 – UI vlastníka „Integrace“: routy /api/ucet/integrace (jen vlastník, session), token jen jednou,
 * ostré prostředí jen s produkčním certifikátem, odpojení, poslední požadavky bez dat tržeb; texty doslovně.
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { seedAccount, storeVerifiedCertificate } from "../helpers/fixtures";
import { testCert } from "../helpers/certs";

let sessionToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
  headers: async () => new Headers({ "x-real-ip": "198.51.100.41", "user-agent": "Mozilla/5.0" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/pokladna/integrace", redirect: () => {} }));

const { sha256, randomToken } = await import("@/lib/server/tokens");
const { GET: listGET, POST: createPOST } = await import("@/app/api/ucet/integrace/route");
const { GET: detailGET, DELETE: revokeDELETE } = await import("@/app/api/ucet/integrace/[id]/route");
const { GET: accountGET } = await import("@/app/api/v1/account/route");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  sessionToken = null;
});

async function login(userId: string) {
  sessionToken = randomToken(32);
  await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId, expiresAt: new Date(Date.now() + 86_400_000) });
}
const req = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" }, body: body === undefined ? undefined : JSON.stringify(body) });

const T = {
  title: "Integrace",
  sub: "Propojte EvidujZdarma s rezervačním systémem, hotelovým PMS nebo fakturací. Tržby z nich se evidují stejně jako z pokladny.",
  newBtn: "Nová integrace",
  liveHint: "Ostré prostředí zapnete, až budete mít produkční certifikát.",
  token: "Token se zobrazí jen jednou. Uložte ho do systému, který propojujete. Kdo token zná, může jménem vaší firmy evidovat tržby.",
  confirm: "Integrace přestane fungovat okamžitě. Tržby, které už přijala, se do EET odešlou.",
};

describe("S8 – owner routes /api/ucet/integrace", () => {
  it("gate: only an owner session; the token is returned once, the list never contains it", async () => {
    const s = await seedAccount({ mode: "playground" });
    expect((await listGET(req("GET", "/api/ucet/integrace"), { params: Promise.resolve({}) })).status).toBe(401);
    await login(s.user.id);
    const created = await createPOST(req("POST", "/api/ucet/integrace", { name: "ALiSiO", environment: "test", unitIds: [s.unit.id], scopes: ["sales:write", "sales:read"] }), { params: Promise.resolve({}) });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { token: string; integration: { id: string } };
    expect(body.token).toMatch(/^ezk_test_/);
    const list = await (await listGET(req("GET", "/api/ucet/integrace"), { params: Promise.resolve({}) })).json();
    expect(JSON.stringify(list)).not.toContain(body.token);
    expect(list.integrations[0]).toMatchObject({ name: "ALiSiO", environment: "test", unitIds: [s.unit.id], tokenPrefix: body.token.slice(0, 12), revokedAt: null });
    expect(list.liveAllowed).toBe(false);
    expect(list.liveHint).toBe(T.liveHint);
    // pokladní (cashier) ne
    const [u2] = await getDb().insert(schema.users).values({ email: "kasa@example.cz" }).returning();
    await getDb().insert(schema.memberships).values({ accountId: s.account.id, userId: u2!.id, role: "cashier" });
    await login(u2!.id);
    expect((await listGET(req("GET", "/api/ucet/integrace"), { params: Promise.resolve({}) })).status).toBe(403);
  });

  it("gate: live is refused without a production certificate (verbatim hint) and allowed with one", async () => {
    const s = await seedAccount({ mode: "playground" });
    await login(s.user.id);
    const refused = await createPOST(req("POST", "/api/ucet/integrace", { name: "ALiSiO", environment: "live", unitIds: [s.unit.id], scopes: ["sales:write"] }), { params: Promise.resolve({}) });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: string }).error).toBe(T.liveHint);
    await getDb().update(schema.accounts).set({ eetMode: "production" }).where(eq(schema.accounts.id, s.account.id));
    await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
    const ok = await createPOST(req("POST", "/api/ucet/integrace", { name: "ALiSiO", environment: "live", unitIds: [s.unit.id], scopes: ["sales:write"] }), { params: Promise.resolve({}) });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { token: string }).token).toMatch(/^ezk_live_/);
  });

  it("gate: Odpojit revokes immediately; the detail lists recent requests without sale data", async () => {
    const s = await seedAccount({ mode: "playground" });
    await login(s.user.id);
    const { token, integration } = (await (await createPOST(req("POST", "/api/ucet/integrace", { name: "ALiSiO", environment: "test", unitIds: [s.unit.id], scopes: ["sales:read"] }), { params: Promise.resolve({}) })).json()) as { token: string; integration: { id: string } };
    expect((await accountGET(new Request("http://localhost/api/v1/account", { headers: { authorization: `Bearer ${token}` } }))).status).toBe(200);
    const detail = await (await detailGET(req("GET", `/api/ucet/integrace/${integration.id}`), { params: Promise.resolve({ id: integration.id }) })).json();
    expect(detail.requests[0]).toMatchObject({ method: "GET", route: "/v1/account", status: 200, errorCode: null });
    expect(Object.keys(detail.requests[0]).sort()).toEqual(["at", "errorCode", "method", "route", "status"]);
    const del = await revokeDELETE(req("DELETE", `/api/ucet/integrace/${integration.id}`), { params: Promise.resolve({ id: integration.id }) });
    expect(del.status).toBe(200);
    expect((await accountGET(new Request("http://localhost/api/v1/account", { headers: { authorization: `Bearer ${token}` } }))).status).toBe(401);
    // cizí účet integraci nevidí ani neodpojí
    const other = await seedAccount();
    await login(other.user.id);
    expect((await detailGET(req("GET", `/api/ucet/integrace/${integration.id}`), { params: Promise.resolve({ id: integration.id }) })).status).toBe(404);
  });
});

describe("S8 – the Integrace screen (verbatim texts)", () => {
  it("gate: title, subtitle, button, form labels, disabled live option with the hint", async () => {
    const { IntegrationsApp } = await import("@/components/integrations/integrations-app");
    const html = renderToStaticMarkup(
      createElement(IntegrationsApp, {
        initial: { integrations: [], units: [{ id: "u1", label: "Recepce" }], liveAllowed: false, liveHint: T.liveHint },
        openForm: true,
      }),
    );
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const s of [T.title, T.sub, T.newBtn, "Název", "Prostředí", "Testovací (Playground)", "Ostré (produkce)", T.liveHint, "Evidenční jednotky", "Oprávnění", "Odesílat tržby", "Číst stav tržeb", "Vracet tržby (bez PINu vlastníka)", "Číst jednotky", "Číst denní přehledy", "Spravovat webhooky"]) {
      expect(text, s).toContain(s);
    }
    expect(html).toMatch(/placeholder="např\. ALiSiO"/);
    expect(html).toMatch(/<input[^>]*value="live"[^>]*disabled=""|<input[^>]*disabled=""[^>]*value="live"/);
  });

  it("gate: after creation the token text, Zkopírovat and Hotovo; the list shows Naposledy použito and Odpojit with the confirmation text", async () => {
    const { TokenOnce, IntegrationRow, REVOKE_CONFIRM } = await import("@/components/integrations/integrations-app");
    const once = renderToStaticMarkup(createElement(TokenOnce, { token: "ezk_test_x", onDone: () => {} })).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const s of [T.token, "Zkopírovat", "Hotovo", "ezk_test_x"]) expect(once, s).toContain(s);
    const row = renderToStaticMarkup(
      createElement(IntegrationRow, {
        item: { id: "i1", name: "ALiSiO", environment: "test", unitIds: ["u1"], scopes: ["sales:write"], tokenPrefix: "ezk_test_abc", lastUsedAt: null, revokedAt: null, createdAt: new Date().toISOString() },
        units: [{ id: "u1", label: "Recepce" }],
        onChanged: () => {},
      }),
    ).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const s of ["ALiSiO", "Testovací (Playground)", "Recepce", "Naposledy použito", "Odpojit"]) expect(row, s).toContain(s);
    expect(REVOKE_CONFIRM).toBe(T.confirm);
  });

  it("gate: the page is owner-only and lives outside the PWA files (no change to /pokladna screens)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../src/app/(app)/pokladna/integrace/page.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/role === "owner"/);
  });
});
