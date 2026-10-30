/** S8: integrace EET API v testech – založení přes stejnou funkci jako UI, volání rout /api/v1 jako HTTP požadavek. */
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { storeVerifiedCertificate, seedAccount } from "./fixtures";
import { testCert } from "./certs";

type ApiScope = schema.ApiScope;
export const ALL_SCOPES: ApiScope[] = ["sales:write", "sales:read", "refunds:write", "units:read", "closings:read", "webhooks:manage"];

/** Účet s certifikátem Playground (a pro live i s ověřeným ostrým) a jednou integrací. */
export async function seedApi(opts: { environment?: "test" | "live"; scopes?: ApiScope[]; unitIds?: string[] | "all" } = {}) {
  const environment = opts.environment ?? "test";
  const s = await seedAccount({ mode: environment === "live" ? "production" : "playground" });
  await storeVerifiedCertificate(s.account.id, testCert().cert, "playground");
  if (environment === "live") await storeVerifiedCertificate(s.account.id, testCert().cert, "production");
  const { createIntegration } = await import("@/lib/server/integrations");
  const created = await createIntegration(s.account.id, s.user.id, {
    name: "ALiSiO",
    environment,
    scopes: opts.scopes ?? ALL_SCOPES,
    unitIds: opts.unitIds === undefined || opts.unitIds === "all" ? [s.unit.id] : opts.unitIds,
  });
  return { ...s, integration: created.integration, token: created.token };
}

/** Druhá jednotka účtu (mimo oprávnění integrace, pokud ji tam test nepřidá). */
export async function addUnit(accountId: string, fsUnitId: number | null = 404) {
  const [u] = await getDb().insert(schema.evidenceUnits).values({ accountId, type: "stala_provozovna", label: "Druhá", fsUnitId }).returning();
  return u!;
}

/** Token pokladny (PWA) – pro kontrolu, že tokeny nejsou zaměnitelné. */
export async function posToken(deviceId: string) {
  const token = `pos-${randomUUID()}-${randomUUID()}`;
  const { sha256 } = await import("@/lib/server/tokens");
  await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, deviceId));
  return token;
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Volání routy jako z HTTP: Bearer token, JSON tělo, parametry cesty. */
export async function call(handler: Handler, opts: { method?: string; path: string; token?: string; body?: unknown; rawBody?: string; params?: Record<string, string> }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  const res = await handler(new Request(`http://localhost${opts.path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body }), { params: Promise.resolve(opts.params ?? {}) });
  const json = (await res.json().catch(() => null)) as Record<string, any> | null;
  return { status: res.status, headers: res.headers, json: json as any };
}

let n = 0;
/** Tržba podle SaleV1 (S8, rozd. 3.3). */
export function apiSale(unitId: string, over: Record<string, unknown> = {}) {
  n++;
  return {
    id: randomUUID(),
    externalRef: `ALI-${Date.now()}-${n}`,
    unitId,
    soldAt: new Date(Math.floor(Date.now() / 1000) * 1000).toISOString(),
    lines: [{ name: "Ubytování 2 noci", qty: 1, unitPrice: 320000, vatRate: 12, kind: "goods" }],
    payments: [{ method: "card", amount: 320000 }],
    tip: 0,
    discount: 0,
    ...over,
  };
}
