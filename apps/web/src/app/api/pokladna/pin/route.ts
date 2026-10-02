import { z } from "zod";
import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { verifyStaffPinOnline } from "@/lib/server/staff-pin";

const Body = z.object({ staffId: z.string().uuid(), pin: z.string().regex(/^\d{4,8}$/), purpose: z.enum(["unlock", "refund"]) });

/** Ověření PINu vlastníka na serveru (přihlášení do pokladny, schválení vratky) – R3.10. */
export async function POST(req: Request) {
  try {
    const ctx = await authenticateDevice(req);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Neplatný požadavek");
    return Response.json({ ok: true, ...(await verifyStaffPinOnline(ctx, body.data.staffId, body.data.pin, body.data.purpose)) });
  } catch (e) {
    return errorResponse(e);
  }
}
