import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { PAYMENT_METHODS, SaleValidationError, buildSale, deadlineFor, evidencedAmounts } from "@ez/fiscal-core";
import type { DeviceContext } from "./auth";
import { markIngested, quarantineSale } from "./quarantine";

/** Tržba tak, jak ji posílá pokladna (částky v haléřích). */
export const DeviceSaleSchema = z.object({
  id: z.string().uuid(),
  sequence: z.string().min(1).max(25),
  soldAt: z.string().datetime({ offset: true }),
  unitId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  lines: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        qty: z.number().finite().refine((v) => v !== 0 && Math.abs(v) <= 10_000),
        unitPrice: z.number().int().min(-100_000_000_00).max(100_000_000_00),
        vatRate: z.number().int().min(0).max(30),
        kind: z.enum(["goods", "prepayment"]).optional(),
      }),
    )
    .min(1)
    .max(300),
  payments: z
    .array(z.object({ method: z.enum(PAYMENT_METHODS), amount: z.number().int() }))
    .min(1)
    .max(5),
  discount: z.number().int().min(0).optional(),
  tip: z.number().int().min(0).optional(),
  refundOf: z.string().uuid().nullable().optional(),
  /** režim v okamžiku prodeje – tržba se odesílá jen v něm (Р3), nikdy podle aktuálního režimu účtu */
  mode: z.enum(["mock", "playground", "production"]),
});
export type DeviceSale = z.infer<typeof DeviceSaleSchema>;

export type IngestResult =
  | { id: string; ok: true }
  | {
      id: string;
      ok: false;
      /** true = dočasná chyba serveru, pokladna tržbu pošle znovu sama */
      retryable: boolean;
      /** true = server tržbu uložil do karantény a čeká na vlastníka */
      quarantined: boolean;
      code: string;
      error: string;
      httpStatus?: number;
    };

/** Trvalé odmítnutí kvůli datům tržby → karanténa (nikdy zahození). */
export class IngestRejection extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 422,
  ) {
    super(message);
  }
}

const MAX_FUTURE_MS = 10 * 60_000;
const MAX_PAST_MS = 45 * 86_400_000;

/** Stabilní JSON (seřazené klíče) – jsonb v Postgresu pořadí klíčů nezachovává. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

/**
 * Uloží tržby z pokladny. Idempotentní: stejné `id` se stejným obsahem se uloží jen jednou.
 * Trvalé problémy (datum, jednotka, konflikt) jdou do karantény; dočasné chyby serveru vrací
 * `retryable: true`, aby je pokladna poslala znovu. Žádná tržba se tiše neztratí (Р2).
 */
