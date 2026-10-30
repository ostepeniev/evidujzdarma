import "server-only";
import { z } from "zod";
import { schema } from "@ez/db";
import { absoluteUrl } from "@/lib/site";
import { ERROR_CATALOG } from "./errors";
import { API_LIMITS } from "./http";
import { RefundV1Schema, SaleV1Schema } from "./v1";

/**
 * OpenAPI 3.1 EET API v1 (S8, rozd. 5.1). Těla požadavků jsou přímo zod schémata, kterými API validuje (SaleV1Schema,
 * RefundV1Schema); odpovědi popisují schémata níže a test (s8-receipt, s8-openapi) hlídá, že skutečné odpovědi jim
 * odpovídají. JSON Schema dělá z zod 4 vestavěné z.toJSONSchema (draft 2020-12 = dialekt OpenAPI 3.1) – bez další
 * závislosti (T-rozhodnutí v reportu S8).
 */

const SaleErrorSchema = z.object({
  code: z.enum(Object.keys(ERROR_CATALOG) as [string, ...string[]]),
  message: z.string(),
  retryable: z.boolean(),
  field: z.string().optional(),
  fsCode: z.number().int().optional().describe("Chyba code from FS (Popis rozhraní EET 2.0, 3.5.4)"),
});

export const ReceiptFiscalV1Schema = z.object({
  seller: z.object({ name: z.string(), ico: z.string().nullable(), dic: z.string().nullable(), address: z.string().nullable() }),
  unit: z.object({ fsUnitId: z.number().int(), label: z.string() }),
  registerId: z.string().describe("id_pokl"),
  sequence: z.string().describe("porad_cis"),
  soldAt: z.string().datetime({ offset: true }),
  total: z.number().int().describe("haléře"),
  evidencedAmount: z.number().int().describe("celk_trzba in haléře"),
  vatBreakdown: z.record(z.string(), z.object({ base: z.number().int(), vat: z.number().int() })).nullable(),
  pok: z.string().nullable(),
  mode: z.enum(["production", "playground"]),
  offline: z.boolean().describe("true when the POK is not there yet at the time of the response"),
  note: z.string().optional().describe("Print on the receipt when offline: “Tržba bude odeslána nejpozději do 48 hodin.”"),
});

export const SaleStatusV1Schema = z.object({
  id: z.string().uuid(),
  externalRef: z.string().nullable(),
  status: z.enum(["confirmed", "queued", "sending", "rejected", "quarantined", "not_evidenced"]),
  pok: z.string().nullable(),
  evidencedAmount: z.number().int().nullable(),
  notEvidencedAmount: z.number().int().nullable(),
  sentAt: z.string().datetime({ offset: true }).nullable(),
  deadlineAt: z.string().datetime({ offset: true }).nullable().describe("soldAt + 48 h"),
  attempts: z.number().int(),
  warnings: z.array(z.object({ code: z.number().int(), text: z.string() })),
  error: SaleErrorSchema.nullable(),
  receipt: ReceiptFiscalV1Schema.nullable(),
  receiptUrl: z.string().url().nullable(),
});

export const ErrorSchema = z.object({
  error: z.object({ code: z.enum(Object.keys(ERROR_CATALOG) as [string, ...string[]]), message: z.string(), field: z.string().optional(), requestId: z.string().uuid() }),
});

const AccountSchema = z.object({
  environment: z.enum(["test", "live"]),
  eetMode: z.enum(["playground", "production"]),
  eicMasked: z.string().nullable(),
  certificate: z.object({ status: z.enum(["valid", "expired", "missing", "not_verified"]), validTo: z.string().nullable(), daysLeft: z.number().int().nullable() }),
  integration: z.object({ id: z.string().uuid(), name: z.string(), scopes: z.array(z.enum(schema.API_SCOPES)), unitIds: z.array(z.string().uuid()) }),
});

const UnitsSchema = z.object({
  units: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      type: z.string(),
      fsUnitId: z.number().int().nullable(),
      active: z.boolean(),
      ready: z.boolean(),
      notReadyReason: z.enum(["unit_missing_fs_id", "certificate_missing", "certificate_expired", "account_closed"]).nullable(),
    }),
  ),
});

const ClosingsSchema = z.object({
  closings: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD, Europe/Prague"),
      unitId: z.string().uuid().nullable(),
      count: z.number().int(),
      total: z.number().int(),
      evidenced: z.number().int(),
      notEvidenced: z.number().int(),
      byPaymentMethod: z.record(z.string(), z.number().int()),
      byVat: z.record(z.string(), z.object({ base: z.number().int(), vat: z.number().int() })),
      pending: z.number().int().describe("sales without POK yet"),
    }),
  ),
});

const SalesRequestSchema = z.object({ sales: z.array(SaleV1Schema).min(1).max(API_LIMITS.salesPerBatch) });
const SalesResultSchema = z.object({ results: z.array(SaleStatusV1Schema) });
const SalesListSchema = z.object({ sales: z.array(SaleStatusV1Schema), nextCursor: z.string().nullable() });

