import { z } from "zod";
import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { accountMode, processSale, salesStatus } from "@/lib/server/fiscal";
import { quarantineSale, quarantineStatuses } from "@/lib/server/quarantine";
import { DeviceSaleSchema, ingestSales, type IngestResult } from "@/lib/server/sales";

const Body = z.object({ sales: z.array(z.unknown()).min(1).max(100) });
/** Kolik času smí synchronizace strávit odesíláním do FS, než zbytek dořeší cron. */
const SEND_BUDGET_MS = 8_000;

export async function POST(req: Request) {
  try {
    const ctx = await authenticateDevice(req);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Neplatný požadavek");
    const parsed = body.data.sales.map((s) => DeviceSaleSchema.safeParse(s));
    const valid = parsed.flatMap((p) => (p.success ? [p.data] : []));
    // Neúplná data z pokladny se také nezahazují: s platným id jdou do karantény (Р2).
    const invalid: IngestResult[] = [];
    for (const [i, p] of parsed.entries()) {
      if (p.success) continue;
      const raw = body.data.sales[i] as { id?: unknown };
      const id = typeof raw?.id === "string" ? raw.id : String(i);
      const error = p.error.issues[0]?.message ?? "Neplatná tržba";
      if (/^[0-9a-f-]{36}$/i.test(id)) {
        await quarantineSale(ctx, raw, "INVALID_PAYLOAD", error);
        invalid.push({ id, ok: false, retryable: false, quarantined: true, code: "INVALID_PAYLOAD", error });
      } else invalid.push({ id, ok: false, retryable: false, quarantined: false, code: "INVALID_PAYLOAD", error });
    }
    const results = [...(await ingestSales(ctx, valid)), ...invalid];

    // Odeslat hned jen tržby, které přišly poprvé. Opakovaná synchronizace (další karta, tik
    // po 20 s) nesmí obejít backoff – frontu dál řídí cron (R1.8).
    const started = Date.now();
    for (const r of results) {
      if (!r.ok || !r.inserted) continue;
      if (Date.now() - started > SEND_BUDGET_MS) break;
      await processSale(r.id, ctx.account);
    }
    const statuses = await salesStatus(
      results.filter((r) => r.ok).map((r) => r.id),
      ctx.account.id,
    );
    const byId = new Map(statuses.map((s) => [s.id, s]));
    return Response.json({
      results: results.map((r) => ({ ...r, ...(byId.get(r.id) ?? {}) })),
      // pokladna podle toho pozná, že má staré nastavení, a před dalším prodejem ho načte (R5.1)
      accountMode: accountMode(ctx.account),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Stav dříve odeslaných tržeb (POK doplněný cronem po výpadku). */
export async function GET(req: Request) {
  try {
    const ctx = await authenticateDevice(req);
    const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
    const statuses = await salesStatus(ids, ctx.account.id);
    // tržby mimo evidenci: stav karantény (čeká na vlastníka / vyřízeno), ať je pokladna znovu neposílá (R5.7)
    const known = new Set(statuses.map((s) => s.id));
    const quarantined = await quarantineStatuses(ctx.account.id, ids.filter((id) => !known.has(id)));
    return Response.json({ statuses: [...statuses, ...quarantined], accountMode: accountMode(ctx.account) });
  } catch (e) {
    return errorResponse(e);
  }
}
