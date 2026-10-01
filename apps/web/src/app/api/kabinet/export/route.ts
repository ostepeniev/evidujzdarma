import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { decimalString } from "@ez/fiscal-core";
import { errorResponse, getCurrentUser } from "@/lib/server/auth";
import { linkedClientAccounts, requireAccountant } from "@/lib/server/cabinet";

const num = (h: number) => decimalString(h).replace(".", ",");
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Export tržeb všech propojených klientů (jen ostrý provoz). */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountant(await getCurrentUser());
    const url = new URL(req.url);
    const from = url.searchParams.get("od") ?? new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
    const to = url.searchParams.get("do") ?? new Date().toISOString().slice(0, 10);
    const clients = await linkedClientAccounts(accountId);
    const byAccount = new Map(clients.map((c) => [c.accountId, c]));
    const rows = clients.length
      ? await getDb()
          .select()
          .from(schema.sales)
          .where(
            and(
              inArray(
                schema.sales.accountId,
                clients.map((c) => c.accountId),
              ),
              eq(schema.sales.mode, "production"),
              gte(schema.sales.soldAt, new Date(`${from}T00:00:00+01:00`)),
              lt(schema.sales.soldAt, new Date(new Date(`${to}T00:00:00+01:00`).getTime() + 86_400_000)),
            ),
          )
          .orderBy(asc(schema.sales.accountId), asc(schema.sales.soldAt))
      : [];
    const fmt = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Prague" });
    const head = ["IČO klienta", "Klient", "Datum a čas", "Pokladna", "Pořadové číslo", "Celkem", "Hotovost", "Karta", "QR", "Poukaz", "Převod", "Evidovaná částka", "POK", "Stav"];
    const lines = rows.map((s) => {
      const c = byAccount.get(s.accountId);
      const sum = (m: string) => s.payments.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
      return [c?.ico, c?.label, fmt.format(s.soldAt), s.registerId, s.sequence, num(s.total), num(sum("cash")), num(sum("card")), num(sum("qr")), num(sum("voucher")), num(sum("transfer")), num(s.evidencedTotal), s.confirmationCode, s.status]
        .map(cell)
        .join(";");
    });
    return new Response("﻿" + [head.join(";"), ...lines].join("\r\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="trzby-klientu-${from}-${to}.csv"` },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
