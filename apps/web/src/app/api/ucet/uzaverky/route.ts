import { buildCashBook, cashBookCsv, closingsForAccount } from "@/lib/server/closings";
import { DAY_RE, pragueDayRange, pragueToday } from "@/lib/prague-time";
import { ownerRoute } from "@/lib/server/route-helpers";

/**
 * Uzávěrky pokladen pro vlastníka: JSON přehled, nebo `?format=csv` pokladní kniha pro účetní.
 * Období `od`–`do` (YYYY-MM-DD, včetně) podle data uzávěrky.
 */
export const GET = ownerRoute(async ({ req, accountId }) => {
  const url = new URL(req.url);
  const today = pragueToday();
  const od = url.searchParams.get("od") ?? `${today.slice(0, 8)}01`;
  const doParam = url.searchParams.get("do") ?? today;
  if (!DAY_RE.test(od) || !DAY_RE.test(doParam)) return Response.json({ error: "Datum ve tvaru RRRR-MM-DD" }, { status: 400 });
  const { start: from, end: to } = pragueDayRange(od, doParam);
  const { closings, movements } = await closingsForAccount(accountId, from, to);

  if (url.searchParams.get("format") === "csv") {
    return new Response(cashBookCsv(buildCashBook(closings, movements)), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="pokladni-kniha-${od}-${doParam}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  return Response.json({
    closings: closings
      .slice()
      .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())
      .map((c) => ({
        id: c.id,
        number: c.number,
        registerId: c.registerId,
        closedAt: c.closedAt.toISOString(),
        staffName: c.staffName,
        expectedCash: c.expectedCash,
        countedCash: c.countedCash,
        difference: c.difference,
        cashOut: c.cashOut,
        closingCash: c.closingCash,
        gross: (c.totals as { gross: number }).gross,
        pending: (c.totals as { pending: number }).pending,
        note: c.note,
        mode: c.mode,
      })),
  });
});
