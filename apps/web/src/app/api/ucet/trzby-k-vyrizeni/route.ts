import { z } from "zod";
import { BLOCK_TEXT, processSale, rebuildSnapshots, requeueSales, salesNeedingAttention, salesStatus, salesWithWarnings } from "@/lib/server/fiscal";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/** Tržby odmítnuté Finanční správou nebo zablokované (certifikát, EIČ…) – čekají na vlastníka (R1.3). */
export const GET = ownerRoute(async ({ accountId }) => {
  const [rows, warned] = await Promise.all([salesNeedingAttention(accountId), salesWithWarnings(accountId)]);
  return Response.json({
    // upozornění FS (Varovani) k přijatým tržbám za 30 dní (A Дрібне 15)
    warnings: warned.map((w) => ({
      id: w.id,
      status: w.status,
      sequence: w.sequence,
      registerId: w.registerId,
      soldAt: w.soldAt.toISOString(),
      total: w.total,
      mode: w.mode,
      warnings: w.warnings ?? [],
    })),
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
      // určité odmítnutí FS → vlastník smí poslat s opraveným EIČ / číslem jednotky (R5.6; server to ověří znovu)
      correctable: r.status === "rejected" && /^EET_[23467]:/.test(r.lastError ?? ""),
    })),
  });
});

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(200), action: z.enum(["resend", "rebuild"]).default("resend") });

/**
 * „Odeslat znovu“: vrátí tržby do fronty (se stejným snímkem) a hned se je pokusí odeslat.
 * „rebuild“ = „Odeslat s opravenými údaji“ po určitém odmítnutí FS (Р3, R5.6).
 */
export const POST = ownerRoute(async ({ req, accountId }) => {
  const { ids, action } = await parseJson(req, Body);
  let skipped: { id: string; reason: string }[] = [];
  let requeued: number;
  if (action === "rebuild") {
    const r = await rebuildSnapshots(accountId, ids);
    requeued = r.rebuilt.length;
    skipped = r.skipped;
  } else requeued = await requeueSales(accountId, ids);
  let confirmed = 0;
  // jen vlastní tržby účtu, které jsou teď ve frontě
  const mine = (await salesStatus(ids, accountId)).filter((r) => r.status === "queued").map((r) => r.id);
  for (const id of mine.slice(0, 20)) {
    const row = await processSale(id);
    if (row?.status === "confirmed") confirmed++;
  }
  return Response.json({ requeued, confirmed, skipped });
});
