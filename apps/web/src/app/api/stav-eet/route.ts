import { hasDatabase } from "@ez/db";
import { statusSummary } from "@/lib/server/fs-monitor";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Strojově čitelný stav rozhraní EET (pro widgety partnerů a vývojáře). */
export async function GET() {
  if (!hasDatabase()) return Response.json({ error: "Služba je dočasně nedostupná" }, { status: 503 });
  const summary = await statusSummary();
  const body = {
    source: absoluteUrl("/stav-eet"),
    note: "Nezávislé měření EvidujZdarma, není provozováno Finanční správou. Měří se dostupnost serveru, ne zpracování tržeb.",
    environments: summary.map((s) => ({
      environment: s.environment,
      status: s.latest?.status ?? null,
      checkedAt: s.latest?.checkedAt.toISOString() ?? null,
      latencyMs: s.latest?.latencyMs ?? null,
      uptime: s.uptime,
      incidents: s.incidents.slice(0, 5).map((i) => ({ start: i.start.toISOString(), end: i.end?.toISOString() ?? null })),
    })),
  };
  return Response.json(body, {
    headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120", "access-control-allow-origin": "*" },
  });
}
