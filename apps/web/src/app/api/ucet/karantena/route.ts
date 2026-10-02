import { QUARANTINE_REASON_TEXT, listQuarantine } from "@/lib/server/quarantine";
import { ownerRoute } from "@/lib/server/route-helpers";

/** Tržby v karanténě – čekají na rozhodnutí vlastníka (Р2). */
export const GET = ownerRoute(async ({ accountId }) => {
  const rows = await listQuarantine(accountId);
  return Response.json({
    items: rows.map((r) => {
      const p = r.payload as { sequence?: string; soldAt?: string; payments?: { amount: number }[]; mode?: string };
      return {
        id: r.id,
        reasonCode: r.reasonCode,
        reason: QUARANTINE_REASON_TEXT[r.reasonCode] ?? r.reason,
        detail: r.reason,
        sequence: p.sequence ?? null,
        soldAt: p.soldAt ?? null,
        total: (p.payments ?? []).reduce((a, x) => a + (Number.isFinite(x.amount) ? x.amount : 0), 0),
        mode: p.mode ?? null,
        receivedAt: r.receivedAt.toISOString(),
        attempts: r.attempts,
      };
    }),
  });
});
