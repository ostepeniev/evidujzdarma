import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import type { ReceiptData } from "@ez/fiscal-core";
import { absoluteUrl } from "@/lib/site";

/** Data účtenky pro online zobrazení a e-mail. `id` tržby je náhodné UUID (nelze ho uhodnout). */
export async function loadReceipt(saleId: string): Promise<ReceiptData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) return null;
  const db = getDb();
  const sale = await db.query.sales.findFirst({ where: eq(schema.sales.id, saleId) });
  if (!sale) return null;
  const [account, unit] = await Promise.all([
    db.query.accounts.findFirst({ where: eq(schema.accounts.id, sale.accountId) }),
    sale.unitId ? db.query.evidenceUnits.findFirst({ where: eq(schema.evidenceUnits.id, sale.unitId) }) : undefined,
  ]);
  if (!account) return null;
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
      showCode: account.receiptShowPok,
    },
    url: absoluteUrl(`/u/${sale.id}`),
  };
}
