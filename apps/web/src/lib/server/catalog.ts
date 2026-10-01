import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  KRAJE,
  classifyNaceList,
  classifyTrades,
  isNaturalPerson,
  isValidIco,
  normalizeIco,
  slugify,
  type EetRelevance,
  type Establishment as AresEstablishment,
} from "@ez/cz";
import { getDb, hasDatabase, schema } from "@ez/db";
import { lookupCompany } from "./ares";

/**
 * Katalog firem a provozoven — datová vrstva.
 *
 * Zásady (GDPR, kvalita):
 *  - jen veřejné údaje z registrů (ARES, RŽP, RES ČSÚ), žádné vymyšlené texty;
 *  - u fyzických osob (OSVČ) se ulice sídla ani provozovny NIKDY nedostane do view modelu;
 *  - indexujeme postupně po krajích (CATALOG_INDEX_REGIONS) a jen záznamy ověřené v ARES.
 */

const f = schema.firms;
const e = schema.firmEstablishments;

export type FirmRow = typeof schema.firms.$inferSelect;
export type EstablishmentRow = typeof schema.firmEstablishments.$inferSelect;

/* ─────────────────────────────── konfigurace ─────────────────────────────── */

/** Kraje (kódy VÚSC), jejichž firmy indexujeme. Výchozí "51" = Karlovarský kraj; "*" = všechny. */
export function indexRegions(): number[] {
  const raw = (process.env.CATALOG_INDEX_REGIONS ?? "51").trim();
  if (raw === "*" || raw.toLowerCase() === "all") return KRAJE.map((k) => k.code);
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && KRAJE.some((k) => k.code === n));
}

export function isIndexRegion(code: number | null | undefined): boolean {
  return code != null && indexRegions().includes(code);
}

/** Indexovat jen firmy, jejichž údaje ověřil worker v ARES (výchozí ano; CATALOG_REQUIRE_ARES=0 vypne). */
function requireAresVerified(): boolean {
  return process.env.CATALOG_REQUIRE_ARES !== "0";
}

/** Dnešní datum v Praze, YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());
}

/* ─────────────────────────────── jednoduchá cache agregací ─────────────────────────────── */

const memo = new Map<string, { at: number; value: unknown }>();

async function memoize<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  memo.set(key, { at: Date.now(), value });
  return value;
}

/* ─────────────────────────────── SQL podmínky ─────────────────────────────── */

/** Firma smí být v seznamech: bez námitky a nezaniklá. */
function listableSql(): SQL {
  return and(eq(f.noindex, false), isNull(f.dissolvedAt))!;
}

function inIndexRegionsSql(): SQL {
  const regions = indexRegions();
  if (regions.length === 0) return sql`false`;
  return sql`${f.regionCode} in (${sql.join(
    regions.map((r) => sql`${r}`),
    sql`, `,
  )})`;
}

/** Firma smí být indexována (a v sitemapě). */
function indexableSql(): SQL {
  const parts: SQL[] = [listableSql(), inIndexRegionsSql()];
  if (requireAresVerified()) parts.push(isNotNull(f.aresUpdatedAt));
  return and(...parts)!;
}

function activeEstablishmentSql(today: string): SQL {
  return or(isNull(e.endedAt), sql`${e.endedAt} > ${today}`)!;
}

function nacePrefixSql(prefixes: readonly string[]): SQL {
  if (prefixes.length === 0) return sql`false`;
  const patterns = prefixes.map((p) => `${p.replace(/\D/g, "")}%`);
  return sql`exists (select 1 from unnest(${f.nace}) as c(code) where c.code like any (array[${sql.join(
    patterns.map((p) => sql`${p}`),
    sql`, `,
  )}]::text[]))`;
}

/* ─────────────────────────────── view modely ─────────────────────────────── */

export type NoindexReason = "objection" | "dissolved" | "region" | "unverified" | "not-in-db";

export interface EstablishmentView {
  icp: string;
  slug: string;
  name: string | null;
  /** null u OSVČ (nikdy nezobrazujeme) */
  street: string | null;
  city: string | null;
  postalCode: string | null;
  regionCode: number | null;
  trades: string[];
  eetRelevance: EetRelevance;
  startedAt: string | null;
  /** má vlastní stránku /provozovna/… (je v DB) */
  linkable: boolean;
}

