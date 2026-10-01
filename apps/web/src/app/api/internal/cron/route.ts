import { hasDatabase } from "@ez/db";
import { processPending } from "@/lib/server/fiscal";
import { processOutbox } from "@/lib/server/mail";
import { runReminders } from "@/lib/server/reminders";
import { safeEqual } from "@/lib/server/tokens";

export const maxDuration = 120;

/**
 * Plánované úlohy (volá worker každou minutu): opakované odeslání tržeb, e-maily, připomínky.
 * Chráněno CRON_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  if (!hasDatabase()) return Response.json({ error: "no database" }, { status: 503 });
  const url = new URL(req.url);
  const out: Record<string, unknown> = {};
  out.sales = await processPending(100);
  if (url.searchParams.get("reminders") === "1") out.reminders = await runReminders();
  out.emails = await processOutbox(50);
  return Response.json(out);
}
