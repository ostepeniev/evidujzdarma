import { hasDatabase } from "@ez/db";
import { processPending } from "@/lib/server/fiscal";
import { alertStaleSales, runFsProbes } from "@/lib/server/fs-monitor";
import { runRetention } from "@/lib/server/lifecycle";
import { processOutbox } from "@/lib/server/mail";
import { runReminders } from "@/lib/server/reminders";
import { safeEqual } from "@/lib/server/tokens";

export const maxDuration = 120;

/**
 * Plánované úlohy (volá worker každou minutu): opakované odeslání tržeb, e-maily, připomínky,
 * měření dostupnosti EET (samo hlídá 5min interval) a hodinová kontrola tržeb bez POK.
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
  // Monitor nesmí shodit odesílání tržeb ani e-mailů
  out.fs = await runFsProbes().catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
  if (url.searchParams.get("reminders") === "1") {
    out.reminders = await runReminders();
    out.stale = await alertStaleSales().catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
    // doby uložení ze zásad ochrany osobních údajů (R2.5)
    out.retention = await runRetention().catch((e: unknown) => ({ error: e instanceof Error ? e.name : String(e) }));
  }
  out.emails = await processOutbox(50);
  return Response.json(out);
}