export async function ingestSales(ctx: DeviceContext, inputs: DeviceSale[]): Promise<IngestResult[]> {
  const db = getDb();
  const { device, account } = ctx;
  const unitIds = [...new Set(inputs.map((i) => i.unitId))];
  const units = unitIds.length
    ? await db
        .select()
        .from(schema.evidenceUnits)
        .where(and(eq(schema.evidenceUnits.accountId, account.id), inArray(schema.evidenceUnits.id, unitIds)))
    : [];
  const unitById = new Map(units.map((u) => [u.id, u]));
  const results: IngestResult[] = [];

  for (const input of inputs) {
    const mode = input.mode;
    try {
      const soldAtMs = Date.parse(input.soldAt);
      if (soldAtMs - Date.now() > MAX_FUTURE_MS) throw new IngestRejection("FUTURE_DATE", "Datum tržby je v budoucnosti – zkontrolujte čas v zařízení.");
      if (Date.now() - soldAtMs > MAX_PAST_MS) throw new IngestRejection("TOO_OLD", "Tržba je starší než 45 dní.");
      const unit = unitById.get(input.unitId);
      if (!unit) throw new IngestRejection("UNKNOWN_UNIT", "Neznámá evidenční jednotka");
      if (mode !== "mock" && !unit.fsUnitId) throw new IngestRejection("UNIT_WITHOUT_FS_ID", "Evidenční jednotka nemá číslo přidělené Finanční správou");

      let sale;
      try {
        sale = buildSale({
          id: input.id,
          deviceId: device.id,
          registerId: device.registerId,
          unitId: String(unit.fsUnitId ?? 1),
          sequence: input.sequence,
          soldAt: input.soldAt,
          lines: input.lines,
          payments: input.payments,
          discount: input.discount,
          tip: input.tip,
          refundOf: input.refundOf ?? null,
          vatPayer: account.vatPayer,
          mode: mode === "production" ? "production" : "test",
          cashierId: input.staffId ?? null,
        });
      } catch (e) {
        if (e instanceof SaleValidationError) throw new IngestRejection("INVALID_SALE", e.issues.join("; "));
        throw e;
      }
      const amounts = evidencedAmounts(sale);

      let inserted: { id: string }[];
      try {
        inserted = await db
          .insert(schema.sales)
          .values({
            id: sale.id,
            accountId: account.id,
            deviceId: device.id,
            unitId: unit.id,
            staffId: input.staffId ?? null,
            registerId: sale.registerId,
            fsUnitId: unit.fsUnitId ?? 1,
            sequence: sale.sequence,
            soldAt: new Date(sale.soldAt),
            total: sale.total,
            tip: sale.tip,
            discount: sale.discount,
            payments: sale.payments,
            items: sale.lines,
            vatBreakdown: sale.vat,
            refundOf: sale.refundOf,
            evidencedTotal: amounts.total,
            prepaymentAmount: amounts.prepayment,
            redeemedAmount: amounts.redeemed,
            status: amounts.total === 0 ? "not_required" : "queued",
            mode,
            deadlineAt: deadlineFor(sale.soldAt),
          })
          .onConflictDoNothing({ target: schema.sales.id })
          .returning({ id: schema.sales.id });
      } catch (e) {
        // unikátní (zařízení, pořadové číslo) → jiná tržba už má toto číslo: trvalý konflikt
        if (/sales_device_seq_uq/.test(errorText(e))) throw new IngestRejection("SEQUENCE_CONFLICT", "Pořadové číslo už bylo použito jinou tržbou", 409);
        throw e;
      }

      if (!inserted.length) {
        const existing = await db.query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
        if (!existing || existing.accountId !== account.id || existing.deviceId !== device.id) {
          throw new IngestRejection("ID_CONFLICT", "Konflikt identifikátoru tržby", 409);
        }
        // Stejné id musí znamenat stejnou tržbu – jinak jde o konflikt, ne o „už máme“.
        const same =
          existing.sequence === sale.sequence &&
          existing.soldAt.getTime() === Date.parse(sale.soldAt) &&
          existing.total === sale.total &&
          existing.tip === sale.tip &&
          existing.discount === sale.discount &&
          existing.unitId === unit.id &&
          existing.mode === mode &&
          (existing.refundOf ?? null) === (sale.refundOf ?? null) &&
          stable(existing.payments) === stable(sale.payments) &&
          stable(existing.items) === stable(sale.lines);
        if (!same) throw new IngestRejection("CONTENT_CONFLICT", "Tržba se stejným identifikátorem už existuje s jiným obsahem", 409);
      }
      await markIngested(account.id, sale.id);
      results.push({ id: sale.id, ok: true });
    } catch (e) {
      if (e instanceof IngestRejection) {
        try {
          await quarantineSale(ctx, input, e.code, e.message);
          results.push({ id: input.id, ok: false, retryable: false, quarantined: true, code: e.code, error: e.message, httpStatus: e.httpStatus });
        } catch {
          // ani karanténu nešlo uložit → pokladna musí tržbu držet a poslat znovu
          results.push({ id: input.id, ok: false, retryable: true, quarantined: false, code: "TEMPORARY", error: "Server je dočasně nedostupný, tržba se odešle znovu." });
        }
        continue;
      }
      console.error("[ingest] dočasná chyba", { saleId: input.id, error: errorName(e) });
      results.push({ id: input.id, ok: false, retryable: true, quarantined: false, code: "TEMPORARY", error: "Server je dočasně nedostupný, tržba se odešle znovu." });
    }
  }
  return results;
}

function errorText(e: unknown): string {
  const cause = (e as { cause?: unknown })?.cause;
  return `${e instanceof Error ? e.message : String(e)} ${cause instanceof Error ? cause.message : ""} ${(cause as { constraint?: string })?.constraint ?? ""} ${(e as { constraint_name?: string })?.constraint_name ?? ""}`;
}

/** Do logu jen druh chyby – žádné parametry SQL ani data tržby (Р6). */
function errorName(e: unknown): string {
  const cause = (e as { cause?: { code?: string } })?.cause;
  return `${e instanceof Error ? e.name : typeof e}${cause?.code ? ` ${cause.code}` : ""}`;
}
