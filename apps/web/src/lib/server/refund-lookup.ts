import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import type { PaymentMethod, SaleLine } from "@ez/fiscal-core";
import type { RefundLookupDto } from "@/lib/pos/refund";
import { HttpError, type DeviceContext } from "./auth";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/**
 * S3-POKLADNA: dohledání dokladu pro vratku – i z jiného zařízení stejného účtu. Hledá se podle id tržby (i z odkazu
 * na online účtenku /u/…) nebo podle čísla dokladu (bez ohledu na velikost písmen). Jen v účtu tohoto zařízení.
 */
export async function findSaleForRefund(ctx: DeviceContext, query: string): Promise<RefundLookupDto> {
  const q = query.trim();
  if (!q || q.length > 200) throw new HttpError(400, "Zadejte číslo dokladu.");
  const db = getDb();
  const id = UUID_RE.exec(q)?.[0]?.toLowerCase();
  const where = id
    ? and(eq(schema.sales.accountId, ctx.account.id), eq(schema.sales.id, id))
    : and(eq(schema.sales.accountId, ctx.account.id), sql`lower(${schema.sales.sequence}) = lower(${q})`);
  const [row] = await db
    .select({ sale: schema.sales, unitLabel: schema.evidenceUnits.label })
    .from(schema.sales)
    .leftJoin(schema.evidenceUnits, eq(schema.evidenceUnits.id, schema.sales.unitId))
    .where(where)
    .orderBy(asc(schema.sales.soldAt))
    .limit(1);
  if (!row) throw new HttpError(404, "Doklad s tímto číslem jsme v účtu nenašli. Zkontrolujte číslo dokladu na účtence (např. P1-AB12-000123).");
  const s = row.sale;
  const refunds = await db
    .select({ id: schema.sales.id, sequence: schema.sales.sequence, soldAt: schema.sales.soldAt, items: schema.sales.items, payments: schema.sales.payments, total: schema.sales.total })
    .from(schema.sales)
    .where(and(eq(schema.sales.accountId, ctx.account.id), eq(schema.sales.refundOf, s.id)))
    .orderBy(asc(schema.sales.soldAt));
  const payments = (p: { method: string; amount: number }[]) => p.map((x) => ({ method: x.method as PaymentMethod, amount: x.amount }));
  return {
    sale: {
      id: s.id,
      sequence: s.sequence,
      soldAt: s.soldAt.toISOString(),
      registerId: s.registerId,
      unitId: s.unitId,
      unitLabel: row.unitLabel,
      lines: (s.items ?? []) as SaleLine[],
      payments: payments(s.payments),
      tip: s.tip,
      discount: s.discount,
      total: s.total,
      mode: s.mode as RefundLookupDto["sale"]["mode"],
      status: s.status,
      refundOf: s.refundOf,
    },
    refunds: refunds.map((r) => ({ id: r.id, sequence: r.sequence, soldAt: r.soldAt.toISOString(), lines: (r.items ?? []) as SaleLine[], payments: payments(r.payments), total: r.total })),
  };
}