/** zod → JSON Schema 2020-12 bez $schema a bez dlouhých regexů u uuid/date-time (format stačí). */
function js(s: z.ZodType, io: "input" | "output"): Record<string, unknown> {
  const out = z.toJSONSchema(s, { target: "draft-2020-12", unrepresentable: "any", io }) as Record<string, unknown>;
  delete out.$schema;
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      const o = { ...(v as Record<string, unknown>) };
      if (o.format === "uuid" || o.format === "date-time") delete o.pattern;
      for (const k of Object.keys(o)) o[k] = strip(o[k]);
      return o;
    }
    return v;
  };
  return strip(out) as Record<string, unknown>;
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: string) => ({ "application/json": { schema: ref(name) } });
const err = (description: string) => ({ description, content: json("Error") });
const COMMON = { "401": err("invalid_token / token_revoked"), "403": err("insufficient_scope / account_closed / environment_not_ready"), "429": err("rate_limited (Retry-After)") };
const idParam = (description: string) => ({ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description });
const q = (name: string, description: string, s: Record<string, unknown> = { type: "string" }) => ({ name, in: "query", required: false, schema: s, description });

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "EvidujZdarma EET API",
      version: "1",
      description:
        "EET 2.0 gateway for external systems (PMS, booking, invoicing). Sales go out with the merchant's own EIČ, unit and certificate; EvidujZdarma is a technical intermediary, not a pověřený poplatník. Amounts are in haléře (integers), times ISO 8601 with an offset. Czech documentation: " +
        absoluteUrl("/api-docs"),
    },
    servers: [{ url: `${absoluteUrl("/")}api` }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Integration token ezk_test_… (Playground) or ezk_live_… (production)." } },
      schemas: {
        SaleV1: js(SaleV1Schema, "input"),
        SalesRequest: js(SalesRequestSchema, "input"),
        RefundRequest: js(RefundV1Schema, "input"),
        SaleStatusV1: js(SaleStatusV1Schema, "output"),
        ReceiptFiscalV1: js(ReceiptFiscalV1Schema, "output"),
        SalesResult: js(SalesResultSchema, "output"),
        SalesList: js(SalesListSchema, "output"),
        Account: js(AccountSchema, "output"),
        Units: js(UnitsSchema, "output"),
        Closings: js(ClosingsSchema, "output"),
        Error: js(ErrorSchema, "output"),
      },
    },
    paths: {
      "/v1/account": {
        get: { operationId: "getAccount", summary: "Token environment, masked EIČ, certificate state and the integration's scopes (any scope).", responses: { "200": { description: "OK", content: json("Account") }, ...COMMON } },
      },
      "/v1/units": {
        get: { operationId: "listUnits", summary: "Units the token may use, and whether they are ready (units:read).", responses: { "200": { description: "OK", content: json("Units") }, ...COMMON } },
      },
      "/v1/sales": {
        post: {
          operationId: "createSales",
          summary: `Submit 1–${API_LIMITS.salesPerBatch} sales (sales:write). Idempotent by id; new sales are sent to FS synchronously within 2.5 s, the rest by the queue.`,
          requestBody: { required: true, content: json("SalesRequest") },
          responses: {
            "200": { description: "Results in request order (also when some sales are quarantined).", content: json("SalesResult") },
            "400": err("invalid_request"),
            "404": err("unit_not_found"),
            "409": err("idempotency_conflict / external_ref_conflict"),
            "413": err("payload_too_large"),
            ...COMMON,
          },
        },
        get: {
          operationId: "listSales",
          summary: "Sales of this integration (sales:read). Order soldAt desc, id.",
          parameters: [
            q("ids", "Up to 200 ids, comma separated (includes quarantined sales)."),
            q("externalRef", "Exact externalRef."),
            q("status", "confirmed | queued | sending | rejected | quarantined | not_evidenced"),
            q("unitId", "Unit id.", { type: "string", format: "uuid" }),
            q("since", "soldAt ≥ (ISO 8601).", { type: "string", format: "date-time" }),
            q("until", "soldAt < (ISO 8601).", { type: "string", format: "date-time" }),
            q("limit", "1–200, default 50.", { type: "integer", minimum: 1, maximum: 200 }),
            q("cursor", "nextCursor from the previous page."),
          ],
          responses: { "200": { description: "OK", content: json("SalesList") }, "400": err("invalid_request"), ...COMMON },
        },
      },
      "/v1/sales/{id}": {
        get: { operationId: "getSale", summary: "One sale of this integration (sales:read).", parameters: [idParam("Sale id")], responses: { "200": { description: "OK", content: json("SaleStatusV1") }, "404": err("sale_not_found"), ...COMMON } },
      },
      "/v1/sales/{id}/refund": {
        post: {
          operationId: "refundSale",
          summary: "Full refund (no lines) or partial refund of a sale of this integration (refunds:write). The refund is a new negative sale on the original's unit.",
          parameters: [idParam("Original sale id")],
          requestBody: { required: true, content: json("RefundRequest") },
          responses: {
            "200": { description: "The refund sale", content: json("SaleStatusV1") },
            "400": err("invalid_request"),
            "404": err("original_not_found / unit_not_found"),
            "409": err("idempotency_conflict / external_ref_conflict"),
            "422": err("refund_exceeds_original / original_is_refund"),
            ...COMMON,
          },
        },
      },
      "/v1/closings": {
        get: {
          operationId: "listClosings",
          summary: "Daily totals of this integration's sales (closings:read). Day = calendar day in Europe/Prague by soldAt.",
          parameters: [q("unitId", "Unit id.", { type: "string", format: "uuid" }), q("from", "YYYY-MM-DD (default today)."), q("to", "YYYY-MM-DD (default = from, at most 62 days).")],
          responses: { "200": { description: "OK", content: json("Closings") }, "400": err("invalid_request"), "404": err("unit_not_found"), ...COMMON },
        },
      },
    },
  };
}
