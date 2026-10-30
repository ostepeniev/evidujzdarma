import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import type { ReceiptData } from "@ez/fiscal-core";
import { absoluteUrl } from "@/lib/site";
import { hmac, safeEqual } from "./tokens";

type SaleRow = typeof schema.sales.$inferSelect;
type AccountRow = typeof schema.accounts.$inferSelect;
type UnitRow = typeof schema.evidenceUnits.$inferSelect;

/**
 * Klíč online účtenky tržby z EET API (S8, rozd. 4): id tržby volí cizí systém a nemusí být náhodné UUID v4,
 * takže samo id účtenku nechrání. Účtenky z pokladny klíč nepotřebují (id generuje pokladna náhodně).
 */
export function receiptKey(saleId: string): string {
  return hmac(`receipt:${saleId.toLowerCase()}`).slice(0, 32);
}

/** Odkaz na online účtenku – u tržby z API s klíčem. */
export function receiptUrl(sale: Pick<SaleRow, "id" | "integrationId">): string {
  return absoluteUrl(`/u/${sale.id}${sale.integrationId ? `?k=${receiptKey(sale.id)}` : ""}`);
}

/** Data účtenky z řádků DB – sdílí online účtenka (/u/[id]), e-mail i EET API (ReceiptFiscalV1). */
export function receiptDataFrom(sale: SaleRow, account: AccountRow, unit: UnitRow | undefined): ReceiptData {
  const subtotal = sale.total - sale.tip;
  return {
    merchant: {
      name: account.name,
      dic: account.dic,
      ico: account.ico,
      address: unit?.address ?? null,
      unitLabel: unit?.label ?? "",
      header: account.receiptHeader,
      footer: account.receiptFooter,
    },
    sale: {
      id: sale.id,
      registerId: sale.registerId,
      unitId: String(sale.fsUnitId),
      sequence: sale.sequence,
      soldAt: sale.soldAt.toISOString(),
      lines: sale.items ?? [],
      payments: sale.payments as ReceiptData["sale"]["payments"],
      discount: sale.discount,
      tip: sale.tip,
      subtotal,
      total: sale.total,
      vat: sale.vatBreakdown,
      refundOf: sale.refundOf,
    },
    fiscal: {
      confirmationCode: sale.confirmationCode,
      securityCode: null,
      mode: sale.mode === "production" ? "production" : "test",
      environment: sale.mode === "production" || sale.mode === "playground" ? sale.mode : "mock",
      status: sale.status,
      showCode: account.receiptShowPok,
    },
    url: receiptUrl(sale),
  };
}

/** Data účtenky pro online zobrazení a e-mail. `id` tržby je náhodné UUID (nelze ho uhodnout); tržba z API chce i klíč. */
export async function loadReceipt(saleId: string, key?: string): Promise<ReceiptData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) return null;
  const db = getDb();
  const sale = await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) });
  if (!sale) return null;
  if (sale.integrationId && !(key && safeEqual(key, receiptKey(sale.id)))) return null;
  const [account, unit] = await Promise.all([
    db.query.accounts.findFirst({ where: eq(schema.accounts.id, sale.accountId) }),
    sale.unitId ? db.query.evidenceUnits.findFirst({ where: eq(schema.evidenceUnits.id, sale.unitId) }) : undefined,
  ]);
  if (!account) return null;
  return receiptDataFrom(sale, account, unit);
}
