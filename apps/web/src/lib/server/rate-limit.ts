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

/**
 * IP klienta pro limity (R3.11): jen z X-Real-IP, kterou nastavuje reverse proxy (nginx: $remote_addr, Caddy: {remote_host}) a kterou klient
 * nemůže podvrhnout. X-Forwarded-For ignorujeme – její první položku si klient napíše sám.
 * IPv6 klíčujeme po /64: jedna přípojka má celý blok adres.
 */
export function clientIp(req: Request): string {
  const ip = (req.headers.get("x-real-ip") ?? "").trim();
  if (!ip) return "unknown";
  return ip.includes(":") ? ipv6Prefix(ip) : ip;
}

function ipv6Prefix(ip: string): string {
  const addr = ip.replace(/^\[|\]$/g, "").split("%")[0]!.toLowerCase();
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1]!;
  const [head = "", tail = ""] = addr.split("::");
  const h = head ? head.split(":") : [];
  const t = addr.includes("::") ? (tail ? tail.split(":") : []) : [];
  const groups = addr.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return `${groups
    .slice(0, 4)
    .map((g) => (parseInt(g || "0", 16) || 0).toString(16))
    .join(":")}::/64`;
}
