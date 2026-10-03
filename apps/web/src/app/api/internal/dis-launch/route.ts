import { z } from "zod";
import { hasDatabase } from "@ez/db";
import { queueDisLaunch } from "@/lib/server/preregistration";
import { safeEqual } from "@/lib/server/tokens";

const Body = z.object({ confirm: z.literal(true) });

/**
 * Provozovatel (R7.6): po ověření, že Finanční správa DIS+ skutečně spustila, zařadí e-mail dis-launch
 * potvrzeným adresám se souhlasem. Chráněno CRON_SECRET; reverse proxy /api/internal/* navenek neposílá.
 *   curl -X POST http://127.0.0.1:3100/api/internal/dis-launch -H "authorization: Bearer $CRON_SECRET" \
 *     -H "content-type: application/json" -d '{"confirm":true}'
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  if (!hasDatabase()) return Response.json({ error: "no database" }, { status: 503 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'Pošlete {"confirm": true} – e-mail tvrdí, že DIS+ je spuštěné.' }, { status: 400 });
  return Response.json({ queued: await queueDisLaunch() });
}
