import { z } from "zod";
import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { processSale, salesStatus } from "@/lib/server/fiscal";
import { DeviceSaleSchema, ingestSales } from "@/lib/server/sales";

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
    const invalid = parsed.flatMap((p, i) =>
      p.success ? [] : [{ id: String((body.data.sales[i] as { id?: unknown })?.id ?? i), ok: false, error: p.error.issues[0]?.message ?? "Neplatná tržba" }],
    );
    const results = [...(await ingestSales(ctx, valid)), ...invalid];

    const started = Date.now();
    for (const r of results) {
      if (!r.ok) continue;
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
    return Response.json({ statuses: await salesStatus(ids, ctx.account.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
