import { getDb, schema } from "@ez/db";
import { EET_ENDPOINTS } from "@ez/fiscal-core";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { SITE, absoluteUrl } from "@/lib/site";
import { classifyProbe, hourlyLatency, incidents, transition, uptimePercent, type FsEnvironment, type Incident, type Probe } from "@/lib/fs-status";
import { enqueueEmail } from "./mail";

const ENVIRONMENTS: FsEnvironment[] = ["production", "playground"];
const INTERVAL_MS = Number(process.env.FS_PROBE_INTERVAL_SEC ?? 300) * 1000;
const TIMEOUT_MS = 10_000;
const RETENTION_DAYS = 90;

type ProbeResult = { httpStatus: number | null; latencyMs: number | null; error: string | null };

/**
 * Jedno měření: GET na adresu služby (bez podepsané zprávy, aby měření nezatěžovalo evidenci).
 * Měří se dostupnost a doba odezvy serveru FS, ne zpracování tržeb.
 */
export async function probe(environment: FsEnvironment, fetchImpl: typeof fetch = fetch): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const res = await fetchImpl(`${EET_ENDPOINTS[environment]}?wsdl`, {
      method: "GET",
      headers: { "user-agent": `${SITE.name}-monitor/1.0 (+${absoluteUrl("/stav-eet")})` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // tělo nepotřebujeme, jen uvolnit spojení
    await res.body?.cancel().catch(() => undefined);
    return { httpStatus: res.status, latencyMs: Math.round(performance.now() - started), error: null };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "TimeoutError" ? `timeout ${TIMEOUT_MS / 1000} s` : e.message) : String(e);
    return { httpStatus: null, latencyMs: null, error: msg.slice(0, 200) };
  }
}

/** Volá cron každou minutu; samo hlídá interval (výchozí 5 min). */
export async function runFsProbes(now = new Date()): Promise<{ probed: string[] } | { skipped: true }> {
  if (process.env.FS_MONITOR === "0") return { skipped: true };
  const [last] = await getDb().select({ at: schema.fsProbes.checkedAt }).from(schema.fsProbes).orderBy(desc(schema.fsProbes.checkedAt)).limit(1);
  if (last && now.getTime() - last.at.getTime() < INTERVAL_MS - 15_000) return { skipped: true };

  const results = await Promise.all(ENVIRONMENTS.map(async (env) => ({ env, r: await probe(env) })));
  await getDb().insert(schema.fsProbes).values(
    results.map(({ env, r }) => ({
      environment: env,
      checkedAt: now,
      status: classifyProbe(r),
      latencyMs: r.latencyMs,
      httpStatus: r.httpStatus,
      error: r.error,
    })),
  );

  await alertOnTransition("production");
  // úklid starých měření jednou za čas (levné – index na checked_at)
  if (now.getMinutes() < 5) {
    await getDb().delete(schema.fsProbes).where(lt(schema.fsProbes.checkedAt, new Date(now.getTime() - RETENTION_DAYS * 86_400_000)));
  }
  return { probed: results.map(({ env, r }) => `${env}:${classifyProbe(r)}`) };
}

async function alertOnTransition(environment: FsEnvironment) {
  const last = await recentProbes(environment, 3);
  const t = transition(last);
  if (!t) return;
  const since = last[1]!.checkedAt;
  await enqueueEmail({
    to: SITE.email,
    template: "notice",
    payload: {
      subject: t === "down" ? `⚠️ EET (${environment}) nedostupné` : `✅ EET (${environment}) opět funguje`,
      text:
        t === "down"
          ? `Rozhraní EET neodpovídá od ${since.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })} (2 měření po sobě).\nPoslední chyba: ${last[0]!.error ?? `HTTP ${last[0]!.httpStatus}`}\n\nPokladny tržby ukládají a odešlou je po obnovení. Zkontrolujte frontu neodeslaných tržeb.`
          : `Rozhraní EET znovu odpovídá (${last[0]!.latencyMs} ms). Fronta neodeslaných tržeb se zpracuje v dalším běhu cronu.`,
      url: absoluteUrl("/stav-eet"),
      buttonLabel: "Stav EET",
    },
  });
}

