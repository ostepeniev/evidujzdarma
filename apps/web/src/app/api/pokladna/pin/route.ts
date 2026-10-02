import { z } from "zod";
import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { verifyStaffPinOnline } from "@/lib/server/staff-pin";

const Body = z.object({
  staffId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/),
  purpose: z.enum(["unlock", "refund"]),
  // vratka: kterou tržbu a jakou částku (haléře, kladně) vlastník schvaluje (R5.5)
  refundOf: z.string().uuid().optional(),
  amount: z.number().int().positive().max(100_000_000).optional(),
});

/** Ověření PINu vlastníka na serveru (přihlášení do pokladny, schválení vratky) – R3.10. */
export async function POST(req: Request) {
  try {
    const ctx = await authenticateDevice(req);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Neplatný požadavek");
    const { staffId, pin, purpose, refundOf, amount } = body.data;
    if (purpose === "refund" && (!refundOf || !amount)) throw new HttpError(400, "Schválení vratky musí uvést tržbu a částku.");
    const refund = purpose === "refund" ? { refundOf: refundOf!, amount: amount! } : undefined;
    return Response.json({ ok: true, ...(await verifyStaffPinOnline(ctx, staffId, pin, purpose, refund)) });
  } catch (e) {
    return errorResponse(e);
  }
}
