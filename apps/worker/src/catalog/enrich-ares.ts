/**
 * Obohacení katalogu z ARES: základní údaje subjektu + provozovny z RŽP.
 *
 *   DATABASE_URL=… pnpm --filter @ez/worker catalog:enrich -- [volby]
 *
 * Volby:
 *   --regions 51,19     kraje (kódy VÚSC); výchozí CATALOG_INDEX_REGIONS nebo 51
 *   --likely            navíc všechny subjekty s eet_relevance = likely (i mimo kraje)
 *   --max-age-days 30   znovu ověřit záznamy starší než N dní (výchozí 30)
 *   --limit <n>         max. počet subjektů v jednom běhu (výchozí bez limitu)
 *   --rpm 120           dotazů na ARES za minutu (tvrdý strop 300; ARES blokuje > 500/min; web má vlastních 240/min – R3.11)
 *   --from-ico <ico>    začít od IČO (jinak od začátku; hotové záznamy se přeskočí samy)
 *   --ico <ico>         jen jeden subjekt
 *   --mock              bez sítě: syntetické odpovědi, jen pro ukázková data (název „Ukázkov…“)
 *
 * Běh je obnovitelný: zpracované subjekty dostanou `ares_updated_at = dnes`, takže je další
 * běh přeskočí. Ctrl+C dokončí rozpracovaný subjekt a skončí. `ares_updated_at` = datum, kdy
 * jsme údaje naposledy ověřili v ARES (zobrazuje se jako „Ověřeno v ARES k …“).
 */
import { and, asc, eq, gt, inArray, isNull, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import {
  AresClient,
  AresError,
  classifyNaceList,
  classifyTrades,
  isNaturalPerson,
  normalizeIco,
  normalizeNaceCode,
  slugify,
  type RzpRecord,
  type Subject,
} from "@ez/cz";
import { closeDb, getDb, schema } from "@ez/db";
import { argNumber, argRegions, argString, log, parseArgs, requireDatabaseUrl, sleep, stopSignal, todayIso } from "./common.ts";

const f = schema.firms;
const e = schema.firmEstablishments;
type FirmRow = typeof schema.firms.$inferSelect;

const MAX_RPM = 300;
const PAGE = 200;

/* ─────────────────────────────── rate limit + retry ─────────────────────────────── */

/** Rovnoměrné rozestupy mezi dotazy — při sekvenčním zpracování je to tvrdý strop. */
class Pacer {
  private next = 0;
  constructor(private readonly intervalMs: number) {}
  async wait(): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + this.intervalMs;
    if (at > now) await sleep(at - now);
  }
}

function retryable(err: unknown): { retry: boolean; delayMs: number } {
  if (err instanceof AresError) {
    if (err.status === 429) return { retry: true, delayMs: 60_000 };
    if (err.status >= 500) return { retry: true, delayMs: 10_000 };
    return { retry: false, delayMs: 0 };
  }
  // síťové chyby, timeout (AbortSignal.timeout → TimeoutError)
  return { retry: true, delayMs: 5_000 };
}

async function withRetry<T>(pacer: Pacer, stop: { stopped: boolean }, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await pacer.wait();
    try {
      return await fn();
    } catch (err) {
      const r = retryable(err);
      if (!r.retry || attempt >= 4 || stop.stopped) throw err;
      const delay = r.delayMs * 2 ** attempt;
      log(`ARES chyba (${err instanceof Error ? err.message : String(err)}), opakuji za ${Math.round(delay / 1000)} s`);
      await sleep(delay);
    }
  }
}

/* ─────────────────────────────── mock ARES (vývoj bez sítě) ─────────────────────────────── */

