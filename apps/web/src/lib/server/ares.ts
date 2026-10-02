import "server-only";
import { eq } from "drizzle-orm";
import { AresClient, mapRzp, mapSubject, normalizeIco, type RzpRecord, type Subject } from "@ez/cz";
import { getDb, hasDatabase, schema } from "@ez/db";
import { ARES_FIXTURES } from "./ares-fixtures";

const client = new AresClient({ timeoutMs: 6000 });

/**
 * Limit živých dotazů do ARES (ARES blokuje nad ~500 dotazů/min) rozdělený podle účelu (R3.11):
 * hromadné dotazy ani živý katalog nesmí vyčerpat interaktivní kontrolu IČO. Součet 240/min pro
 * web; noční obohacení katalogu běží ve workeru s vlastním limitem (výchozí 120/min).
 * Cache limit nespotřebovává. Při vyčerpání se čeká nejvýš 5 s, pak AresBusyError.
 */
export type AresPool = "interactive" | "bulk" | "catalog" | "mcp";
const pool = (name: string, def: number) => Number(process.env[`ARES_POOL_${name}`] ?? def);
export const ARES_POOLS: Record<AresPool, number> = {
  interactive: pool("INTERACTIVE", 120),
  bulk: pool("BULK", 60),
  catalog: pool("CATALOG", 30),
  mcp: pool("MCP", 30),
};
const buckets = new Map<AresPool, { tokens: number; at: number }>();

export class AresBusyError extends Error {
  constructor() {
    super("ARES je právě vytížený, zkuste to za chvíli.");
  }
}

export async function takeAresToken(name: AresPool, maxWaitMs = 5_000): Promise<void> {
  const perMinute = ARES_POOLS[name];
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    const now = Date.now();
    const b = buckets.get(name) ?? { tokens: perMinute, at: now };
    b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) * perMinute) / 60_000);
    b.at = now;
    buckets.set(name, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return;
    }
    if (now >= deadline) throw new AresBusyError();
    await new Promise((r) => setTimeout(r, 250));
  }
}

const TTL_MS = 24 * 3_600_000;
/**
 * Paměťová vrstva před DB (ares_cache): LRU s TTL a pevným stropem i s databází (R5.12). Na sdíleném serveru
 * (Т7) by jinak rostla s každým novým IČO. Úplnou cache drží DB; bez DB je paměť jediná cache.
 */
const memory = new Map<string, { at: number; value: unknown }>();
const memoryMax = () => Number(process.env.ARES_MEMORY_MAX) || 2_000;

function memoryGet(key: string, now: number) {
  const e = memory.get(key);
  if (!e) return undefined;
  memory.delete(key);
  if (now - e.at >= TTL_MS) return undefined; // prošlé už neservírujeme a uvolníme
  memory.set(key, e); // nedávno použité na konec (LRU)
  return e;
}

function memorySet(key: string, entry: { at: number; value: unknown }) {
  memory.delete(key);
  memory.set(key, entry);
  for (const max = memoryMax(); memory.size > max; ) memory.delete(memory.keys().next().value!);
}

export interface CompanyLookup {
  subject: Subject;
  rzp: RzpRecord | null;
  fetchedAt: string;
  source: "ares" | "cache" | "fixture";
}

function useFixtures(): boolean {
  return process.env.ARES_MOCK === "1";
}

async function cached(key: string, load: () => Promise<unknown>): Promise<{ value: unknown; at: number; hit: boolean }> {
  const now = Date.now();
  const mem = memoryGet(key, now);
  if (mem) return { value: mem.value, at: mem.at, hit: true };

  if (hasDatabase()) {
    const db = getDb();
    const row = await db.query.aresCache.findFirst({ where: eq(schema.aresCache.key, key) });
    if (row && now - row.fetchedAt.getTime() < TTL_MS) {
      memorySet(key, { at: row.fetchedAt.getTime(), value: row.payload });
      return { value: row.payload, at: row.fetchedAt.getTime(), hit: true };
    }
    const value = await load();
    await db
      .insert(schema.aresCache)
      .values({ key, payload: value as object, fetchedAt: new Date(now) })
      .onConflictDoUpdate({ target: schema.aresCache.key, set: { payload: value as object, fetchedAt: new Date(now) } });
    memorySet(key, { at: now, value });
    return { value, at: now, hit: false };
  }
  const value = await load();
  memorySet(key, { at: now, value });
  return { value, at: now, hit: false };
}

/** Základní údaje + živnostenský rejstřík (provozovny). `null` = IČO v ARES neexistuje. */
export async function lookupCompany(icoInput: string, opts: { pool?: AresPool } = {}): Promise<CompanyLookup | null> {
  const pool = opts.pool ?? "interactive";
  const ico = normalizeIco(icoInput);
  if (!ico) return null;

  if (useFixtures()) {
    const f = ARES_FIXTURES[ico];
    if (!f) return null;
    return { subject: mapSubject(f.subject), rzp: f.rzp ? mapRzp(f.rzp) : null, fetchedAt: new Date().toISOString(), source: "fixture" };
  }

  const subj = await cached(`subject:${ico}`, async () => (await takeAresToken(pool), client.rawSubject(ico)));
  if (!subj.value) return null;
  const subject = mapSubject(subj.value);

  let rzp: RzpRecord | null = null;
  if (subject.registrations.rzp && subject.registrations.rzp !== "NEEXISTUJICI") {
    try {
      const r = await cached(`rzp:${ico}`, async () => (await takeAresToken(pool), client.rawRzp(ico)));
      rzp = r.value ? mapRzp(r.value) : null;
    } catch {
      rzp = null; // RŽP je doplněk — bez něj umíme odpovědět také
    }
  }
  return { subject, rzp, fetchedAt: new Date(subj.at).toISOString(), source: subj.hit ? "cache" : "ares" };
}

/** Jen pro testy (R5.12). */
export const __aresCacheForTests = {
  cached,
  size: () => memory.size,
  clear: () => memory.clear(),
  peek: (key: string) => memory.has(key),
};
