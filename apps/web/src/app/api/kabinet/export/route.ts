import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { decimalString } from "@ez/fiscal-core";
import { csvCell } from "@/lib/csv";
import { DAY_RE, pragueDayRange, pragueToday } from "@/lib/prague-time";
import { errorResponse, getCurrentUser } from "@/lib/server/auth";
import { linkedClientAccounts, requireAccountant } from "@/lib/server/cabinet";

const num = (h: number) => decimalString(h).replace(".", ",");

/** Export tržeb všech propojených klientů (jen ostrý provoz). */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountant(await getCurrentUser());
    const url = new URL(req.url);
    const from = url.searchParams.get("od") ?? pragueToday(new Date(Date.now() - 31 * 86_400_000));
    const to = url.searchParams.get("do") ?? pragueToday();
    if (!DAY_RE.test(from) || !DAY_RE.test(to)) return Response.json({ error: "Datum ve tvaru RRRR-MM-DD" }, { status: 400 });
    const range = pragueDayRange(from, to);
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
              gte(schema.sales.soldAt, range.start),
              lt(schema.sales.soldAt, range.end),
            ),
          )
          .orderBy(asc(schema.sales.accountId), asc(schema.sales.soldAt))
      : [];
    const fmt = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Prague" });
    // nové sloupce poukazů (R5.10) až na konec, ať stávající importy účetních nesednou vedle
    const head = ["IČO klienta", "Klient", "Datum a čas", "Pokladna", "Pořadové číslo", "Celkem", "Hotovost", "Karta", "QR", "Poukaz", "Převod", "Evidovaná částka", "POK", "Stav", "Stravenka", "Kredit", "Dárkový poukaz"];
    const lines = rows.map((s) => {
      const c = byAccount.get(s.accountId);
      const sum = (m: string) => s.payments.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
      return [c?.ico, c?.label, fmt.format(s.soldAt), s.registerId, s.sequence, num(s.total), num(sum("cash")), num(sum("card")), num(sum("qr")), num(sum("voucher")), num(sum("transfer")), num(s.evidencedTotal), s.confirmationCode, s.status, num(sum("meal_voucher")), num(sum("credit")), num(sum("gift_voucher"))]
        .map(csvCell)
        .join(";");
    });
    return new Response("﻿" + [head.join(";"), ...lines].join("\r\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="trzby-klientu-${from}-${to}.csv"` },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