function mockFetch(rows: Map<string, FirmRow>): typeof fetch {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = url.match(/\/(ekonomicke-subjekty|ekonomicke-subjekty-rzp)\/(\d{8})$/);
    const row = m ? rows.get(m[2]!) : undefined;
    if (!m || !row) return json({ kod: "NENALEZENO" }, 404);
    const natural = isNaturalPerson(row.legalForm);
    if (m[1] === "ekonomicke-subjekty") {
      return json({
        ico: row.ico,
        obchodniJmeno: row.name,
        pravniForma: row.legalForm,
        dic: natural ? undefined : `CZ${row.ico}`,
        datumVzniku: row.foundedAt,
        datumAktualizace: todayIso(),
        sidlo: { nazevObce: row.city ?? "Karlovy Vary", kodObce: row.cityCode, kodKraje: row.regionCode ?? 51, psc: row.postalCode, nazevUlice: "Ukázková", cisloDomovni: 7 },
        czNace: row.nace.length ? row.nace : ["47110"],
        seznamRegistraci: { stavZdrojeRes: "AKTIVNI", stavZdrojeRzp: "AKTIVNI", ...(natural ? {} : { stavZdrojeDph: "AKTIVNI" }) },
      });
    }
    return json({
      zaznamy: [
        {
          primarniZaznam: true,
          zivnosti: [
            {
              predmetPodnikani: "Hostinská činnost",
              datumVzniku: row.foundedAt,
              provozovny: [
                { icp: `98${row.ico}`, nazev: natural ? undefined : `Ukázková provozovna ${row.ico}`, sidloProvozovny: { nazevObce: row.city, nazevUlice: "Ukázková", cisloDomovni: 8, kodKraje: row.regionCode }, platnostOd: row.foundedAt },
                { icp: `97${row.ico}`, sidloProvozovny: { nazevObce: row.city }, platnostOd: "2010-01-01", platnostDo: "2020-12-31" },
              ],
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
}

/* ─────────────────────────────── zápis ─────────────────────────────── */

function uniqueNace(codes: readonly string[]): string[] {
  return [...new Set(codes.map((c) => normalizeNaceCode(c)).filter((c): c is string => !!c))];
}

async function saveFirm(row: FirmRow, s: Subject, rzp: RzpRecord | null, rzpKnown: boolean, today: string): Promise<number | null> {
  const natural = isNaturalPerson(s.legalForm ?? row.legalForm);
  const name = s.name || row.name;
  const nace = uniqueNace(s.nace);
  const finalNace = nace.length ? nace : row.nace;
  const firmRel = classifyNaceList(finalNace).relevance;
  const a = s.address;

  const active = rzpKnown
    ? (rzp?.establishments ?? []).filter((x) => /^\d{1,12}$/.test(x.icp) && (!x.endedAt || x.endedAt > today))
    : null;

  await getDb().transaction(async (tx) => {
    await tx
      .update(f)
      .set({
        name,
        slug: (slugify(name, 80) || "subjekt").slice(0, 96),
        legalForm: s.legalForm?.slice(0, 4) ?? row.legalForm,
        isNaturalPerson: natural,
        dic: s.dic?.slice(0, 14) ?? null,
        vatPayer: s.vatPayer,
        foundedAt: s.foundedAt ?? row.foundedAt,
        dissolvedAt: s.dissolvedAt,
        // u fyzických osob ulici sídla neukládáme (minimalizace — bývá to bydliště)
        street: natural ? null : (a.street ?? (a.city ? null : row.street)),
        city: a.city ?? row.city,
        cityCode: a.cityCode ?? row.cityCode,
        postalCode: a.postalCode ?? row.postalCode,
        regionCode: a.regionCode ?? row.regionCode,
        nace: finalNace,
        eetRelevance: firmRel,
        aresUpdatedAt: today,
        syncedAt: new Date(),
        ...(active ? { establishmentsCount: active.length } : {}),
      })
      .where(eq(f.ico, row.ico));

    if (!active) return; // RŽP se nepodařilo načíst — provozovny necháme beze změny

    if (active.length) {
      await tx
        .insert(e)
        .values(
          active.map((x) => ({
            icp: x.icp,
            ico: row.ico,
            name: x.name,
            slug: (slugify(x.name ?? `${name} ${x.address.city ?? ""}`, 80) || "provozovna").slice(0, 96),
            street: natural ? null : x.address.street,
            city: x.address.city,
            cityCode: x.address.cityCode,
            postalCode: natural ? null : x.address.postalCode,
            regionCode: x.address.regionCode ?? a.regionCode ?? row.regionCode,
            trades: x.trades,
            eetRelevance: classifyTrades(x.trades) ?? firmRel,
            startedAt: x.startedAt,
            endedAt: x.endedAt,
            syncedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: e.icp,
          set: {
            ico: sql.raw("excluded.ico"),
            name: sql.raw("excluded.name"),
            slug: sql.raw("excluded.slug"),
            street: sql.raw("excluded.street"),
            city: sql.raw("excluded.city"),
            cityCode: sql.raw("excluded.city_code"),
            postalCode: sql.raw("excluded.postal_code"),
            regionCode: sql.raw("excluded.region_code"),
            trades: sql.raw("excluded.trades"),
            eetRelevance: sql.raw("excluded.eet_relevance"),
            startedAt: sql.raw("excluded.started_at"),
            endedAt: sql.raw("excluded.ended_at"),
            syncedAt: sql.raw("now()"),
          },
        });
    }
    // ukončené / zmizelé provozovny odstraníme (katalog ukazuje jen aktivní)
    const keep = active.map((x) => x.icp);
    await tx.delete(e).where(keep.length ? and(eq(e.ico, row.ico), notInArray(e.icp, keep)) : eq(e.ico, row.ico));
  });
  return active ? active.length : null;
}

/* ─────────────────────────────── hlavní smyčka ─────────────────────────────── */

async function main() {
  requireDatabaseUrl();
  const args = parseArgs();
  const stop = stopSignal();
  const mock = !!args.mock;
  const rpm = Math.min(MAX_RPM, Math.max(1, argNumber(args, "rpm", 120)));
  const maxAge = Math.max(0, argNumber(args, "max-age-days", 30));
  const limit = argNumber(args, "limit", 0) || Infinity;
  const regions = argRegions(args) ?? argRegions({ r: process.env.CATALOG_INDEX_REGIONS ?? "51" }, "r") ?? [51];
  const onlyIco = argString(args, "ico") ? normalizeIco(argString(args, "ico")!) : null;
  let cursor = argString(args, "from-ico") ? (normalizeIco(argString(args, "from-ico")!) ?? "") : "";

  const today = todayIso();
  const staleBefore = new Date(Date.now() - maxAge * 86_400_000).toISOString().slice(0, 10);
  const db = getDb();
  const mockRows = new Map<string, FirmRow>();
  const client = new AresClient({ timeoutMs: 10_000, ...(mock ? { fetch: mockFetch(mockRows) } : {}) });
  const pacer = new Pacer(mock ? 0 : Math.ceil(60_000 / rpm));

  const scope: SQL[] = [inArray(f.regionCode, regions)];
  if (args.likely) scope.push(eq(f.eetRelevance, "likely"));
  const base: SQL[] = [isNull(f.dissolvedAt), eq(f.noindex, false), or(isNull(f.aresUpdatedAt), lt(f.aresUpdatedAt, staleBefore))!];
  if (onlyIco) base.push(eq(f.ico, onlyIco));
  else base.push(or(...scope)!);
  if (mock) base.push(sql`${f.name} like 'Ukázkov%'`);

  log(`enrich ARES: kraje ${regions.join(",")}${args.likely ? " + likely" : ""}, starší než ${staleBefore}, ${rpm}/min${mock ? " (MOCK)" : ""}`);
  const stats = { processed: 0, updated: 0, notFound: 0, failed: 0, establishments: 0, requests: 0 };
  const started = Date.now();

  outer: while (!stop.stopped && stats.processed < limit) {
    const rows = await db
      .select()
      .from(f)
      .where(and(...base, gt(f.ico, cursor)))
      .orderBy(asc(f.ico))
      .limit(PAGE);
    if (rows.length === 0) break;
    if (mock) for (const r of rows) mockRows.set(r.ico, r);

    for (const row of rows) {
      if (stop.stopped || stats.processed >= limit) break outer;
      cursor = row.ico;
      stats.processed++;
      try {
        stats.requests++;
        const subject = await withRetry(pacer, stop, () => client.subject(row.ico));
        if (!subject) {
          stats.notFound++;
          log(`IČO ${row.ico} v ARES nenalezeno`);
          continue;
        }
        let rzp: RzpRecord | null = null;
        let rzpKnown = true;
        if (subject.registrations.rzp === "AKTIVNI") {
          try {
            stats.requests++;
            rzp = await withRetry(pacer, stop, () => client.rzp(row.ico));
          } catch (err) {
            rzpKnown = false;
            log(`RŽP ${row.ico}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        const n = await saveFirm(row, subject, rzp, rzpKnown, today);
        stats.updated++;
        stats.establishments += n ?? 0;
      } catch (err) {
        stats.failed++;
        log(`chyba ${row.ico}: ${err instanceof Error ? err.message : String(err)}`);
        if (stats.failed > 50 && stats.failed > stats.processed / 2) {
          log("příliš mnoho chyb — končím (ARES nedostupný?)");
          break outer;
        }
      }
      if (stats.processed % 100 === 0) {
        const perMin = Math.round(stats.requests / ((Date.now() - started) / 60_000));
        log(`zpracováno ${stats.processed} (${perMin} dotazů/min), poslední IČO ${cursor}`);
      }
    }
    if (onlyIco) break;
  }

  log("hotovo:", stats, stop.stopped ? `(přerušeno — pokračujte s --from-ico ${cursor})` : "");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
