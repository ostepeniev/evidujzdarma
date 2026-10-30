/**
 * S8 rozd. 6, 9.8 – připojení jedním klikem: OAuth 2.0 authorization code + PKCE (S256).
 * /pripojit (souhlas vlastníka) → /api/ucet/pripojit (Povolit / Zrušit) → 302 redirect_uri?code&state →
 * POST /api/v1/oauth/token → token integrace. redirect_uri jen přesná shoda (jinak chyba bez přesměrování),
 * PKCE povinné, kód jednorázový 10 min – opakované použití vrátí invalid_grant a token z prvního použití odvolá.
 */
import { createHash, randomBytes } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { seedAccount } from "../helpers/fixtures";
import { addUnit } from "../helpers/api";

let sessionToken: string | null = null;
let redirected: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
  headers: async () => new Headers({ "x-real-ip": "198.51.100.43", "user-agent": "Mozilla/5.0" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirected = url;
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const { sha256, randomToken } = await import("@/lib/server/tokens");
const { createPartnerApp } = await import("@/lib/server/oauth");
const { default: ConnectPage } = await import("@/app/(app)/pripojit/page");
const { POST: consentPOST } = await import("@/app/api/ucet/pripojit/route");
const { POST: tokenPOST } = await import("@/app/api/v1/oauth/token/route");
const { GET: accountGET } = await import("@/app/api/v1/account/route");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => {
  await t.reset();
  sessionToken = null;
  redirected = null;
});

const REDIRECT = "https://pms.alisio.example/eet/callback";
const b64url = (b: Buffer) => b.toString("base64url");
function pkce() {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

async function setup() {
  const s = await seedAccount({ mode: "playground" });
  sessionToken = randomToken(32);
  await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId: s.user.id, expiresAt: new Date(Date.now() + 86_400_000) });
  const app = await createPartnerApp({ name: "ALiSiO", redirectUris: [REDIRECT], logoUrl: null });
  return { s, app, ...pkce() };
}

function authorizeParams(clientId: string, challenge: string, over: Record<string, string> = {}) {
  return { client_id: clientId, redirect_uri: REDIRECT, state: "st-123", code_challenge: challenge, code_challenge_method: "S256", scope: "sales:write sales:read refunds:write", environment: "test", ...over };
}

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

async function page(params: Record<string, string>) {
  return renderToStaticMarkup((await ConnectPage({ searchParams: Promise.resolve(params) } as never)) as never);
}