export interface FirmView {
  ico: string;
  name: string;
  slug: string;
  legalForm: string | null;
  isNaturalPerson: boolean;
  dic: string | null;
  /** null = neznámé (údaj zatím neověřen v ARES) */
  vatPayer: boolean | null;
  foundedAt: string | null;
  dissolvedAt: string | null;
  /** null u OSVČ */
  street: string | null;
  city: string | null;
  /** null u OSVČ */
  postalCode: string | null;
  regionCode: number | null;
  nace: string[];
  eetRelevance: EetRelevance;
  /** null = provozovny zatím neověřeny v RŽP */
  establishments: EstablishmentView[] | null;
  claimed: boolean;
  /** odkud a k jakému datu jsou údaje */
  source: { kind: "ares" | "res"; date: string };
  inDb: boolean;
  index: boolean;
  noindexReason: NoindexReason | null;
}

function firmNoindexReason(row: FirmRow): NoindexReason | null {
  if (row.noindex) return "objection";
  if (row.dissolvedAt) return "dissolved";
  if (!isIndexRegion(row.regionCode)) return "region";
  if (requireAresVerified() && !row.aresUpdatedAt) return "unverified";
  return null;
}

function establishmentView(row: EstablishmentRow, natural: boolean): EstablishmentView {
  return {
    icp: row.icp,
    slug: row.slug,
    name: row.name,
    street: natural ? null : row.street,
    city: row.city,
    postalCode: natural ? null : row.postalCode,
    regionCode: row.regionCode,
    trades: row.trades,
    eetRelevance: row.eetRelevance,
    startedAt: row.startedAt,
    linkable: true,
  };
}

function firmViewFromRow(row: FirmRow, ests: EstablishmentRow[]): FirmView {
  const natural = row.isNaturalPerson || isNaturalPerson(row.legalForm);
  const verified = !!row.aresUpdatedAt;
  const reason = firmNoindexReason(row);
  return {
    ico: row.ico,
    name: row.name,
    slug: row.slug,
    legalForm: row.legalForm,
    isNaturalPerson: natural,
    dic: row.dic,
    vatPayer: verified ? row.vatPayer : null,
    foundedAt: row.foundedAt,
    dissolvedAt: row.dissolvedAt,
    street: natural ? null : row.street,
    city: row.city,
    postalCode: natural ? null : row.postalCode,
    regionCode: row.regionCode,
    nace: row.nace,
    eetRelevance: row.eetRelevance,
    establishments: verified ? ests.map((x) => establishmentView(x, natural)) : null,
    claimed: !!row.claimedAccountId,
    source: verified
      ? { kind: "ares", date: row.aresUpdatedAt! }
      : { kind: "res", date: row.syncedAt.toISOString().slice(0, 10) },
    inDb: true,
    index: reason === null,
    noindexReason: reason,
  };
}

function establishmentSlug(name: string | null, firmName: string, city: string | null): string {
  return slugify([name ?? firmName, name ? null : city].filter(Boolean).join(" "), 80) || "provozovna";
}

/** Živý záznam z ARES (firma ještě není v DB) — vždy noindex. */
async function liveFirmView(ico: string): Promise<FirmView | null> {
  const live = await lookupCompany(ico);
  if (!live) return null;
  const s = live.subject;
  const natural = isNaturalPerson(s.legalForm);
  const today = todayIso();
  const firmRel = classifyNaceList(s.nace).relevance;
  const ests = (live.rzp?.establishments ?? [])
    .filter((x: AresEstablishment) => !x.endedAt || x.endedAt > today)
    .map(
      (x): EstablishmentView => ({
        icp: x.icp,
        slug: establishmentSlug(x.name, s.name, x.address.city),
        name: x.name,
        street: natural ? null : x.address.street,
        city: x.address.city,
        postalCode: natural ? null : x.address.postalCode,
        regionCode: x.address.regionCode,
        trades: x.trades,
        eetRelevance: classifyTrades(x.trades) ?? firmRel,
        startedAt: x.startedAt,
        linkable: false,
      }),
    );
  return {
    ico: s.ico,
    name: s.name,
    slug: slugify(s.name, 80) || "subjekt",
    legalForm: s.legalForm,
    isNaturalPerson: natural,
    dic: s.dic,
    vatPayer: s.vatPayer,
    foundedAt: s.foundedAt,
    dissolvedAt: s.dissolvedAt,
    street: natural ? null : s.address.street,
    city: s.address.city,
    postalCode: natural ? null : s.address.postalCode,
    regionCode: s.address.regionCode,
    nace: s.nace,
    eetRelevance: firmRel,
    establishments: live.rzp ? ests : null,
    claimed: false,
    source: { kind: "ares", date: live.fetchedAt.slice(0, 10) },
    inDb: false,
    index: false,
    noindexReason: "not-in-db",
  };
}

