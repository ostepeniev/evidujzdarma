/**
 * R3.7 – magic link: GET jen zobrazí stránku, token se spotřebuje POSTem a jen v prohlížeči,
 * který o odkaz požádal (nonce v cookie __Host-). Citlivé kroky chtějí čerstvé přihlášení (≤ 15 min).
 */
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
const login = await import("@/app/api/auth/login/route");
const callback = await import("@/app/api/auth/callback/route");
const { requireFreshLogin, HttpError, LOGIN_NONCE_COOKIE } = await import("@/lib/server/auth");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let n = 0;
async function requestLink(email = `owner${++n}@example.cz`) {
  const res = await login.POST(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.7.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify({ email }) }));
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const nonce = setCookie.match(new RegExp(`${LOGIN_NONCE_COOKIE.replace(/[$]/g, "\\$")}=([^;]+)`))?.[1];
  const [mail] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));
  const url = new URL(String((mail!.payload as { url: string }).url));
  return { url, token: url.searchParams.get("token")!, nonce, setCookie };
}
const post = (token: string, cookie?: string) =>
  callback.POST(new Request("http://localhost/api/auth/callback", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) }, body: new URLSearchParams({ token }) }));
const used = async () => (await getDb().select().from(schema.loginTokens))[0]!.usedAt;

describe("R3.7 – magic link", () => {
  it("the e-mail links to a confirmation page; the nonce cookie is __Host- in production", async () => {
    const { url, nonce, setCookie } = await requestLink();
    expect(url.pathname).toBe("/prihlaseni/overeni");
    expect(nonce).toBeTruthy();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(LOGIN_NONCE_COOKIE).toMatch(/^(__Host-)?ez_login$/);
  });

  it("gate: GET never consumes the token", async () => {
    const { token } = await requestLink();
    const res = await callback.GET(new Request(`http://localhost/api/auth/callback?token=${token}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/prihlaseni/overeni?token=");
    expect(await used()).toBeNull();
  });

  it("POST without the requesting browser's nonce does not log in and does not burn the token", async () => {
    const { token } = await requestLink();
    const res = await post(token);
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/ez_session=/);
    expect(await used()).toBeNull();
  });

  it("POST with the nonce logs in once", async () => {
    const { token, nonce } = await requestLink();
    const res = await post(token, `${LOGIN_NONCE_COOKIE}=${nonce}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/ez_session=/);
    expect(await used()).not.toBeNull();
    const again = await post(token, `${LOGIN_NONCE_COOKIE}=${nonce}`);
    expect(again.headers.get("set-cookie") ?? "").not.toMatch(/ez_session=[^;]+;/);
  });

  it("sensitive steps require a login not older than 15 minutes", () => {
    const user = (minutes: number) => ({ id: "u", email: "e", name: null, memberships: [], sessionCreatedAt: new Date(Date.now() - minutes * 60_000) });
    expect(() => requireFreshLogin(user(5))).not.toThrow();
    try {
      requireFreshLogin(user(16));
      throw new Error("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as InstanceType<typeof HttpError>).status).toBe(401);
      expect((e as InstanceType<typeof HttpError>).details).toMatchObject({ reauth: true });
    }
  });
});
