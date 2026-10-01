/**
 * Import ČSÚ RES (Registr ekonomických subjektů – otevřená data) do tabulky `firms`.
 *
 *   DATABASE_URL=… pnpm --filter @ez/worker catalog:import -- [volby]
 *
 * Volby:
 *   --file <cesta>        lokální res_data.csv (i .gz) — doporučeno: nejdřív stáhnout curl -fLo
 *   --url <url>           jinak stáhne streamem z ČSÚ (výchozí RES_CSV_URL nebo oficiální URL)
 *   --regions 51,19       importovat jen vybrané kraje (kódy VÚSC); výchozí všechny
 *   --limit <n>           max. počet upsertovaných subjektů (test)
 *   --batch <n>           velikost dávky (výchozí 1000)
 *   --dry-run             jen parsovat a spočítat, nic nezapisovat
 *   --pf-nace [cesta|url] po importu doplnit všechny obory z res_pf_nace.csv (bez hodnoty = oficiální URL)
 *
 * Zásady: aktivní subjekty se upsertují (ON CONFLICT (ico) DO UPDATE), zaniklé se jen označí
 * `dissolved_at` (nové se nezakládají). Nikdy nepřepisujeme `profile`, `claimed_account_id`,
 * `noindex`, `dic`, `vat_payer`, `establishments_count`, `ares_updated_at`. U záznamů již ověřených
 * v ARES ponecháváme adresu a obory z ARES (obnovuje je catalog:enrich).
 */
import { createReadStream } from "node:fs";
import { Readable, pipeline } from "node:stream";
import { createGunzip } from "node:zlib";
import { inArray, sql } from "drizzle-orm";
import {
  RES_DATA_URL,
  RES_PF_NACE_URL,
  classifyNaceList,
  csvRecords,
  mapResPfNaceRow,
  mapResRow,
  missingResColumns,
  type ResFirm,
} from "@ez/cz";
import { closeDb, getDb, schema } from "@ez/db";
import { argNumber, argRegions, argString, log, parseArgs, requireDatabaseUrl, stopSignal } from "./common.ts";

const f = schema.firms;
const INT_MAX = 2_147_483_647;

/* ─────────────────────────────── zdroj dat ─────────────────────────────── */

/** Lokální soubor nebo URL → bajty; gzip se pozná podle magických bajtů 1f 8b. */
async function openSource(src: string): Promise<AsyncIterable<Uint8Array>> {
  let stream: Readable;
  if (/^https?:\/\//.test(src)) {
    log(`stahuji ${src}`);
    const res = await fetch(src, { headers: { "user-agent": "EvidujZdarma.cz catalog import (+https://evidujzdarma.cz)" } });
    if (!res.ok || !res.body) throw new Error(`Stažení selhalo: HTTP ${res.status} ${src}`);
    const len = res.headers.get("content-length");
    if (len) log(`velikost ${(Number(len) / 1e6).toFixed(0)} MB, poslední změna ${res.headers.get("last-modified") ?? "?"}`);
    stream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream<Uint8Array>);
  } else {
    stream = createReadStream(src, { highWaterMark: 1 << 20 });
  }
  return maybeGunzip(stream);
}

async function* maybeGunzip(src: Readable): AsyncGenerator<Uint8Array> {
  const it = src[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  const first = await it.next();
  if (first.done) return;
  const head = first.value;
  async function* rest() {
    yield head;
    for (;;) {
      const n = await it.next();
      if (n.done) return;
      yield n.value;
    }
  }
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const gunzip = pipeline(Readable.from(rest()), createGunzip(), () => {});
    for await (const chunk of gunzip) yield chunk as Buffer;
  } else {
    yield* rest();
  }
}

/* ─────────────────────────────── zápis do DB ─────────────────────────────── */

function toInsert(r: ResFirm): typeof schema.firms.$inferInsert {
  return {
    ico: r.ico,
    name: r.name,
    slug: r.slug.slice(0, 96),
    legalForm: r.legalForm,
    isNaturalPerson: r.isNaturalPerson,
    foundedAt: r.foundedAt,
    dissolvedAt: null,
    street: r.street,
    city: r.city,
    cityCode: r.cityCode != null && r.cityCode <= INT_MAX ? r.cityCode : null,
    postalCode: r.postalCode,
    regionCode: r.regionCode,
    nace: r.nace,
    eetRelevance: r.eetRelevance,
    syncedAt: new Date(),
  };
}

