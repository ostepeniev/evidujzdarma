import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { RETENTION } from "@/lib/legal";
import { HttpError } from "./auth";
import { ApiError } from "./api/errors";
import { sha256 } from "./tokens";

/**
 * Integrace EET API (S8, rozd. 1–2): řádek devices (kind = integration) nese token, id_pokl a prefix pořadových čísel,
 * řádek integrations oprávnění. Evidence, fronta i podpis jsou tytéž jako u pokladny.
 */
export type Integration = typeof schema.integrations.$inferSelect;
type ApiScope = schema.ApiScope;
export type IntegrationEnvironment = "test" | "live";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 40 znaků base62 ≈ 238 bitů; zamítnutím bajtů ≥ 248 je rozložení rovnoměrné. */
function base62(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < 248 && out.length < length) out += BASE62[b % 62];
    }
  }
  return out;
}

export function newApiToken(environment: IntegrationEnvironment): string {
  return `ezk_${environment}_${base62(40)}`;
}

export const API_TOKEN_RE = /^ezk_(test|live)_[0-9A-Za-z]{40}$/;

/** Režim tržby podle prostředí tokenu – nikdy podle těla požadavku; mock přes API není. */
export function modeOf(environment: IntegrationEnvironment): "playground" | "production" {
  return environment === "live" ? "production" : "playground";
}

/** Proč teď nejde vydat ostrý token (null = smí): účet v ostrém režimu s platným ověřeným produkčním certifikátem. */
export async function liveRefusal(accountId: string, now = new Date()): Promise<string | null> {
  const db = getDb();
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  const cert = await db.query.certificates.findFirst({
    where: and(eq(schema.certificates.accountId, accountId), eq(schema.certificates.environment, "production"), isNull(schema.certificates.revokedAt), gt(schema.certificates.validTo, now)),
    orderBy: desc(schema.certificates.createdAt),
  });
  if (account?.eetMode !== "production" || !cert?.verifiedAt) return "Ostré prostředí zapnete, až budete mít produkční certifikát.";
  return null;
}

/** id_pokl integrace: „API-“ + název (písmena a číslice), nejvýš 20 znaků, jedinečné v účtu. */
async function freeRegisterId(accountId: string, name: string): Promise<string> {
  const slug = name.normalize("NFD").replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 12) || "INT";
  const db = getDb();
  for (let i = 0; i < 50; i++) {
    const candidate = `API-${slug}${i ? `-${i + 1}` : ""}`.slice(0, 20);
    const taken = await db.query.devices.findFirst({ where: and(eq(schema.devices.accountId, accountId), eq(schema.devices.registerId, candidate)), columns: { id: true } });
    if (!taken) return candidate;
  }
  return `API-${base62(8).toUpperCase()}`;
}

export interface NewIntegration {
  name: string;
  environment: IntegrationEnvironment;
  scopes: ApiScope[];
  unitIds: string[];
  partnerAppId?: string | null;
}

/** Založí integraci. Token se vrací jen jednou, v DB je jen jeho sha256 a prvních 12 znaků (S8, rozd. 2). */
export async function createIntegration(accountId: string, userId: string | null, input: NewIntegration): Promise<{ integration: Integration; token: string }> {
  const db = getDb();
  const name = input.name.trim();
  if (!name || name.length > 60) throw new HttpError(400, "Název integrace: 1–60 znaků.");
  const scopes = [...new Set(input.scopes)];
  if (!scopes.length || scopes.some((s) => !(schema.API_SCOPES as readonly string[]).includes(s))) throw new HttpError(400, "Vyberte alespoň jedno oprávnění.");
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account || account.kind !== "business") throw new HttpError(404, "Účet neexistuje.");
  if (account.closedAt) throw new HttpError(400, "Účet je zrušený.");
  const unitIds = [...new Set(input.unitIds)];
  if (unitIds.length) {
    const units = await db.select({ id: schema.evidenceUnits.id }).from(schema.evidenceUnits).where(eq(schema.evidenceUnits.accountId, accountId));
    const own = new Set(units.map((u) => u.id));
    if (unitIds.some((u) => !own.has(u))) throw new HttpError(400, "Neznámá evidenční jednotka.");
  }
  if (input.environment === "live") {
    const refusal = await liveRefusal(accountId);
    if (refusal) throw new HttpError(400, refusal);
  }
  const token = newApiToken(input.environment);
  const registerId = await freeRegisterId(accountId, name);
  const prefix = `${registerId.slice(4, 8) || "API"}-${base62(4).toUpperCase()}-`;
  const integration = await db.transaction(async (tx) => {
    const [device] = await tx
      .insert(schema.devices)
      .values({ accountId, name, registerId, sequencePrefix: prefix, tokenHash: sha256(token), kind: "integration", unitId: null })
      .returning({ id: schema.devices.id });
    const [row] = await tx
      .insert(schema.integrations)
      .values({ accountId, deviceId: device!.id, name, environment: input.environment, scopes, unitIds, tokenPrefix: token.slice(0, 12), createdBy: userId, partnerAppId: input.partnerAppId ?? null })
      .returning();
    return row!;
  });
  return { integration, token };
}

