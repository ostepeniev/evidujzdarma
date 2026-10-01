import { sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@ez/db";

export const dynamic = "force-dynamic";

/** Kontrola stavu pro Docker / monitoring (Uptime Kuma, Better Stack…). */
export async function GET() {
  const checks: Record<string, string> = { app: "ok" };
  if (hasDatabase()) {
    try {
      await getDb().execute(sql`select 1`);
      checks.db = "ok";
    } catch {
      checks.db = "error";
    }
  }
  const ok = Object.values(checks).every((v) => v === "ok");
  return Response.json({ ok, checks, time: new Date().toISOString() }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