function consent(params: Record<string, string>, decision: "allow" | "deny", extra: Record<string, string | string[]> = {}) {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, decision, ...extra })) for (const x of Array.isArray(v) ? v : [v]) form.append(k, x);
  return consentPOST(new Request("http://localhost/api/ucet/pripojit", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost", host: "localhost" }, body: form.toString() }));
}

function token(body: Record<string, string>) {
  return tokenPOST(new Request("http://localhost/api/v1/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() }));
}

describe("S8 – OAuth happy path", () => {
  it("gate: consent page (Czech summary, units, Povolit/Zrušit) → code → token that works; integration bound to the partner", async () => {
    const { s, app, verifier, challenge } = await setup();
    const params = authorizeParams(app.clientId, challenge);
    const html = await page(params);
    const tx = text(html);
    for (const x of ["ALiSiO", "Odesílat tržby", "Číst stav tržeb", "Vracet tržby (bez PINu vlastníka)", "Testovací (Playground)", "Salon", "Povolit", "Zrušit", s.account.name]) expect(tx, x).toContain(x);
    const res = await consent(params, "allow", { unitIds: [s.unit.id] });
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get("location")!);
    expect(`${loc.origin}${loc.pathname}`).toBe(REDIRECT);
    expect(loc.searchParams.get("state")).toBe("st-123");
    const code = loc.searchParams.get("code")!;
    expect(code.length).toBeGreaterThanOrEqual(32);
    expect(JSON.stringify(await getDb().select().from(schema.oauthCodes))).not.toContain(code);
    const tr = await token({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: app.clientId, client_secret: app.clientSecret, code_verifier: verifier });
    expect(tr.status).toBe(200);
    const body = (await tr.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ token_type: "Bearer", scope: "sales:write sales:read refunds:write", unit_ids: [s.unit.id], environment: "test" });
    expect(body.access_token).toMatch(/^ezk_test_/);
    const integ = (await getDb().select().from(schema.integrations))[0]!;
    expect(integ).toMatchObject({ id: body.integration_id, name: "ALiSiO", partnerAppId: app.id, createdBy: s.user.id });
    const acc = await accountGET(new Request("http://localhost/api/v1/account", { headers: { authorization: `Bearer ${body.access_token}` } }));
    expect(acc.status).toBe(200);
  });

  it("gate: not logged in → login with a return to the same /pripojit URL", async () => {
    const { app, challenge } = await setup();
    sessionToken = null;
    await expect(page(authorizeParams(app.clientId, challenge))).rejects.toThrow(/REDIRECT/);
    expect(redirected).toMatch(/^\/prihlaseni\?redirect=%2Fpripojit%3F/);
  });

  it("gate: several owner accounts → choose the account first", async () => {
    const { s, app, challenge } = await setup();
    const [acc2] = await getDb().insert(schema.accounts).values({ name: "Hotel Druhý s.r.o." }).returning();
    await getDb().insert(schema.memberships).values({ accountId: acc2!.id, userId: s.user.id, role: "owner" });
    const tx = text(await page(authorizeParams(app.clientId, challenge)));
    expect(tx).toContain("Vyberte účet");
    expect(tx).toContain("Hotel Druhý s.r.o.");
    expect(tx).not.toContain("Povolit");
    const chosen = text(await page({ ...authorizeParams(app.clientId, challenge), account: acc2!.id }));
    expect(chosen).toContain("Povolit");
  });

  it("gate: Zrušit → redirect_uri?error=access_denied&state, no code", async () => {
    const { app, challenge } = await setup();
    const res = await consent(authorizeParams(app.clientId, challenge), "deny");
    const loc = new URL(res.headers.get("location")!);
    expect(loc.searchParams.get("error")).toBe("access_denied");
    expect(loc.searchParams.get("state")).toBe("st-123");
    expect(await getDb().select().from(schema.oauthCodes)).toHaveLength(0);
  });
});

describe("S8 – OAuth security (9.8)", () => {
  it("gate: redirect_uri not in the list → error page and 400, never a redirect", async () => {
    const { app, challenge } = await setup();
    for (const bad of ["https://evil.example/cb", `${REDIRECT}/x`, `${REDIRECT}?a=1`, REDIRECT.replace("https", "http")]) {
      const tx = text(await page(authorizeParams(app.clientId, challenge, { redirect_uri: bad })));
      expect(tx, bad).toContain("Adresa pro návrat neodpovídá");
      expect(tx).not.toContain("Povolit");
      const res = await consent(authorizeParams(app.clientId, challenge, { redirect_uri: bad }), "allow");
      expect(res.status).toBe(400);
      expect(res.headers.get("location")).toBeNull();
    }
    expect(text(await page(authorizeParams("unknown-client", challenge)))).toContain("Neznámá aplikace");
  });

  it("gate: PKCE is mandatory (S256 only) and the verifier must match", async () => {
    const { s, app, challenge } = await setup();
    for (const over of [{ code_challenge: "" }, { code_challenge_method: "plain" }] as Record<string, string>[]) {
      const res = await consent(authorizeParams(app.clientId, challenge, over), "allow", { unitIds: [s.unit.id] });
      expect(res.status).toBe(303);
      expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("invalid_request");
    }
    const ok = await consent(authorizeParams(app.clientId, challenge), "allow", { unitIds: [s.unit.id] });
    const code = new URL(ok.headers.get("location")!).searchParams.get("code")!;
    const bad = await token({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: app.clientId, client_secret: app.clientSecret, code_verifier: b64url(randomBytes(32)) });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe("invalid_grant");
    const missing = await token({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: app.clientId, client_secret: app.clientSecret });
    expect(((await missing.json()) as { error: string }).error).toMatch(/invalid_grant|invalid_request/);
  });

  it("gate: a reused code → invalid_grant and the token issued from it is revoked", async () => {
    const { s, app, verifier, challenge } = await setup();
    const ok = await consent(authorizeParams(app.clientId, challenge), "allow", { unitIds: [s.unit.id] });
    const code = new URL(ok.headers.get("location")!).searchParams.get("code")!;
    const req = { grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: app.clientId, client_secret: app.clientSecret, code_verifier: verifier };
    const first = (await (await token(req)).json()) as { access_token: string };
    const again = await token(req);
    expect(again.status).toBe(400);
    expect(((await again.json()) as { error: string }).error).toBe("invalid_grant");
    const acc = await accountGET(new Request("http://localhost/api/v1/account", { headers: { authorization: `Bearer ${first.access_token}` } }));
    expect(acc.status).toBe(401);
  });

  it("gate: an expired code, a wrong client secret, another client's code → refused", async () => {
    const { s, app, verifier, challenge } = await setup();
    const other = await createPartnerApp({ name: "Jiný", redirectUris: [REDIRECT], logoUrl: null });
    const ok = await consent(authorizeParams(app.clientId, challenge), "allow", { unitIds: [s.unit.id] });
    const code = new URL(ok.headers.get("location")!).searchParams.get("code")!;
    const base = { grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: app.clientId, client_secret: app.clientSecret, code_verifier: verifier };
    const wrongSecret = await token({ ...base, client_secret: "ezs_wrong" });
    expect(wrongSecret.status).toBe(401);
    expect(((await wrongSecret.json()) as { error: string }).error).toBe("invalid_client");
    const otherClient = await token({ ...base, client_id: other.clientId, client_secret: other.clientSecret });
    expect(((await otherClient.json()) as { error: string }).error).toBe("invalid_grant");
    await getDb().update(schema.oauthCodes).set({ expiresAt: new Date(Date.now() - 1000) });
    const expired = await token(base);
    expect(((await expired.json()) as { error: string }).error).toBe("invalid_grant");
    expect(await getDb().select().from(schema.integrations)).toHaveLength(0);
  });

  it("gate: units only of the chosen account; the code lives 10 minutes", async () => {
    const { s, app, challenge } = await setup();
    const foreign = await seedAccount();
    const second = await addUnit(s.account.id);
    const res = await consent(authorizeParams(app.clientId, challenge), "allow", { unitIds: [second.id, foreign.unit.id] });
    expect(res.status).toBe(400);
    const ok = await consent(authorizeParams(app.clientId, challenge), "allow", { unitIds: [second.id] });
    expect(ok.status).toBe(303);
    const row = (await getDb().select().from(schema.oauthCodes))[0]!;
    expect(Math.round((row.expiresAt.getTime() - Date.now()) / 60_000)).toBe(10);
    expect(row.unitIds).toEqual([second.id]);
  });

  it("gate: the consent page cannot be framed (strict CSP path) and is not indexed", async () => {
    const { STRICT_CSP_PATHS } = await import("@/proxy");
    expect(STRICT_CSP_PATHS).toContain("/pripojit");
    const robots = JSON.stringify(await (await import("@/app/robots")).default());
    expect(robots).toContain("/pripojit");
  });
});

describe("S8 – partner registration in /admin", () => {
  it("gate: createPartnerApp returns the client secret once; only its hash is stored", async () => {
    const app = await createPartnerApp({ name: "ALiSiO", redirectUris: [REDIRECT], logoUrl: null });
    expect(app.clientId).toMatch(/^ezc_[0-9A-Za-z]{16,}$/);
    expect(app.clientSecret).toMatch(/^ezs_[0-9A-Za-z]{40}$/);
    const row = (await getDb().select().from(schema.partnerApps).where(eq(schema.partnerApps.id, app.id)))[0]!;
    expect(row.clientSecretHash).toBe(sha256(app.clientSecret));
    expect(JSON.stringify(row)).not.toContain(app.clientSecret);
    await expect(createPartnerApp({ name: "X", redirectUris: ["http://plain.example/cb"], logoUrl: null })).rejects.toThrow(/https/);
  });
});

describe("S8 – /api/admin/partneri", () => {
  it("gate: only an admin creates a partner; the secret comes back once", async () => {
    const { s } = await setup();
    const { POST } = await import("@/app/api/admin/partneri/route");
    const req = () => new Request("http://localhost/api/admin/partneri", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" }, body: JSON.stringify({ name: "ALiSiO 2", redirectUris: `${REDIRECT}\nhttps://pms.alisio.example/b` }) });
    expect((await POST(req())).status).toBe(404);
    process.env.ADMIN_EMAILS = s.user.email;
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { clientSecret: string; redirectUris: string[] };
    expect(body.clientSecret).toMatch(/^ezs_/);
    expect(body.redirectUris).toHaveLength(2);
    delete process.env.ADMIN_EMAILS;
  });
});

describe("S8 – consent redirect is not blocked by CSP form-action", () => {
  it("gate: /pripojit CSP allows the https origin of redirect_uri in form-action (and nothing for other paths)", async () => {
    const { formActionExtra, strictCsp } = await import("@/proxy");
    const u = new URL(`http://localhost/pripojit?redirect_uri=${encodeURIComponent(REDIRECT)}&client_id=x`);
    expect(formActionExtra(u)).toBe("https://pms.alisio.example");
    expect(strictCsp("n", formActionExtra(u))).toContain("form-action 'self' https://pms.alisio.example");
    expect(formActionExtra(new URL("http://localhost/pripojit?redirect_uri=javascript:alert(1)"))).toBeNull();
    expect(formActionExtra(new URL("http://localhost/pripojit?redirect_uri=http://pms.alisio.example/cb"))).toBeNull();
    expect(formActionExtra(new URL(`http://localhost/pokladna?redirect_uri=${encodeURIComponent(REDIRECT)}`))).toBeNull();
    expect(strictCsp("n")).toContain("form-action 'self';");
  });
});