/** Firma pro stránku /firma/[slug]: z DB, jinak živě z ARES. Deduplikováno v rámci requestu. */
export const getFirmView = cache(async (icoInput: string): Promise<FirmView | null> => {
  const ico = normalizeIco(icoInput);
  if (!ico || !isValidIco(ico)) return null;
  if (hasDatabase()) {
    const db = getDb();
    const [row] = await db.select().from(f).where(eq(f.ico, ico)).limit(1);
    if (row) {
      const ests = await db
        .select()
        .from(e)
        .where(and(eq(e.ico, ico), activeEstablishmentSql(todayIso())))
        .orderBy(asc(e.city), asc(e.name), asc(e.icp))
        .limit(500);
      return firmViewFromRow(row, ests);
    }
  }
  return liveFirmView(ico);
});

export interface EstablishmentPage {
  establishment: EstablishmentView;
  active: boolean;
  endedAt: string | null;
  firm: FirmView;
  index: boolean;
}

export const getEstablishmentPage = cache(async (icp: string): Promise<EstablishmentPage | null> => {
  if (!hasDatabase() || !/^\d{6,12}$/.test(icp)) return null;
  const db = getDb();
  const [row] = await db.select().from(e).where(eq(e.icp, icp)).limit(1);
  if (!row) return null;
  const firm = await getFirmView(row.ico);
  if (!firm) return null;
  const today = todayIso();
  const active = !row.endedAt || row.endedAt > today;
  return {
    establishment: establishmentView(row, firm.isNaturalPerson),
    active,
    endedAt: row.endedAt,
    firm,
    index: firm.index && active,
  };
});

/* ─────────────────────────────── seznamy ─────────────────────────────── */

export interface FirmListItem {
  ico: string;
  name: string;
  slug: string;
  legalForm: string | null;
  isNaturalPerson: boolean;
  city: string | null;
  regionCode: number | null;
  eetRelevance: EetRelevance;
  foundedAt: string | null;
  dissolvedAt: string | null;
}

const listColumns = {
  ico: f.ico,
  name: f.name,
  slug: f.slug,
  legalForm: f.legalForm,
  isNaturalPerson: f.isNaturalPerson,
  city: f.city,
  regionCode: f.regionCode,
  eetRelevance: f.eetRelevance,
  foundedAt: f.foundedAt,
  dissolvedAt: f.dissolvedAt,
};

export interface ListFilter {
  regionCode?: number;
  relevance?: EetRelevance;
  nacePrefixes?: readonly string[];
  /** YYYY-MM podle data vzniku */
  foundedMonth?: string;
  /** jen firmy z indexovaných krajů */
  onlyIndexRegions?: boolean;
}

export const PER_PAGE = 50;

/** Deduplikováno v rámci requestu (generateMetadata + stránka volají se stejnými argumenty). */
export function listFirms(filter: ListFilter, page = 1, perPage = PER_PAGE): Promise<{ items: FirmListItem[]; total: number }> {
  return listFirmsCached(JSON.stringify(filter), page, perPage);
}

const listFirmsCached = cache((filterJson: string, page: number, perPage: number) => listFirmsImpl(JSON.parse(filterJson) as ListFilter, page, perPage));

async function listFirmsImpl(filter: ListFilter, page: number, perPage: number): Promise<{ items: FirmListItem[]; total: number }> {
  if (!hasDatabase()) return { items: [], total: 0 };
  const conds: SQL[] = [listableSql()];
  if (filter.regionCode != null) conds.push(eq(f.regionCode, filter.regionCode));
  if (filter.relevance) conds.push(eq(f.eetRelevance, filter.relevance));
  if (filter.nacePrefixes) conds.push(nacePrefixSql(filter.nacePrefixes));
  if (filter.onlyIndexRegions) conds.push(inIndexRegionsSql());
  let order = [asc(f.name), asc(f.ico)];
  if (filter.foundedMonth) {
    const start = `${filter.foundedMonth}-01`;
    conds.push(sql`${f.foundedAt} >= ${start}::date and ${f.foundedAt} < (${start}::date + interval '1 month')`);
    order = [desc(f.foundedAt), asc(f.name), asc(f.ico)];
  }
  const where = and(...conds);
  const db = getDb();
  const [items, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select(listColumns)
      .from(f)
      .where(where)
      .orderBy(...order)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: count() }).from(f).where(where),
  ]);
  return { items, total };
}

