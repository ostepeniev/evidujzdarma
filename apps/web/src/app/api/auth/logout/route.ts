import { destroySession, errorResponse } from "@/lib/server/auth";
import { requireSameOrigin } from "@/lib/server/route-helpers";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req); // i mimo proxy.ts (Д3-8)
  } catch (e) {
    return errorResponse(e);
  }
  await destroySession();
  return Response.json({ ok: true });
}
