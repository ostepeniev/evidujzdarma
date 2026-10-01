import "server-only";
import { eq } from "drizzle-orm";
import { AresClient, mapRzp, mapSubject, normalizeIco, type RzpRecord, type Subject } from "@ez/cz";
import { getDb, hasDatabase, schema } from "@ez/db";
import { ARES_FIXTURES } from "./ares-fixtures";

const client = new AresClient({ timeoutMs: 6000 });
const TTL_MS = 24 * 3_600_000;
const memory = new Map<string, { at: number; value: unknown }>();

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
  const mem = memory.get(key);
  if (mem && now - mem.at < TTL_MS) return { value: mem.value, at: mem.at, hit: true };

  if (hasDatabase()) {
    const db = getDb();
    const row = await db.query.aresCache.findFirst({ where: eq(schema.aresCache.key, key) });
    if (row && now - row.fetchedAt.getTime() < TTL_MS) {
      memory.set(key, { at: row.fetchedAt.getTime(), value: row.payload });
      return { value: row.payload, at: row.fetchedAt.getTime(), hit: true };
    }
    const value = await load();
    await db
      .insert(schema.aresCache)
      .values({ key, payload: value as object, fetchedAt: new Date(now) })
      .onConflictDoUpdate({ target: schema.aresCache.key, set: { payload: value as object, fetchedAt: new Date(now) } });
    memory.set(key, { at: now, value });
    return { value, at: now, hit: false };
  }
  const value = await load();
  memory.set(key, { at: now, value });
  if (memory.size > 5000) memory.delete(memory.keys().next().value!);
  return { value, at: now, hit: false };
}

/** Základní údaje + živnostenský rejstřík (provozovny). `null` = IČO v ARES neexistuje. */
export async function lookupCompany(icoInput: string): Promise<CompanyLookup | null> {
  const ico = normalizeIco(icoInput);
  if (!ico) return null;

  if (useFixtures()) {
    const f = ARES_FIXTURES[ico];
    if (!f) return null;
    return { subject: mapSubject(f.subject), rzp: f.rzp ? mapRzp(f.rzp) : null, fetchedAt: new Date().toISOString(), source: "fixture" };
  }

  const subj = await cached(`subject:${ico}`, () => client.rawSubject(ico));
  if (!subj.value) return null;
  const subject = mapSubject(subj.value);

  let rzp: RzpRecord | null = null;
  if (subject.registrations.rzp && subject.registrations.rzp !== "NEEXISTUJICI") {
    try {
      const r = await cached(`rzp:${ico}`, () => client.rawRzp(ico));
      rzp = r.value ? mapRzp(r.value) : null;
    } catch {
      rzp = null; // RŽP je doplněk — bez něj umíme odpovědět také
    }
  }
  return { subject, rzp, fetchedAt: new Date(subj.at).toISOString(), source: subj.hit ? "cache" : "ares" };
}
