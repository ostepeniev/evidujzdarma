import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { PAYMENT_METHODS, SaleValidationError, buildSale, deadlineFor, evidencedAmounts } from "@ez/fiscal-core";
import type { DeviceContext } from "./auth";

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

export interface IngestResult {
  id: string;
  ok: boolean;
  error?: string;
}

const MAX_FUTURE_MS = 10 * 60_000;
const MAX_PAST_MS = 45 * 86_400_000;

/**
 * Uloží tržby z pokladny. Idempotentní: stejné `id` se uloží jen jednou, opakované
 * odeslání z offline fronty nic nezdvojí. Vrací výsledek pro každou tržbu.
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
      if (soldAtMs - Date.now() > MAX_FUTURE_MS) throw new Error("Datum tržby je v budoucnosti – zkontrolujte čas v zařízení.");
      if (Date.now() - soldAtMs > MAX_PAST_MS) throw new Error("Tržba je starší než 45 dní.");
      const unit = unitById.get(input.unitId);
      if (!unit) throw new Error("Neznámá evidenční jednotka");
      if (mode !== "mock" && !unit.fsUnitId) throw new Error("Evidenční jednotka nemá číslo přidělené Finanční správou");

      const sale = buildSale({
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
      const amounts = evidencedAmounts(sale);

      const inserted = await db
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
        .onConflictDoNothing()
        .returning({ id: schema.sales.id });

      if (!inserted.length) {
        // Už existuje — ověříme, že jde o stejnou pokladnu (ochrana proti kolizi UUID / sekvence).
        const existing = await db.query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
        if (!existing || existing.deviceId !== device.id) {
          const dup = await db.query.sales.findFirst({
            where: and(eq(schema.sales.deviceId, device.id), eq(schema.sales.sequence, sale.sequence)),
          });
          throw new Error(dup ? "Pořadové číslo už bylo použito jinou tržbou" : "Konflikt identifikátoru tržby");
        }
      }
      results.push({ id: sale.id, ok: true });
    } catch (e) {
      const msg = e instanceof SaleValidationError ? e.issues.join("; ") : e instanceof Error ? e.message : String(e);
      // porušení unikátního indexu (zařízení + pořadové číslo)
      const friendly = /sales_device_seq_uq/.test(msg) ? "Pořadové číslo už bylo použito" : msg;
      results.push({ id: input.id, ok: false, error: friendly });
    }
  }
  return results;
}
