import { z } from "zod";
import { BLOCK_TEXT, processSale, requeueSales, salesNeedingAttention, salesStatus } from "@/lib/server/fiscal";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/** Tržby odmítnuté Finanční správou nebo zablokované (certifikát, EIČ…) – čekají na vlastníka (R1.3). */
export const GET = ownerRoute(async ({ accountId }) => {
  const rows = await salesNeedingAttention(accountId);
  return Response.json({
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      blockedReason: r.blockedReason,
      reason: r.blockedReason ? (BLOCK_TEXT[r.blockedReason] ?? r.blockedReason) : "Finanční správa tržbu odmítla.",
      detail: r.lastError,
      sequence: r.sequence,
      registerId: r.registerId,
      soldAt: r.soldAt.toISOString(),
      total: r.total,
      mode: r.mode,
      deadlineAt: r.deadlineAt.toISOString(),
    })),
  });
});

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

/** „Odeslat znovu“: vrátí tržby do fronty a hned se je pokusí odeslat. */
export const POST = ownerRoute(async ({ req, accountId }) => {
  const { ids } = await parseJson(req, Body);
  const requeued = await requeueSales(accountId, ids);
  let confirmed = 0;
  // jen vlastní tržby účtu, které jsou teď ve frontě
  const mine = (await salesStatus(ids, accountId)).filter((r) => r.status === "queued").map((r) => r.id);
  for (const id of mine.slice(0, 20)) {
    const row = await processSale(id);
    if (row?.status === "confirmed") confirmed++;
  }
  return Response.json({ requeued, confirmed });
});
