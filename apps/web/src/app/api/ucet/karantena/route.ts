import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { accountMode } from "@/lib/server/fiscal";
import { QUARANTINE_REASON_TEXT, canSendInMode, listQuarantine, sendDownRefused } from "@/lib/server/quarantine";
import { ownerRoute } from "@/lib/server/route-helpers";

/** Tržby v karanténě – čekají na rozhodnutí vlastníka (Р2). */
export const GET = ownerRoute(async ({ accountId }) => {
  const rows = await listQuarantine(accountId);
  const account = await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  const current = account ? accountMode(account) : "mock";
  return Response.json({
    // aktuální režim účtu – dialog „Odeslat v režimu …“ ho jmenuje (R6.1)
    accountMode: current,
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
        // „odeslat v aktuálním režimu“ jen směrem nahoru (R6.1)
        canSendCurrent: r.reasonCode === "MODE_MISMATCH" && canSendInMode(p.mode, current),
        sendRefused: r.reasonCode === "MODE_MISMATCH" && !canSendInMode(p.mode, current) ? sendDownRefused(p.mode) : null,
        receivedAt: r.receivedAt.toISOString(),
        attempts: r.attempts,
      };
    }),
  });
});
