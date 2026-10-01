import { z } from "zod";
import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { DeviceClosingSchema, DeviceMovementSchema, ingestCash } from "@/lib/server/closings";

const Body = z.object({
  movements: z.array(z.unknown()).max(200).default([]),
  closings: z.array(z.unknown()).max(50).default([]),
});

/** Synchronizace pohybů hotovosti a denních uzávěrek ze zařízení (idempotentní). */
export async function POST(req: Request) {
  try {
    const ctx = await authenticateDevice(req);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Neplatný požadavek");
    const errors: { id: string; error: string }[] = [];
    const pick = <T>(items: unknown[], schema: z.ZodType<T>): T[] =>
      items.flatMap((item) => {
        const r = schema.safeParse(item);
        if (r.success) return [r.data];
        errors.push({ id: String((item as { id?: unknown })?.id ?? "?"), error: r.error.issues[0]?.message ?? "Neplatná data" });
        return [];
      });
    const movements = pick(body.data.movements, DeviceMovementSchema);
    const closings = pick(body.data.closings, DeviceClosingSchema);
    const saved = await ingestCash(ctx, movements, closings);
    return Response.json({ ...saved, errors });
  } catch (e) {
    return errorResponse(e);
  }
}
