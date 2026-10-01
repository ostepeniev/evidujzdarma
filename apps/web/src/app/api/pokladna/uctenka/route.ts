import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { formatCzk, renderReceiptText } from "@ez/fiscal-core";
import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { rateLimit } from "@/lib/server/rate-limit";
import { loadReceipt } from "@/lib/server/receipts";

const Body = z.object({ saleId: z.string().uuid(), email: z.string().trim().email().max(254) });

/** Pošle účtenku zákazníkovi e-mailem. */
export async function POST(req: Request) {
  try {
    const { account } = await authenticateDevice(req);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Zadejte platný e-mail.");
    if (!rateLimit(`receipt:${account.id}`, 60, 3600)) throw new HttpError(429, "Příliš mnoho e-mailů za hodinu.");
    const sale = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, body.data.saleId) });
    if (!sale || sale.accountId !== account.id) throw new HttpError(404, "Tržba nenalezena (možná ještě není synchronizovaná).");
    const receipt = (await loadReceipt(sale.id))!;
    await enqueueEmail({
      to: body.data.email,
      template: "receipt",
      payload: { merchant: account.name, total: formatCzk(sale.total), receiptText: renderReceiptText(receipt, 42), url: receipt.url },
      dedupeKey: `receipt:${sale.id}:${body.data.email.toLowerCase()}`,
    });
    after(() => processOutbox(5));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
