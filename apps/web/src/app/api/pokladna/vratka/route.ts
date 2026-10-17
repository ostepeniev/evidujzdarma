import { HttpError, authenticateDevice, errorResponse } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { findSaleForRefund } from "@/lib/server/refund-lookup";

/**
 * S3-POKLADNA: doklad k vratce podle čísla dokladu nebo id (i z jiné pokladny stejného účtu) a vratky, které k němu
 * už server má – pokladna z toho spočítá, co ještě jde vrátit. Číslo jde v query stringu jen tady (API pro zařízení
 * s tokenem, roboti sem nesmí – /api je v robots.txt zakázané).
 */
export async function GET(req: Request) {
  try {
    const ctx = await authenticateDevice(req);
    if (!rateLimit(`refund-lookup:${ctx.device.id}`, 120, 3600)) throw new HttpError(429, "Příliš mnoho hledání. Zkuste to prosím za chvíli.");
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return Response.json(await findSaleForRefund(ctx, q), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