/** U subjektů ověřených v ARES (ares_updated_at není null) necháme hodnotu z ARES. */
const keepIfVerified = (col: string) => sql.raw(`case when firms.ares_updated_at is null then excluded.${col} else firms.${col} end`);

async function upsertFirms(rows: ResFirm[]): Promise<void> {
  if (rows.length === 0) return;
  // duplicitní IČO v jedné dávce by shodilo ON CONFLICT — poslední vyhrává
  const unique = [...new Map(rows.map((r) => [r.ico, r])).values()];
  await getDb()
    .insert(f)
    .values(unique.map(toInsert))
    .onConflictDoUpdate({
      target: f.ico,
      set: {
        name: sql.raw("excluded.name"),
        slug: sql.raw("excluded.slug"),
        legalForm: sql.raw("excluded.legal_form"),
        isNaturalPerson: sql.raw("excluded.is_natural_person"),
        foundedAt: sql.raw("excluded.founded_at"),
        dissolvedAt: sql.raw("null"),
        street: keepIfVerified("street"),
        city: keepIfVerified("city"),
        cityCode: keepIfVerified("city_code"),
        postalCode: keepIfVerified("postal_code"),
        regionCode: sql.raw("coalesce(case when firms.ares_updated_at is null then excluded.region_code else firms.region_code end, excluded.region_code)"),
        nace: keepIfVerified("nace"),
        eetRelevance: keepIfVerified("eet_relevance"),
        syncedAt: sql.raw("now()"),
      },
    });
}

/** Zaniklé subjekty: jen označit ty, které už v katalogu máme. */
async function markDissolved(rows: { ico: string; date: string }[]): Promise<number> {
  if (rows.length === 0) return 0;
  const values = sql.join(
    rows.map((r) => sql`(${r.ico}, ${r.date}::date)`),
    sql`, `,
  );
  const res = await getDb().execute(sql`
    update firms set dissolved_at = v.d, synced_at = now()
    from (values ${values}) as v(ico, d)
    where firms.ico = v.ico and firms.dissolved_at is distinct from v.d`);
  return (res as unknown as { count?: number }).count ?? 0;
}

/* ─────────────────────────────── hlavní import ─────────────────────────────── */

interface Stats {
  rows: number;
  invalidIco: number;
  noName: number;
  dissolvedSeen: number;
  dissolvedMarked: number;
  skippedRegion: number;
  noRegion: number;
  upserted: number;
  snapshot: string | null;
}

async function importResData(opts: { src: string; regions?: number[]; limit?: number; batch: number; dryRun: boolean; stop: { stopped: boolean } }): Promise<Stats> {
  const stats: Stats = { rows: 0, invalidIco: 0, noName: 0, dissolvedSeen: 0, dissolvedMarked: 0, skippedRegion: 0, noRegion: 0, upserted: 0, snapshot: null };
  const firms: ResFirm[] = [];
  const dissolved: { ico: string; date: string }[] = [];
  const started = Date.now();

  const flush = async (force = false) => {
    if (firms.length && (force || firms.length >= opts.batch)) {
      if (!opts.dryRun) await upsertFirms(firms);
      stats.upserted += firms.length;
      firms.length = 0;
    }
    if (dissolved.length && (force || dissolved.length >= opts.batch)) {
      if (!opts.dryRun) stats.dissolvedMarked += await markDissolved(dissolved);
      dissolved.length = 0;
    }
  };

  const source = await openSource(opts.src);
  const records = csvRecords(source, {
    onHeader: (h) => {
      const missing = missingResColumns(h);
      if (missing.length) throw new Error(`V hlavičce CSV chybí sloupce: ${missing.join(", ")} (nalezeno: ${h.join(", ")})`);
      log(`hlavička OK (${h.length} sloupců)`);
    },
  });

  for await (const rec of records) {
    stats.rows++;
    const firm = mapResRow(rec);
    if (!firm) {
      stats.invalidIco++;
    } else {
      stats.snapshot ??= firm.snapshotDate;
      if (firm.dissolvedAt) {
        stats.dissolvedSeen++;
        dissolved.push({ ico: firm.ico, date: firm.dissolvedAt });
      } else if (!firm.name) {
        stats.noName++;
      } else if (opts.regions && (firm.regionCode == null || !opts.regions.includes(firm.regionCode))) {
        stats.skippedRegion++;
      } else {
        if (firm.regionCode == null) stats.noRegion++;
        firms.push(firm);
      }
    }
    await flush();
    if (stats.rows % 100_000 === 0) {
      const rate = Math.round(stats.rows / ((Date.now() - started) / 1000));
      log(`řádků ${stats.rows.toLocaleString("cs-CZ")} (${rate}/s), upsert ${stats.upserted.toLocaleString("cs-CZ")}`);
    }
    if (opts.limit && stats.upserted + firms.length >= opts.limit) break;
    if (opts.stop.stopped) break;
  }
  await flush(true);
  return stats;
}

