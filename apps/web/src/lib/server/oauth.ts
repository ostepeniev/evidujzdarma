import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError, type CurrentUser } from "./auth";
import { createIntegration, liveRefusal, revokeIntegration } from "./integrations";
import { safeEqual, sha256 } from "./tokens";

/**
 * Připojení jedním klikem (S8, rozd. 6): OAuth 2.0 authorization code + PKCE (S256). Partnerskou aplikaci zakládá
 * jen admin. Access token = token integrace bez expirace (refresh v1 není), odvolává se v UI „Integrace“.
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function base62(n: number): string {
  let s = "";
  while (s.length < n) for (const b of randomBytes(n * 2)) if (b < 248 && s.length < n) s += BASE62[b % 62];
  return s;
}

export const CODE_TTL_MS = 10 * 60_000;

export async function createPartnerApp(input: { name: string; redirectUris: string[]; logoUrl: string | null }) {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new HttpError(400, "Název partnera: 1–80 znaků.");
  const uris = [...new Set(input.redirectUris.map((u) => u.trim()).filter(Boolean))];
  if (!uris.length) throw new HttpError(400, "Zadejte alespoň jednu adresu pro návrat.");
  for (const u of uris) {
    let url: URL;
    try {
      url = new URL(u);
    } catch {
      throw new HttpError(400, `Neplatná adresa: ${u.slice(0, 100)}`);
    }
    if (url.protocol !== "https:" || url.hash) throw new HttpError(400, "Adresa pro návrat musí být https a bez #.");
  }
  if (input.logoUrl && !/^https:\/\//.test(input.logoUrl)) throw new HttpError(400, "Logo musí být na https.");
  const clientId = `ezc_${base62(20)}`;
  const clientSecret = `ezs_${base62(40)}`;
  const [row] = await getDb()
    .insert(schema.partnerApps)
    .values({ name, clientId, clientSecretHash: sha256(clientSecret), redirectUris: uris, logoUrl: input.logoUrl })
    .returning();
  return { id: row!.id, name: row!.name, clientId, clientSecret, redirectUris: uris };
}

export async function listPartnerApps() {
  return getDb().select({ id: schema.partnerApps.id, name: schema.partnerApps.name, clientId: schema.partnerApps.clientId, redirectUris: schema.partnerApps.redirectUris, active: schema.partnerApps.active, createdAt: schema.partnerApps.createdAt }).from(schema.partnerApps);
}

/* ───────────── authorize ───────────── */

export type AuthorizeParams = Record<string, string | string[] | undefined>;
type Partner = typeof schema.partnerApps.$inferSelect;

export type AuthorizeCheck =
  /** chyba bez přesměrování (neznámý klient, cizí redirect_uri) */
  | { kind: "fatal"; message: string }
  /** chyba, kterou smíme vrátit na redirect_uri */
  | { kind: "redirect_error"; redirectUri: string; state: string; error: string; description: string }
  | { kind: "ok"; partner: Partner; redirectUri: string; state: string; challenge: string; scopes: schema.ApiScope[]; environment: "test" | "live" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Kontrola parametrů /pripojit: redirect_uri jen přesná shoda se seznamem partnera; PKCE S256 povinné. */
export async function checkAuthorize(p: AuthorizeParams): Promise<AuthorizeCheck> {
  const clientId = one(p.client_id);
  const redirectUri = one(p.redirect_uri);
  const partner = clientId ? await getDb().query.partnerApps.findFirst({ where: and(eq(schema.partnerApps.clientId, clientId), eq(schema.partnerApps.active, true)) }) : undefined;
  if (!partner) return { kind: "fatal", message: "Neznámá aplikace. Připojení spusťte znovu ze systému, který chcete propojit." };
  if (!redirectUri || !partner.redirectUris.includes(redirectUri)) return { kind: "fatal", message: "Adresa pro návrat neodpovídá registraci aplikace. Připojení jsme z bezpečnostních důvodů zastavili." };
  const state = one(p.state).slice(0, 500);
  const fail = (error: string, description: string): AuthorizeCheck => ({ kind: "redirect_error", redirectUri, state, error, description });
  const responseType = one(p.response_type);
  if (responseType && responseType !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  const challenge = one(p.code_challenge);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge) || one(p.code_challenge_method) !== "S256") return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  const scopes = [...new Set(one(p.scope).split(/[\s,+]+/).filter(Boolean))];
  if (!scopes.length || scopes.some((s) => !(schema.API_SCOPES as readonly string[]).includes(s))) return fail("invalid_scope", "Unknown or missing scope.");
  const env = one(p.environment) || "test";
  if (env !== "test" && env !== "live") return fail("invalid_request", "environment must be test or live.");
  return { kind: "ok", partner, redirectUri, state, challenge, scopes: scopes as schema.ApiScope[], environment: env };
}

