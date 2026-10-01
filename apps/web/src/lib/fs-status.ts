/**
 * Monitor dostupnosti rozhraní EET – čistá logika (klasifikace měření, dostupnost, výpadky).
 * Sdílí ji cron (měření + upozornění), veřejná stránka /stav-eet a testy.
 */

export type ProbeStatus = "up" | "slow" | "down";
export type FsEnvironment = "production" | "playground";

export interface Probe {
  checkedAt: Date;
  status: ProbeStatus;
  latencyMs: number | null;
  httpStatus: number | null;
  error?: string | null;
}

/** FS požaduje, aby pokladna čekala na odpověď nejméně 2 s – pomalejší odpověď hlásíme jako „pomalé“. */
export const SLOW_MS = 2000;

/**
 * Klasifikace jednoho měření. Rozhraní je „up“, pokud server odpoví čímkoli jiným než 5xx
 * (i 404/405 na GET znamená, že běží); výpadek je chyba sítě/TLS, timeout, 5xx z brány nebo 407 z proxy.
 */
export function classifyProbe(r: { httpStatus: number | null; latencyMs: number | null; error?: string | null }): ProbeStatus {
  if (r.error || r.httpStatus === null) return "down";
  // 407 = odpověděla proxy po cestě, ne server FS
  if (r.httpStatus >= 500 || r.httpStatus === 407) return "down";
  if ((r.latencyMs ?? 0) > SLOW_MS) return "slow";
  return "up";
}

/** Podíl měření, kdy rozhraní odpovídalo (up i slow), v procentech s jedním desetinným místem. */
export function uptimePercent(probes: readonly Probe[], since: Date): number | null {
  const window = probes.filter((p) => p.checkedAt >= since);
  if (!window.length) return null;
  const ok = window.filter((p) => p.status !== "down").length;
  return Math.round((ok / window.length) * 1000) / 10;
}

export interface Incident {
  start: Date;
  /** null = trvá */
  end: Date | null;
  probes: number;
}

/**
 * Souvislé řady výpadků (≥ minProbes po sobě jdoucích „down“) seřazené od nejnovější.
 * Jednotlivé ojedinělé chyby za výpadek nepovažujeme (chrání před falešnými poplachy).
 */
export function incidents(probes: readonly Probe[], minProbes = 2): Incident[] {
  const sorted = [...probes].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const out: Incident[] = [];
  let run: Probe[] = [];
  const flush = (next: Probe | null) => {
    if (run.length >= minProbes) out.push({ start: run[0]!.checkedAt, end: next ? next.checkedAt : null, probes: run.length });
    run = [];
  };
  for (const p of sorted) {
    if (p.status === "down") run.push(p);
    else if (run.length) flush(p);
  }
  if (run.length) flush(null);
  return out.reverse();
}

/**
 * Přechod stavu pro upozornění provozovatele – bez uloženého stavu, jen z posledních měření
 * (od nejnovějšího): dvě „down“ po „up/slow“ → výpadek; „up/slow“ po dvou „down“ → obnoveno.
 */
export function transition(latestFirst: readonly Probe[]): "down" | "recovered" | null {
  const [a, b, c] = latestFirst;
  if (!a || !b || !c) return null;
  if (a.status === "down" && b.status === "down" && c.status !== "down") return "down";
  if (a.status !== "down" && b.status === "down" && c.status === "down") return "recovered";
  return null;
}

/** Průměrná latence po hodinách za posledních `hours` hodin (pro graf). */
export function hourlyLatency(probes: readonly Probe[], now: Date, hours = 24): { hour: Date; avgMs: number | null; down: boolean }[] {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - (hours - 1));
  const buckets = Array.from({ length: hours }, (_, i) => ({ hour: new Date(start.getTime() + i * 3_600_000), sum: 0, n: 0, down: false }));
  for (const p of probes) {
    const idx = Math.floor((p.checkedAt.getTime() - start.getTime()) / 3_600_000);
    const b = buckets[idx];
    if (!b) continue;
    if (p.status === "down") b.down = true;
    else if (p.latencyMs !== null) {
      b.sum += p.latencyMs;
      b.n += 1;
    }
  }
  return buckets.map((b) => ({ hour: b.hour, avgMs: b.n ? Math.round(b.sum / b.n) : null, down: b.down }));
}

export const STATUS_LABEL: Record<ProbeStatus, string> = {
  up: "Funguje",
  slow: "Odpovídá pomalu",
  down: "Nedostupné",
};