/** Druhý průchod: všechny obory CZ-NACE z res_pf_nace.csv (sjednotí s převažujícím oborem). */
async function importPfNace(opts: { src: string; batch: number; dryRun: boolean; stop: { stopped: boolean } }): Promise<{ rows: number; updated: number }> {
  const db = getDb();
  const pending = new Map<string, Set<string>>();
  let rows = 0;
  let updated = 0;

  const flush = async () => {
    if (pending.size === 0) return;
    const icos = [...pending.keys()];
    const existing = opts.dryRun
      ? []
      : await db.select({ ico: f.ico, nace: f.nace, aresUpdatedAt: f.aresUpdatedAt }).from(f).where(inArray(f.ico, icos));
    const changes: { ico: string; nace: string[]; rel: string }[] = [];
    for (const row of existing) {
      if (row.aresUpdatedAt) continue; // obory z ARES mají přednost
      const merged = [...new Set([...row.nace, ...(pending.get(row.ico) ?? [])])].sort();
      if (merged.length === row.nace.length && merged.every((c) => row.nace.includes(c))) continue;
      changes.push({ ico: row.ico, nace: merged, rel: classifyNaceList(merged).relevance });
    }
    if (changes.length) {
      const values = sql.join(
        changes.map((c) => sql`(${c.ico}, ${`{${c.nace.join(",")}}`}::text[], ${c.rel}::eet_relevance)`),
        sql`, `,
      );
      await db.execute(sql`
        update firms set nace = v.nace, eet_relevance = v.rel
        from (values ${values}) as v(ico, nace, rel)
        where firms.ico = v.ico`);
      updated += changes.length;
    }
    pending.clear();
  };

  const source = await openSource(opts.src);
  for await (const rec of csvRecords(source)) {
    rows++;
    const m = mapResPfNaceRow(rec);
    if (m) {
      let set = pending.get(m.ico);
      if (!set) {
        if (pending.size >= opts.batch) await flush();
        set = new Set();
        pending.set(m.ico, set);
      }
      set.add(m.nace);
    }
    if (rows % 1_000_000 === 0) log(`pf_nace řádků ${rows.toLocaleString("cs-CZ")}, upraveno ${updated.toLocaleString("cs-CZ")}`);
    if (opts.stop.stopped) break;
  }
  await flush();
  return { rows, updated };
}

async function main() {
  const args = parseArgs();
  const dryRun = !!args["dry-run"];
  if (!dryRun) requireDatabaseUrl();
  const stop = stopSignal();
  const batch = Math.min(5000, Math.max(100, argNumber(args, "batch", 1000)));
  const src = argString(args, "file") ?? argString(args, "url") ?? process.env.RES_CSV_URL ?? RES_DATA_URL;
  const regions = argRegions(args);
  const limit = argNumber(args, "limit", 0) || undefined;

  log(`import RES z ${src}${regions ? `, kraje ${regions.join(",")}` : ""}${dryRun ? " (dry-run)" : ""}`);
  const stats = await importResData({ src, regions, limit, batch, dryRun, stop });
  log("hotovo:", stats);
  if (stats.noRegion > 0) log(`pozor: ${stats.noRegion} subjektů bez rozpoznaného kraje (OKRESLAU) — zkontrolujte mapování NUTS3_TO_KRAJ`);

  const pf = args["pf-nace"];
  if (pf && !stop.stopped) {
    const pfSrc = typeof pf === "string" ? pf : (process.env.RES_PF_NACE_URL ?? RES_PF_NACE_URL);
    log(`doplňuji obory z ${pfSrc}`);
    const r = await importPfNace({ src: pfSrc, batch, dryRun, stop });
    log("obory hotovo:", r);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
