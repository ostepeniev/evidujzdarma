import { z } from "zod";
import { hasDatabase } from "@ez/db";
import { requeueInvalid } from "@/lib/server/fiscal";
import { safeEqual } from "@/lib/server/tokens";

const Body = z.object({ environment: z.enum(["playground", "production"]) });

/**
 * Provozovatel (R5.4): po opravě kotev důvěry / podpisu FS zruší pojistku prostředí a vrátí do fronty tržby
 * zastavené kvůli neověřitelným odpovědím. Chráněno CRON_SECRET; reverse proxy /api/internal/* navenek neposílá.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  if (!hasDatabase()) return Response.json({ error: "no database" }, { status: 503 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "environment: playground | production" }, { status: 400 });
  return Response.json(await requeueInvalid(body.data.environment));
}
