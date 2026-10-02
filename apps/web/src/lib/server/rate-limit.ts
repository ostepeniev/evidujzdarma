import "server-only";

/**
 * Jednoduchý in-memory token bucket. Stačí pro jednu instanci aplikace (Hetzner VM);
 * při škálování na více instancí přesunout do Postgresu/Redis.
 */
const buckets = new Map<string, { tokens: number; updated: number }>();

export function rateLimit(key: string, limit: number, perSeconds: number): boolean {
  const now = Date.now();
  const refill = limit / (perSeconds * 1000);
  const b = buckets.get(key) ?? { tokens: limit, updated: now };
  b.tokens = Math.min(limit, b.tokens + (now - b.updated) * refill);
  b.updated = now;
  const allowed = b.tokens >= 1;
  if (allowed) b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 50_000) {
    for (const [k, v] of buckets) if (now - v.updated > perSeconds * 1000) buckets.delete(k);
  }
  return allowed;
}

/** IP klienta z hlaviček v server komponentách (stejná logika jako clientIp). */
export function clientIpFromHeaders(h: Headers): string {
  return clientIp(new Request("http://localhost", { headers: h }));
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