/** Vyhledání podle názvu (pg_trgm) — max. `limit` výsledků, bez firem s námitkou. */
export async function searchFirmsByName(q: string, limit = 20): Promise<FirmListItem[]> {
  const query = q.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!hasDatabase() || query.length < 2) return [];
  const like = `%${query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return getDb()
    .select(listColumns)
    .from(f)
    .where(and(eq(f.noindex, false), or(sql`${f.name} % ${query}`, sql`${f.name} ilike ${like}`)))
    .orderBy(sql`${f.dissolvedAt} is not null`, sql`similarity(${f.name}, ${query}) desc`, asc(f.name))
    .limit(limit);
}

/** Existuje firma s tímto IČO v DB? Vrací slug pro přesměrování. */
export async function findFirmSlug(ico: string): Promise<string | null> {
  if (!hasDatabase()) return null;
  const [row] = await getDb().select({ slug: f.slug }).from(f).where(eq(f.ico, ico)).limit(1);
  return row?.slug ?? null;
}

/** Počet firem v seznamech po krajích (cache 1 h). */
export async function regionCounts(): Promise<Record<number, number>> {
  if (!hasDatabase()) return {};
  return memoize("regionCounts", 3_600_000, async () => {
    const rows = await getDb()
      .select({ region: f.regionCode, n: count() })
      .from(f)
      .where(listableSql())
      .groupBy(f.regionCode);
    const out: Record<number, number> = {};
    for (const r of rows) if (r.region != null) out[r.region] = r.n;
    return out;
  });
}

/** Posledních N měsíců vzniku firem v indexovaných krajích (cache 1 h). */
export async function foundingMonths(limit = 12): Promise<{ month: string; count: number }[]> {
  if (!hasDatabase()) return [];
  return memoize(`foundingMonths:${limit}:${indexRegions().join(",")}`, 3_600_000, async () => {
    const today = todayIso();
    const from = `${Number(today.slice(0, 4)) - 2}${today.slice(4, 7)}-01`;
    const month = sql<string>`to_char(${f.foundedAt}, 'YYYY-MM')`;
    const rows = await getDb()
      .select({ month, count: count() })
      .from(f)
      .where(and(listableSql(), inIndexRegionsSql(), sql`${f.foundedAt} >= ${from}::date`, sql`${f.foundedAt} <= ${today}::date`))
      .groupBy(month)
      .orderBy(desc(month))
      .limit(limit);
    return rows.map((r) => ({ month: r.month, count: r.count }));
  });
}

/** Počty firem obor × kraj pro odkazy (cache 1 h). */
export async function industryRegionCount(nacePrefixes: readonly string[], regionCode: number): Promise<number> {
  if (!hasDatabase() || nacePrefixes.length === 0) return 0;
  return memoize(`ind:${nacePrefixes.join("|")}:${regionCode}`, 3_600_000, async () => {
    const [row] = await getDb()
      .select({ n: count() })
      .from(f)
      .where(and(listableSql(), eq(f.regionCode, regionCode), nacePrefixSql(nacePrefixes)));
    return row?.n ?? 0;
  });
}

/** Datum poslední aktualizace dat katalogu (max. synced_at), YYYY-MM-DD; cache 1 h. */
export async function catalogDataDate(): Promise<string | null> {
  if (!hasDatabase()) return null;
  return memoize("catalogDataDate", 3_600_000, async () => {
    const [row] = await getDb()
      .select({ d: sql<string | null>`to_char(max(${f.syncedAt}) at time zone 'Europe/Prague', 'YYYY-MM-DD')` })
      .from(f);
    return row?.d ?? null;
  });
}

/* ─────────────────────────────── sitemapy ─────────────────────────────── */

export const SITEMAP_CHUNK = 50_000;

export async function countIndexableFirms(): Promise<number> {
  if (!hasDatabase()) return 0;
  const [row] = await getDb().select({ n: count() }).from(f).where(indexableSql());
  return row?.n ?? 0;
}

export async function indexableFirmsChunk(chunk: number): Promise<{ ico: string; slug: string; updated: string | null }[]> {
  if (!hasDatabase()) return [];
  return getDb()
    .select({ ico: f.ico, slug: f.slug, updated: f.aresUpdatedAt })
    .from(f)
    .where(indexableSql())
    .orderBy(asc(f.ico))
    .limit(SITEMAP_CHUNK)
    .offset(chunk * SITEMAP_CHUNK);
}

export async function countIndexableEstablishments(): Promise<number> {
  if (!hasDatabase()) return 0;
  const [row] = await getDb()
    .select({ n: count() })
    .from(e)
    .innerJoin(f, eq(f.ico, e.ico))
    .where(and(indexableSql(), activeEstablishmentSql(todayIso())));
  return row?.n ?? 0;
}

export async function indexableEstablishmentsChunk(chunk: number): Promise<{ icp: string; slug: string; updated: string | null }[]> {
  if (!hasDatabase()) return [];
  return getDb()
    .select({ icp: e.icp, slug: e.slug, updated: f.aresUpdatedAt })
    .from(e)
    .innerJoin(f, eq(f.ico, e.ico))
    .where(and(indexableSql(), activeEstablishmentSql(todayIso())))
    .orderBy(asc(e.icp))
    .limit(SITEMAP_CHUNK)
    .offset(chunk * SITEMAP_CHUNK);
}