/** Odpojení: další požadavek tokenu dostane 401; přijaté tržby fronta dál odesílá (žádná tržba se neztratí). */
export async function revokeIntegration(accountId: string, integrationId: string): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .update(schema.integrations)
    .set({ revokedAt: now })
    .where(and(eq(schema.integrations.id, integrationId), eq(schema.integrations.accountId, accountId), isNull(schema.integrations.revokedAt)))
    .returning();
  if (!row) return false;
  await db.update(schema.devices).set({ revokedAt: now }).where(eq(schema.devices.id, row.deviceId));
  // integration.revoked na všechny endpointy integrace (S8, rozd. 8)
  const { emitIntegrationRevoked } = await import("./webhooks");
  await emitIntegrationRevoked(row).catch(() => undefined);
  return true;
}

export interface IntegrationContext {
  device: typeof schema.devices.$inferSelect;
  account: typeof schema.accounts.$inferSelect;
  integration: Integration;
}

/**
 * Autentizace tokenem integrace (Authorization: Bearer ezk_…). Token pokladny sem nepatří (401), stejně jako token
 * integrace nepatří na /api/pokladna/* (authenticateDevice). Zrušený účet: čtení a dovezení 30 dní (R5.8), pak 401.
 */
export async function authenticateIntegration(req: Request, scope: ApiScope | null): Promise<IntegrationContext> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!API_TOKEN_RE.test(token)) throw new ApiError("invalid_token", "Missing or malformed integration token (Authorization: Bearer ezk_…).");
  const db = getDb();
  const device = await db.query.devices.findFirst({ where: eq(schema.devices.tokenHash, sha256(token)) });
  if (!device || device.kind !== "integration") throw new ApiError("invalid_token", "Unknown integration token.");
  const integration = await db.query.integrations.findFirst({ where: eq(schema.integrations.deviceId, device.id) });
  if (!integration) throw new ApiError("invalid_token", "Unknown integration token.");
  if (integration.revokedAt || device.revokedAt) throw new ApiError("token_revoked", "This integration was disconnected by the account owner.");
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, device.accountId) });
  if (!account) throw new ApiError("invalid_token", "Unknown integration token.");
  if (account.closedAt && Date.now() - account.closedAt.getTime() > RETENTION.closedDeviceDays * 86_400_000) {
    throw new ApiError("token_revoked", "The account is closed and its integrations are disconnected.");
  }
  if (scope && !integration.scopes.includes(scope)) throw new ApiError("insufficient_scope", `This token lacks the scope ${scope}.`);
  // naposledy použito nejvýše jednou za minutu
  if (!integration.lastUsedAt || Date.now() - integration.lastUsedAt.getTime() > 60_000) {
    const now = new Date();
    await db.update(schema.integrations).set({ lastUsedAt: now }).where(eq(schema.integrations.id, integration.id));
    await db.update(schema.devices).set({ lastSeenAt: now }).where(eq(schema.devices.id, device.id));
  }
  return { device, account, integration };
}

/** Integrace účtu pro UI vlastníka (bez tokenů). */
export async function listIntegrations(accountId: string) {
  return getDb()
    .select()
    .from(schema.integrations)
    .where(eq(schema.integrations.accountId, accountId))
    .orderBy(sql`${schema.integrations.revokedAt} is not null`, desc(schema.integrations.createdAt));
}

/* ───────────── UI vlastníka (S8, rozd. 7) ───────────── */

export interface IntegrationDto {
  id: string;
  name: string;
  environment: IntegrationEnvironment;
  unitIds: string[];
  scopes: string[];
  tokenPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function integrationDto(i: Integration): IntegrationDto {
  return {
    id: i.id,
    name: i.name,
    environment: i.environment,
    unitIds: i.unitIds,
    scopes: i.scopes,
    tokenPrefix: i.tokenPrefix,
    lastUsedAt: i.lastUsedAt?.toISOString() ?? null,
    revokedAt: i.revokedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

/** Stav obrazovky Integrace: integrace, jednotky k výběru a zda jde zapnout ostré prostředí. */
export async function integrationsState(accountId: string) {
  const db = getDb();
  const [rows, units, live] = await Promise.all([
    listIntegrations(accountId),
    db.select({ id: schema.evidenceUnits.id, label: schema.evidenceUnits.label }).from(schema.evidenceUnits).where(eq(schema.evidenceUnits.accountId, accountId)),
    liveRefusal(accountId),
  ]);
  return { integrations: rows.map(integrationDto), units, liveAllowed: live === null, liveHint: live };
}

/** Detail: poslední požadavky (čas, routa, stav, kód chyby – bez dat tržeb) a webhooky. */
export async function integrationDetail(accountId: string, integrationId: string) {
  const db = getDb();
  const row = await db.query.integrations.findFirst({ where: and(eq(schema.integrations.id, integrationId), eq(schema.integrations.accountId, accountId)) });
  if (!row) throw new HttpError(404, "Integrace neexistuje.");
  const requests = await db
    .select({ at: schema.apiRequests.at, method: schema.apiRequests.method, route: schema.apiRequests.route, status: schema.apiRequests.status, errorCode: schema.apiRequests.errorCode })
    .from(schema.apiRequests)
    .where(eq(schema.apiRequests.integrationId, integrationId))
    .orderBy(desc(schema.apiRequests.at))
    .limit(50);
  const { listEndpoints, recentDeliveries } = await import("./webhooks");
  const deliveries = await recentDeliveries(integrationId);
  return {
    integration: integrationDto(row),
    requests: requests.map((r) => ({ ...r, at: r.at.toISOString() })),
    webhooks: await listEndpoints(integrationId),
    deliveries: deliveries.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
  };
}
