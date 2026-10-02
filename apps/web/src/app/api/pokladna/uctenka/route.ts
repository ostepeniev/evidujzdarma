import { after } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { formatCzk, renderReceiptText } from "@ez/fiscal-core";
import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { ownerEmails } from "@/lib/server/owners";
import { rateLimit } from "@/lib/server/rate-limit";
import { loadReceipt } from "@/lib/server/receipts";

const Body = z.object({ saleId: z.string().uuid(), email: z.string().trim().email().max(254) });

/** Ostrý certifikát účtu vydaný na jeho vlastní EIČ – jen pak smí účtenky chodit třetím osobám. */
async function hasOwnProductionCertificate(account: typeof schema.accounts.$inferSelect): Promise<boolean> {
  const eic = account.eic ?? account.dic;
  if (!eic) return false;
  const cert = await getDb().query.certificates.findFirst({
    where: and(
      eq(schema.certificates.accountId, account.id),
      eq(schema.certificates.environment, "production"),
      eq(schema.certificates.eic, eic),
      isNull(schema.certificates.revokedAt),
      gt(schema.certificates.validTo, new Date()),
    ),
  });
  return !!cert;
}

/** Pošle účtenku zákazníkovi e-mailem. */
export async function POST(req: Request) {
  try {
    const { account } = await authenticateDevice(req);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Zadejte platný e-mail.");
    const sale = await getDb().query.sales.findFirst({ where: eq(schema.sales.id, body.data.saleId) });
    if (!sale || sale.accountId !== account.id) throw new HttpError(404, "Tržba nenalezena (možná ještě není synchronizovaná).");
    // Účtenky nesmí sloužit k rozesílání spamu z našeho serveru (R3.8)
    const to = body.data.email.toLowerCase();
    const owners = (await ownerEmails(account.id)).map((e) => e.toLowerCase());
    if (!owners.includes(to)) {
      if (sale.mode !== "production") throw new HttpError(403, "V ukázkovém a testovacím režimu lze účtenku poslat jen na e-mail vlastníka účtu.");
      if (!(await hasOwnProductionCertificate(account))) {
        throw new HttpError(403, "Účtenku zákazníkovi lze poslat jen v ostrém provozu s pokladním certifikátem vydaným na EIČ vaší firmy.");
      }
    }
    if (!rateLimit(`receipt:${account.id}`, 60, 3600)) throw new HttpError(429, "Příliš mnoho e-mailů za hodinu.");
    if (!rateLimit(`receipt-to:${to}`, 5, 86_400)) throw new HttpError(429, "Na tuto adresu už dnes odešlo příliš mnoho účtenek.");
    if (!rateLimit("receipt-global", 2000, 3600)) throw new HttpError(429, "Odesílání účtenek je dočasně omezené. Zkuste to prosím později.");
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