export async function recentProbes(environment: FsEnvironment, limit: number): Promise<Probe[]> {
  return getDb()
    .select({
      checkedAt: schema.fsProbes.checkedAt,
      status: schema.fsProbes.status,
      latencyMs: schema.fsProbes.latencyMs,
      httpStatus: schema.fsProbes.httpStatus,
      error: schema.fsProbes.error,
    })
    .from(schema.fsProbes)
    .where(eq(schema.fsProbes.environment, environment))
    .orderBy(desc(schema.fsProbes.checkedAt))
    .limit(limit) as Promise<Probe[]>;
}

export async function probesSince(environment: FsEnvironment, since: Date): Promise<Probe[]> {
  return getDb()
    .select({
      checkedAt: schema.fsProbes.checkedAt,
      status: schema.fsProbes.status,
      latencyMs: schema.fsProbes.latencyMs,
      httpStatus: schema.fsProbes.httpStatus,
    })
    .from(schema.fsProbes)
    .where(and(eq(schema.fsProbes.environment, environment), gte(schema.fsProbes.checkedAt, since)))
    .orderBy(asc(schema.fsProbes.checkedAt)) as Promise<Probe[]>;
}

/**
 * Upozornění provozovatele na tržby bez POK starší než hodinu (ostrý provoz i Playground).
 * Volá se jednou za hodinu (s připomínkami), aby schránka nezahltila.
 */
export async function alertStaleSales(now = new Date()): Promise<{ stale: number }> {
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const [row] = await getDb()
    .select({
      n: sql<number>`count(*)::int`,
      accounts: sql<number>`count(distinct ${schema.sales.accountId})::int`,
      oldest: sql<Date | null>`min(${schema.sales.soldAt})`,
    })
    .from(schema.sales)
    .where(
      and(
        sql`${schema.sales.status} in ('queued','sending')`,
        lt(schema.sales.soldAt, hourAgo),
        // po lhůtě 48 h (+ rezerva) už upozornění nepomůže – řeší je připomínky klientům, ne hodinový poplach
        gte(schema.sales.soldAt, new Date(now.getTime() - 72 * 3_600_000)),
        sql`${schema.sales.mode} <> 'mock'`,
      ),
    );
  const n = row?.n ?? 0;
  if (n > 0) {
    const oldest = row?.oldest ? new Date(row.oldest) : null;
    await enqueueEmail({
      to: SITE.email,
      template: "notice",
      payload: {
        subject: `⚠️ ${n} tržeb bez POK déle než hodinu`,
        text: `Tržeb bez potvrzení (POK) starších než 1 hodina: ${n} u ${row?.accounts ?? 0} účtů.\nNejstarší: ${oldest ? oldest.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" }) : "—"}.\n\nLhůta pro odeslání je 48 hodin od přijetí platby. Zkontrolujte stav EET a chyby u tržeb.`,
        url: absoluteUrl("/stav-eet"),
        buttonLabel: "Stav EET",
      },
    });
  }
  return { stale: n };
}

export interface EnvSummary {
  environment: FsEnvironment;
  latest: Probe | null;
  uptime: { h24: number | null; d7: number | null; d30: number | null };
  hourly: ReturnType<typeof hourlyLatency>;
  incidents: Incident[];
}

/** Souhrn pro veřejnou stránku /stav-eet a /api/stav-eet. */
export async function statusSummary(now = new Date()): Promise<EnvSummary[]> {
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  return Promise.all(
    ENVIRONMENTS.map(async (environment) => {
      const probes = await probesSince(environment, d30);
      const latest = probes.at(-1) ?? null;
      return {
        environment,
        latest,
        uptime: {
          h24: uptimePercent(probes, new Date(now.getTime() - 86_400_000)),
          d7: uptimePercent(probes, new Date(now.getTime() - 7 * 86_400_000)),
          d30: uptimePercent(probes, d30),
        },
        hourly: hourlyLatency(probes, now, 24),
        incidents: incidents(probes).slice(0, 20),
      };
    }),
  );
}