/** URL pro návrat s parametry (zachová query, které redirect_uri už má – ale jen přesná registrovaná hodnota). */
export function returnUrl(redirectUri: string, params: Record<string, string>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

/** Účty, kde je uživatel vlastníkem podnikatelského účtu. */
export function ownerAccounts(user: CurrentUser) {
  return user.memberships.filter((m) => m.role === "owner" && m.accountKind === "business");
}

/** Povolit: jednorázový kód (v DB jen hash), 10 minut, vázaný na partnera, účet, uživatele, redirect_uri a PKCE. */
export async function issueCode(user: CurrentUser, accountId: string, check: Extract<AuthorizeCheck, { kind: "ok" }>, unitIds: string[]): Promise<string> {
  if (!ownerAccounts(user).some((m) => m.accountId === accountId)) throw new HttpError(403, "Nemáte přístup k tomuto účtu.");
  const units = await getDb().select({ id: schema.evidenceUnits.id }).from(schema.evidenceUnits).where(eq(schema.evidenceUnits.accountId, accountId));
  const own = new Set(units.map((u) => u.id));
  const chosen = [...new Set(unitIds)];
  if (chosen.some((u) => !own.has(u))) throw new HttpError(400, "Neznámá evidenční jednotka.");
  if (check.environment === "live") {
    const refusal = await liveRefusal(accountId);
    if (refusal) throw new HttpError(400, refusal);
  }
  const code = base62(48);
  await getDb()
    .insert(schema.oauthCodes)
    .values({
      codeHash: sha256(code),
      partnerAppId: check.partner.id,
      accountId,
      userId: user.id,
      scopes: check.scopes,
      unitIds: chosen,
      environment: check.environment,
      redirectUri: check.redirectUri,
      codeChallenge: check.challenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
  return code;
}

/* ───────────── token ───────────── */

export class OAuthError extends Error {
  constructor(
    readonly error: "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type",
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/**
 * Výměna kódu za token (RFC 6749 4.1.3 + RFC 7636). Klient se ověřuje client_secret. Kód se spotřebuje atomicky;
 * druhé použití vrátí invalid_grant a odvolá integraci vydanou prvním použitím (RFC 6749 4.1.2).
 */
export async function exchangeCode(form: Record<string, string>) {
  if (form.grant_type !== "authorization_code") throw new OAuthError("unsupported_grant_type", "Only grant_type=authorization_code is supported.");
  const db = getDb();
  const partner = form.client_id ? await db.query.partnerApps.findFirst({ where: eq(schema.partnerApps.clientId, form.client_id) }) : undefined;
  if (!partner || !partner.active || !form.client_secret || !safeEqual(sha256(form.client_secret), partner.clientSecretHash)) throw new OAuthError("invalid_client", "Client authentication failed.", 401);
  if (!form.code) throw new OAuthError("invalid_request", "code is required.");
  const codeHash = sha256(form.code);
  const row = await db.query.oauthCodes.findFirst({ where: eq(schema.oauthCodes.codeHash, codeHash) });
  if (!row || row.partnerAppId !== partner.id) throw new OAuthError("invalid_grant", "Invalid authorization code.");
  if (row.usedAt) {
    if (row.integrationId) await revokeIntegration(row.accountId, row.integrationId);
    throw new OAuthError("invalid_grant", "The authorization code was already used; the token issued with it has been revoked.");
  }
  if (row.expiresAt <= new Date()) throw new OAuthError("invalid_grant", "The authorization code expired.");
  if (form.redirect_uri !== row.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri does not match.");
  if (!form.code_verifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(form.code_verifier)) throw new OAuthError("invalid_grant", "code_verifier is missing or invalid.");
  const computed = createHash("sha256").update(form.code_verifier).digest("base64url");
  if (!safeEqual(computed, row.codeChallenge)) throw new OAuthError("invalid_grant", "PKCE verification failed.");
  // spotřebovat kód atomicky – souběžná výměna téhož kódu dostane invalid_grant
  const [claimed] = await db.update(schema.oauthCodes).set({ usedAt: new Date() }).where(and(eq(schema.oauthCodes.codeHash, codeHash), isNull(schema.oauthCodes.usedAt))).returning();
  if (!claimed) throw new OAuthError("invalid_grant", "The authorization code was already used.");
  let created;
  try {
    created = await createIntegration(row.accountId, row.userId, {
      name: partner.name,
      environment: row.environment,
      scopes: row.scopes as schema.ApiScope[],
      unitIds: row.unitIds,
      partnerAppId: partner.id,
    });
  } catch (e) {
    throw new OAuthError("invalid_grant", e instanceof HttpError ? e.message : "The integration could not be created.");
  }
  await db.update(schema.oauthCodes).set({ integrationId: created.integration.id }).where(eq(schema.oauthCodes.codeHash, codeHash));
  return {
    access_token: created.token,
    token_type: "Bearer",
    scope: created.integration.scopes.join(" "),
    unit_ids: created.integration.unitIds,
    environment: created.integration.environment,
    integration_id: created.integration.id,
  };
}
