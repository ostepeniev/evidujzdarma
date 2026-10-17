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
import { CATALOG_INDUSTRIES } from "@/components/catalog/industry";
import { catalogNoindexReason, indexPersons, isGone, type CatalogNoindexReason } from "@/lib/catalog-policy";
import { lookupCompany } from "./ares";

/**
 * Katalog firem a provozoven — datová vrstva.
 *
 * Zásady (GDPR, kvalita):
 *  - jen veřejné údaje z registrů (ARES, RŽP, RES ČSÚ), žádné vymyšlené texty;
 *  - u fyzických osob (OSVČ) se ulice sídla ani provozovny NIKDY nedostane do view modelu;
 *  - indexujeme postupně po krajích (CATALOG_INDEX_REGIONS) a jen záznamy ověřené v ARES;
 *  - S3 (LIA, docs/LIA-katalog-firem.md): OSVČ mají stránku, ale noindex, mimo sitemapu a v seznamech jen počtem
 *    (CATALOG_INDEX_PERSONS=1 to po posouzení právníkem změní); u OSVČ nezobrazujeme DIČ ani provozovny a živnosti
 *    ze živnostenského rejstříku; zaniklé subjekty ze seznamů hned a po 90 dnech od zániku bez stránky.
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

/* ─────────────────────────────── cache agregací v paměti (LRU) ─────────────────────────────── */

/**
 * Agregace (počty po krajích, obcích a oborech) držíme v paměti procesu, ne v ISR cache na disku (R3.3): počet klíčů
 * je omezený (MEMO_MAX, nejdéle nepoužité vypadnou), souběžné požadavky na stejný klíč čekají na jeden dotaz
 * a se `swr` se zastaralá hodnota vrátí hned a obnoví na pozadí (těžký dotaz za velký kraj neblokuje stránku).
 */
const MEMO_MAX = 5_000;
interface MemoEntry {
  at: number;
  value: Promise<unknown>;
  refreshing?: boolean;
}
const memo = new Map<string, MemoEntry>();

function memoSet(key: string, entry: MemoEntry): void {
  memo.delete(key);
  memo.set(key, entry);
  while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value!);
}

function memoize<T>(key: string, ttlMs: number, load: () => Promise<T>, opts: { swr?: boolean } = {}): Promise<T> {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit) {
    memoSet(key, hit); // naposledy použité na konec (LRU)
    if (now - hit.at < ttlMs) return hit.value as Promise<T>;
    if (opts.swr) {
      if (!hit.refreshing) {
        hit.refreshing = true;
        load().then(
          (v) => memoSet(key, { at: Date.now(), value: Promise.resolve(v) }),
          () => {
            hit.refreshing = false;
          },
        );
      }
      return hit.value as Promise<T>;
    }
  }
  const entry: MemoEntry = { at: now, value: load() };
  memoSet(key, entry);
  entry.value.catch(() => {
    if (memo.get(key) === entry) memo.delete(key);
  });
  return entry.value as Promise<T>;
}

/** Jen pro testy: vyprázdnit cache agregací. */
export function __clearCatalogMemo(): void {
  memo.clear();
}

/* ─────────────────────────────── SQL podmínky ─────────────────────────────── */

/**
 * Firma smí být v seznamech: bez námitky a nezaniklá. Literál `false` (ne parametr), aby plánovač i u připraveného
 * dotazu (generic plan) poznal, že platí podmínka částečných indexů firms_listable_* (migrace 0037).
 */
function listableSql(): SQL {
  return sql`(${f.noindex} = false and ${f.dissolvedAt} is null)`;
}

function inIndexRegionsSql(): SQL {
  const regions = indexRegions();
  if (regions.length === 0) return sql`false`;
  return sql`${f.regionCode} in (${sql.join(
    regions.map((r) => sql`${r}`),
    sql`, `,
  )})`;
}

/**
 * Právnická osoba (ne OSVČ): stejná podmínka jako isNaturalPerson() – neznámá právní forma = fyzická osoba (fail-closed).
 * Literál `is_natural_person = false` odpovídá částečným indexům firms_listable_legal_* (migrace 0038).
 */
function legalSql(): SQL {
  return sql`(${f.isNaturalPerson} = false and ${f.legalForm} is not null and ${f.legalForm} !~ '^(10[0-9]|42[45])$')`;
}

/** Firma smí být indexována (a v sitemapě): bez námitky, nezaniklá, indexovaný kraj, ověřená v ARES, právnická osoba. */
function indexableSql(): SQL {
  const parts: SQL[] = [listableSql(), inIndexRegionsSql()];
  if (requireAresVerified()) parts.push(isNotNull(f.aresUpdatedAt));
  if (!indexPersons()) parts.push(legalSql());
  return and(...parts)!;
}

function activeEstablishmentSql(today: string): SQL {
  return or(isNull(e.endedAt), sql`${e.endedAt} > ${today}`)!;
}

/**
 * Má subjekt aspoň jeden obor CZ-NACE začínající některým z prefixů? Do WHERE seznamů: u poddotazu EXISTS plánovač
 * počítá s běžnou selektivitou a zvolí průchod indexem v pořadí názvu, který skončí po stránce řádků (ověřeno EXPLAIN
 * nad 200 000 řádky); u regulárního výrazu by odhadl 0,5 % a v Praze četl celou obec.
 */
function nacePrefixSql(prefixes: readonly string[]): SQL {
  if (prefixes.length === 0) return sql`false`;
  const patterns = prefixes.map((p) => `${p.replace(/\D/g, "")}%`);
  return sql`exists (select 1 from unnest(${f.nace}) as c(code) where c.code like any (array[${sql.join(
    patterns.map((p) => sql`${p}`),
    sql`, `,
  )}]::text[]))`;
}

/** Regulární výraz „kód začíná některým z prefixů“ nad kódy spojenými mezerou (array_to_string). */
function naceRegex(prefixes: readonly string[]): string {
  const clean = prefixes.map((p) => p.replace(/\D/g, "")).filter(Boolean);
  return clean.length ? `(^| )(${clean.join("|")})` : "x^";
}

/* ─────────────────────────────── view modely ─────────────────────────────── */

export type NoindexReason = CatalogNoindexReason;

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
  /** jen u právnických osob a jen z ARES (u OSVČ bývá DIČ odvozené z rodného čísla – nezobrazujeme) */
  dic: string | null;
  /** null = neznámé (údaj zatím neověřen v ARES) */
  vatPayer: boolean | null;
  foundedAt: string | null;
  dissolvedAt: string | null;
  /** null u OSVČ */
  street: string | null;
  city: string | null;
  /** kód obce (RÚIAN; u záznamů jen z RES může být kód základní územní jednotky) */
  cityCode: number | null;
  /** null u OSVČ */
  postalCode: string | null;
  regionCode: number | null;
  nace: string[];
  eetRelevance: EetRelevance;
  /** null = provozovny zatím neověřeny v RŽP; u OSVČ vždy null (údaje živnostenského rejstříku u fyzických osob neukazujeme) */
  establishments: EstablishmentView[] | null;
  claimed: boolean;
  /** odkud a k jakému datu jsou údaje */
  source: { kind: "ares" | "res"; date: string };
  inDb: boolean;
  index: boolean;
  noindexReason: NoindexReason | null;
  /** zanikl před víc než 90 dny – stránka se nezobrazuje (404) */
  gone: boolean;
}

function firmNoindexReason(row: FirmRow): NoindexReason | null {
  return catalogNoindexReason(
    {
      noindex: row.noindex,
      dissolvedAt: row.dissolvedAt,
      natural: row.isNaturalPerson || isNaturalPerson(row.legalForm),
      indexRegion: isIndexRegion(row.regionCode),
      verified: !!row.aresUpdatedAt,
    },
    { requireAres: requireAresVerified(), indexPersons: indexPersons() },
  );
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
    dic: natural || !verified ? null : row.dic,
    vatPayer: verified ? row.vatPayer : null,
    foundedAt: row.foundedAt,
    dissolvedAt: row.dissolvedAt,
    street: natural ? null : row.street,
    city: row.city,
    cityCode: row.cityCode,
    postalCode: natural ? null : row.postalCode,
    regionCode: row.regionCode,
    nace: row.nace,
    eetRelevance: row.eetRelevance,
    establishments: verified && !natural ? ests.map((x) => establishmentView(x, natural)) : null,
    claimed: !!row.claimedAccountId,
    source: verified
      ? { kind: "ares", date: row.aresUpdatedAt! }
      : { kind: "res", date: row.syncedAt.toISOString().slice(0, 10) },
    inDb: true,
    index: reason === null,
    noindexReason: reason,
    gone: isGone(row.dissolvedAt, todayIso()),
  };
}

function establishmentSlug(name: string | null, firmName: string, city: string | null): string {
  return slugify([name ?? firmName, name ? null : city].filter(Boolean).join(" "), 80) || "provozovna";
}

/** ARES (živý zdroj pro firmy mimo DB) neodpověděl: stránka ukáže dočasnou nedostupnost místo chyby 500. */
export class AresUnavailableError extends Error {
  constructor(readonly ico: string) {
    super("ARES je dočasně nedostupný");
  }
}

/** Živý záznam z ARES (firma ještě není v DB) — vždy noindex. */
async function liveFirmView(ico: string): Promise<FirmView | null> {
  let live: Awaited<ReturnType<typeof lookupCompany>>;
  try {
    live = await lookupCompany(ico, { pool: "catalog" });
  } catch {
    // síť, 403/5xx, vyčerpaný limit (AresBusyError) – IČO v ARES neexistuje je null, ne výjimka
    throw new AresUnavailableError(ico);
  }
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
    dic: natural ? null : s.dic,
    vatPayer: s.vatPayer,
    foundedAt: s.foundedAt,
    dissolvedAt: s.dissolvedAt,
    street: natural ? null : s.address.street,
    city: s.address.city,
    cityCode: s.address.cityCode,
    postalCode: natural ? null : s.address.postalCode,
    regionCode: s.address.regionCode,
    nace: s.nace,
    eetRelevance: firmRel,
    establishments: live.rzp && !natural ? ests : null,
    claimed: false,
    source: { kind: "ares", date: live.fetchedAt.slice(0, 10) },
    inDb: false,
    index: false,
    noindexReason: "not-in-db",
    gone: isGone(s.dissolvedAt, today),
  };
}

/** Je firma v našem katalogu (DB)? Ostatní se ukazují živě z ARES a necachují se. */
export const isFirmInCatalog = cache(async (icoInput: string): Promise<boolean> => {
  const ico = normalizeIco(icoInput);
  if (!ico || !isValidIco(ico) || !hasDatabase()) return false;
  const [row] = await getDb().select({ ico: f.ico }).from(f).where(eq(f.ico, ico)).limit(1);
  return !!row;
});

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
  // provozovny OSVČ (údaje živnostenského rejstříku o fyzické osobě) ani zaniklých subjektů po lhůtě nezveřejňujeme
  if (!firm || firm.isNaturalPerson || firm.gone) return null;
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
  /** kód obce (firms.city_code) */
  cityCode?: number;
  relevance?: EetRelevance;
  nacePrefixes?: readonly string[];
  /** YYYY-MM podle data vzniku */
  foundedMonth?: string;
  /** jen firmy z indexovaných krajů */
  onlyIndexRegions?: boolean;
  /** jen právnické osoby – OSVČ se v seznamech ukazují jen počtem (S3) */
  legalOnly?: boolean;
}

export const PER_PAGE = 50;

/** Deduplikováno v rámci requestu (generateMetadata + stránka volají se stejnými argumenty). */
export function listFirms(filter: ListFilter, page = 1, perPage = PER_PAGE): Promise<{ items: FirmListItem[]; total: number }> {
  return listFirmsCached(JSON.stringify(filter), page, perPage);
}

const listFirmsCached = cache((filterJson: string, page: number, perPage: number) => listFirmsImpl(JSON.parse(filterJson) as ListFilter, page, perPage));

function listQuery(filter: ListFilter): { where: SQL; order: SQL[] } {
  const conds: SQL[] = [listableSql()];
  if (filter.regionCode != null) conds.push(eq(f.regionCode, filter.regionCode));
  if (filter.cityCode != null) conds.push(eq(f.cityCode, filter.cityCode));
  if (filter.relevance) conds.push(eq(f.eetRelevance, filter.relevance));
  if (filter.nacePrefixes) conds.push(nacePrefixSql(filter.nacePrefixes));
  if (filter.onlyIndexRegions) conds.push(inIndexRegionsSql());
  if (filter.legalOnly) conds.push(legalSql());
  let order = [asc(f.name), asc(f.ico)];
  if (filter.foundedMonth) {
    const start = `${filter.foundedMonth}-01`;
    conds.push(sql`${f.foundedAt} >= ${start}::date and ${f.foundedAt} < (${start}::date + interval '1 month')`);
    order = [desc(f.foundedAt), asc(f.name), asc(f.ico)];
  }
  return { where: and(...conds)!, order };
}

/**
 * Jen položky stránky, bez count(*) – pro seznamy, jejichž počet už známe z agregace v paměti (obec × obor).
 * Velká obec (Praha) by jinak při každém zobrazení počítala statisíce řádků.
 */
export function listFirmItems(filter: ListFilter, page = 1, perPage = PER_PAGE): Promise<FirmListItem[]> {
  return listFirmItemsCached(JSON.stringify(filter), page, perPage);
}

const listFirmItemsCached = cache(async (filterJson: string, page: number, perPage: number): Promise<FirmListItem[]> => {
  if (!hasDatabase()) return [];
  const { where, order } = listQuery(JSON.parse(filterJson) as ListFilter);
  return getDb()
    .select(listColumns)
    .from(f)
    .where(where)
    .orderBy(...order)
    .limit(perPage)
    .offset((page - 1) * perPage);
});

async function listFirmsImpl(filter: ListFilter, page: number, perPage: number): Promise<{ items: FirmListItem[]; total: number }> {
  if (!hasDatabase()) return { items: [], total: 0 };
  const { where, order } = listQuery(filter);
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

export interface ListCounts {
  /** všech subjektů v seznamu (bez námitky, nezaniklých) */
  total: number;
  /** z toho právnických osob (jmenovitě v seznamu) */
  legal: number;
  /** z toho OSVČ (v seznamu jen počtem) */
  persons: number;
}

/**
 * Počty pro seznam (kraj, nové firmy): jeden průchod s `count(*) filter`, v paměti 1 h. Stránkování jde po právnických
 * osobách, počet OSVČ je jen číslo pod seznamem.
 */
export function listCounts(filter: Omit<ListFilter, "legalOnly">): Promise<ListCounts> {
  if (!hasDatabase()) return Promise.resolve({ total: 0, legal: 0, persons: 0 });
  return memoize(`listCounts:${JSON.stringify(filter)}:${indexRegions().join(",")}`, 3_600_000, async () => {
    const { where } = listQuery(filter);
    const [row] = await getDb()
      .select({ total: sql<number>`count(*)::int`, legal: sql<number>`(count(*) filter (where ${legalSql()}))::int` })
      .from(f)
      .where(where);
    const total = Number(row?.total ?? 0);
    const legal = Number(row?.legal ?? 0);
    return { total, legal, persons: total - legal };
  });
}

/**
 * Vyhledání podle názvu (pg_trgm) — max. `limit` výsledků. Jen právnické osoby v seznamu (bez námitky a zaniklých):
 * OSVČ se podle jména nevyhledávají, svou stránku najdou podle IČO (S3, LIA).
 */
export async function searchFirmsByName(q: string, limit = 20): Promise<FirmListItem[]> {
  const query = q.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!hasDatabase() || query.length < 2) return [];
  const like = `%${query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return getDb()
    .select(listColumns)
    .from(f)
    .where(and(listableSql(), legalSql(), or(sql`${f.name} % ${query}`, sql`${f.name} ilike ${like}`)))
    .orderBy(sql`similarity(${f.name}, ${query}) desc`, asc(f.name))
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

/** Posledních N měsíců vzniku firem v indexovaných krajích (cache 1 h); `legal` = z toho právnických osob. */
export async function foundingMonths(limit = 12): Promise<{ month: string; count: number; legal: number }[]> {
  if (!hasDatabase()) return [];
  return memoize(`foundingMonths:${limit}:${indexRegions().join(",")}`, 3_600_000, async () => {
    const today = todayIso();
    const from = `${Number(today.slice(0, 4)) - 2}${today.slice(4, 7)}-01`;
    const month = sql<string>`to_char(${f.foundedAt}, 'YYYY-MM')`;
    const rows = await getDb()
      .select({ month, count: count(), legal: sql<number>`(count(*) filter (where ${legalSql()}))::int` })
      .from(f)
      .where(and(listableSql(), inIndexRegionsSql(), sql`${f.foundedAt} >= ${from}::date`, sql`${f.foundedAt} <= ${today}::date`))
      .groupBy(month)
      .orderBy(desc(month))
      .limit(limit);
    return rows.map((r) => ({ month: r.month, count: r.count, legal: Number(r.legal) }));
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

/* ─────────────────────────────── obec × obor ─────────────────────────────── */

/**
 * Stránka obor × obec se indexuje (a je v sitemapě) jen s aspoň tolika indexovatelnými subjekty – tenké stránky
 * se 2–3 firmami by jen ředily kvalitu katalogu. Méně = noindex, follow.
 */
export const OBEC_MIN_FIRMS = 5;
/** Rozcestník obce /firmy/obec/… se indexuje od tolika subjektů ověřených v ARES (S3). */
export const OBEC_HUB_MIN_FIRMS = 10;

export interface ObecIndustryCount {
  /** subjekty v seznamu (bez námitky, nezaniklé) */
  listable: number;
  /** z toho indexovatelné (indexovaný kraj, ověřeno v ARES) */
  indexable: number;
  /** z toho právnické osoby (jmenovitě v seznamu; OSVČ jen počtem) */
  legal: number;
  /** z toho vzniklé za posledních 12 měsíců */
  new12: number;
}

export interface ObecStats {
  code: number;
  /** nejčastější zápis názvu obce mezi subjekty s tímto kódem */
  name: string;
  regionCode: number;
  /** všech subjektů v seznamu */
  total: number;
  /** z toho právnických osob */
  legal: number;
  /** z toho ověřených v ARES */
  verified: number;
  /** z toho vzniklých za posledních 12 měsíců */
  new12: number;
  /** klíč = slug oboru (CATALOG_INDUSTRIES) */
  industries: Record<string, ObecIndustryCount>;
}

const SIX_HOURS = 6 * 3_600_000;

/** Datum před 12 měsíci (YYYY-MM-DD) – hranice „nové za 12 měsíců“. */
export function twelveMonthsAgo(today: string = todayIso()): string {
  const md = today.slice(5, 10) === "02-29" ? "02-28" : today.slice(5, 10);
  return `${Number(today.slice(0, 4)) - 1}-${md}`;
}

/**
 * Počty subjektů obec × obor za celý kraj – jeden průchod tabulkou na kraj, v paměti 6 h (data RES se mění 2× měsíčně),
 * po zastarání se obnoví na pozadí. Slouží stránkám obor × obec a obce, odkazům mezi obcemi a obory i sitemapě.
 */
export function regionObecStats(regionCode: number): Promise<Map<number, ObecStats>> {
  if (!hasDatabase()) return Promise.resolve(new Map());
  return memoize(
    `obecStats:${regionCode}`,
    SIX_HOURS,
    async () => {
      // Tři vrstvy, aby se drahé výrazy počítaly jednou na řádek (ne 40×): b = příznaky řádku a obory jako text,
      // s = příznak oboru (jeden regulární výraz na obor), venku jen count(*) filter nad booleany. Na 80 tis. řádků
      // kraje 51 zhruba 5× rychlejší než regulární výraz v každém filtru (S3, měření v docs/deploy.md).
      const since = twelveMonthsAgo();
      const db = getDb();
      const b = db
        .select({
          code: sql<number>`${f.cityCode}`.as("code"),
          city: sql<string>`${f.city}`.as("city"),
          legal: sql<boolean>`${legalSql()}`.as("legal"),
          verified: sql<boolean>`(${f.aresUpdatedAt} is not null)`.as("verified"),
          fresh: sql<boolean>`(${f.foundedAt} >= ${since}::date)`.as("fresh"),
          n: sql<string>`array_to_string(${f.nace}, ' ')`.as("n"),
        })
        .from(f)
        .where(and(listableSql(), eq(f.regionCode, regionCode), isNotNull(f.cityCode), isNotNull(f.city)))
        .as("b");
      const flags: Record<string, SQL.Aliased<boolean>> = {};
      CATALOG_INDUSTRIES.forEach((ind, i) => {
        flags[`i${i}`] = sql<boolean>`(${b.n} ~ ${naceRegex(ind.nace)})`.as(`i${i}`);
      });
      // LIMIT = optimalizační zábrana (poddotaz s LIMIT/OFFSET Postgres nerozbalí): bez ní by regulární výraz počítal
      // v každém ze 40 filtrů znovu (80 tis. řádků: 1,4 s → 0,3 s). Drizzle „offset 0“ vynechá, proto LIMIT bez praktického stropu.
      const s = db.select({ code: b.code, city: b.city, legal: b.legal, verified: b.verified, fresh: b.fresh, ...flags }).from(b).limit(2_147_483_647).as("s");
      const col = (name: string) => sql.raw(`"s"."${name}"`);
      const cols: Record<string, SQL<number>> = {};
      CATALOG_INDUSTRIES.forEach((_, i) => {
        const m = col(`i${i}`);
        cols[`l${i}`] = sql<number>`(count(*) filter (where ${m}))::int`;
        cols[`v${i}`] = sql<number>`(count(*) filter (where ${m} and ${col("verified")}))::int`;
        cols[`p${i}`] = sql<number>`(count(*) filter (where ${m} and ${col("legal")}))::int`;
        cols[`n${i}`] = sql<number>`(count(*) filter (where ${m} and ${col("fresh")}))::int`;
      });
      const rows = (await db
        .select({
          code: s.code,
          name: sql<string>`mode() within group (order by ${col("city")})`,
          total: sql<number>`count(*)::int`,
          legal: sql<number>`(count(*) filter (where ${col("legal")}))::int`,
          verified: sql<number>`(count(*) filter (where ${col("verified")}))::int`,
          new12: sql<number>`(count(*) filter (where ${col("fresh")}))::int`,
          ...cols,
        })
        .from(s)
        .groupBy(s.code)) as unknown as Record<string, number | string | null>[];
      const indexRegion = isIndexRegion(regionCode);
      const needAres = requireAresVerified();
      const out = new Map<number, ObecStats>();
      for (const r of rows) {
        const code = Number(r.code);
        if (!code || !r.name) continue;
        const industries: Record<string, ObecIndustryCount> = {};
        CATALOG_INDUSTRIES.forEach((ind, i) => {
          const listable = Number(r[`l${i}`] ?? 0);
          const verified = Number(r[`v${i}`] ?? 0);
          industries[ind.slug] = {
            listable,
            indexable: indexRegion ? (needAres ? verified : listable) : 0,
            legal: Number(r[`p${i}`] ?? 0),
            new12: Number(r[`n${i}`] ?? 0),
          };
        });
        out.set(code, {
          code,
          name: String(r.name),
          regionCode,
          total: Number(r.total ?? 0),
          legal: Number(r.legal ?? 0),
          verified: Number(r.verified ?? 0),
          new12: Number(r.new12 ?? 0),
          industries,
        });
      }
      return out;
    },
    { swr: true },
  );
}

/** Kraj obce podle subjektů v DB (cache 6 h); null = obec v katalogu nemáme. */
export function obecRegion(code: number): Promise<number | null> {
  if (!hasDatabase() || !Number.isSafeInteger(code) || code <= 0 || code > 2_147_483_647) return Promise.resolve(null);
  return memoize(`obecRegion:${code}`, SIX_HOURS, async () => {
    const [row] = await getDb()
      .select({ region: f.regionCode })
      .from(f)
      .where(and(listableSql(), eq(f.cityCode, code), isNotNull(f.regionCode)))
      .limit(1);
    return row?.region ?? null;
  });
}

/** Obec s počty, nebo null (neznámý kód). */
export async function getObecStats(code: number): Promise<ObecStats | null> {
  const region = await obecRegion(code);
  if (region == null) return null;
  return (await regionObecStats(region)).get(code) ?? null;
}

/** Indexovat stránku obor × obec? Indexovaný kraj a aspoň OBEC_MIN_FIRMS indexovatelných subjektů. */
export function isObecIndustryIndexable(stats: ObecStats, industrySlug: string): boolean {
  return isIndexRegion(stats.regionCode) && (stats.industries[industrySlug]?.indexable ?? 0) >= OBEC_MIN_FIRMS;
}

/** Indexovat rozcestník obce? Indexovaný kraj a aspoň OBEC_HUB_MIN_FIRMS subjektů ověřených v ARES (S3). */
export function isObecHubIndexable(stats: ObecStats): boolean {
  if (!isIndexRegion(stats.regionCode)) return false;
  return (requireAresVerified() ? stats.verified : stats.total) >= OBEC_HUB_MIN_FIRMS;
}

export interface ObecIndustryPageRef {
  industry: string;
  code: number;
  name: string;
  indexable: number;
}

/** Všechny indexovatelné stránky obor × obec v indexovaných krajích (pro sitemapu), seřazené stabilně. */
export async function indexableObecIndustryPages(): Promise<ObecIndustryPageRef[]> {
  if (!hasDatabase()) return [];
  const out: ObecIndustryPageRef[] = [];
  for (const region of indexRegions()) {
    const stats = await regionObecStats(region);
    for (const o of stats.values()) {
      for (const ind of CATALOG_INDUSTRIES) {
        if (isObecIndustryIndexable(o, ind.slug)) out.push({ industry: ind.slug, code: o.code, name: o.name, indexable: o.industries[ind.slug]!.indexable });
      }
    }
  }
  return out.sort((a, b) => (a.industry === b.industry ? a.code - b.code : a.industry < b.industry ? -1 : 1));
}

/** Indexovatelné rozcestníky obcí (pro /firmy/sitemap.xml), podle kódu obce. */
export async function indexableObecHubs(): Promise<{ code: number; name: string }[]> {
  if (!hasDatabase()) return [];
  const out: { code: number; name: string }[] = [];
  for (const region of indexRegions()) {
    for (const o of (await regionObecStats(region)).values()) if (isObecHubIndexable(o)) out.push({ code: o.code, name: o.name });
  }
  return out.sort((a, b) => a.code - b.code);
}

/** Součty oborů za kraj (z agregace obcí v paměti): kolik subjektů a z toho právnických osob. */
export async function regionIndustryTotals(regionCode: number): Promise<Record<string, { listable: number; legal: number }>> {
  const stats = await regionObecStats(regionCode);
  const out: Record<string, { listable: number; legal: number }> = {};
  for (const ind of CATALOG_INDUSTRIES) out[ind.slug] = { listable: 0, legal: 0 };
  for (const o of stats.values()) {
    for (const ind of CATALOG_INDUSTRIES) {
      const c = o.industries[ind.slug];
      if (!c) continue;
      out[ind.slug]!.listable += c.listable;
      out[ind.slug]!.legal += c.legal;
    }
  }
  return out;
}

/**
 * Nejnovější právnické osoby v obci (rozcestník obce): vzniklé za posledních 12 měsíců, od nejnovější. Jde po indexu
 * firms_listable_legal_city_name (obec má nejvýš jednotky tisíc firem).
 */
export async function recentLegalFirms(cityCode: number, limit = 10): Promise<FirmListItem[]> {
  if (!hasDatabase()) return [];
  return getDb()
    .select(listColumns)
    .from(f)
    .where(and(listableSql(), legalSql(), eq(f.cityCode, cityCode), sql`${f.foundedAt} >= ${twelveMonthsAgo()}::date`))
    .orderBy(desc(f.foundedAt), asc(f.name), asc(f.ico))
    .limit(limit);
}

/* ─────────────────────────────── stránka firmy: okolí a stejná adresa ─────────────────────────────── */

/**
 * „Podobné firmy v obci“: stejný obor ve stejné obci, jen právnické osoby, sousedé podle abecedy (od názvu firmy dál, pak od začátku).
 * Každá firma tak dostane odkazy od svých sousedů – ne všechny stránky na první firmy v abecedě. Dotaz jde po indexu
 * firms_listable_city_name a skončí po `limit` řádcích i v Praze.
 */
export async function similarFirms(
  firm: { ico: string; name: string; cityCode: number | null },
  nacePrefixes: readonly string[],
  limit = 6,
): Promise<FirmListItem[]> {
  if (!hasDatabase() || firm.cityCode == null || nacePrefixes.length === 0) return [];
  // jen právnické osoby (S3): OSVČ jmenovitě v seznamech neukazujeme
  const base = and(listableSql(), legalSql(), eq(f.cityCode, firm.cityCode), nacePrefixSql(nacePrefixes), sql`${f.ico} <> ${firm.ico}`)!;
  const db = getDb();
  const after = await db
    .select(listColumns)
    .from(f)
    .where(and(base, sql`${f.name} > ${firm.name}`))
    .orderBy(asc(f.name), asc(f.ico))
    .limit(limit);
  if (after.length >= limit) return after;
  const before = await db
    .select(listColumns)
    .from(f)
    .where(and(base, sql`${f.name} <= ${firm.name}`))
    .orderBy(asc(f.name), asc(f.ico))
    .limit(limit - after.length);
  const seen = new Set(after.map((x) => x.ico));
  return [...after, ...before.filter((x) => !seen.has(x.ico))];
}

/**
 * „Další firmy na stejné adrese“ – JEN právnické osoby, a to na obou stranách: u OSVČ adresu sídla neukazujeme
 * (bývá to bydliště), takže ji nesmíme prozradit ani nepřímo (AGENTS 11). Neznámá právní forma = fyzická osoba
 * (fail-closed, isNaturalPerson). Index firms_legal_address.
 */
export async function sameAddressFirms(
  firm: { ico: string; isNaturalPerson: boolean; legalForm: string | null; street: string | null; cityCode: number | null },
  limit = 10,
): Promise<{ items: FirmListItem[]; more: boolean }> {
  if (!hasDatabase() || firm.isNaturalPerson || isNaturalPerson(firm.legalForm) || !firm.street || firm.cityCode == null) return { items: [], more: false };
  const rows = await getDb()
    .select(listColumns)
    .from(f)
    .where(
      and(
        legalAddressSql(),
        eq(f.cityCode, firm.cityCode),
        eq(f.street, firm.street),
        sql`${f.ico} <> ${firm.ico}`,
      ),
    )
    .orderBy(asc(f.name), asc(f.ico))
    .limit(limit + 1);
  const items = rows.filter((r) => !r.isNaturalPerson && !isNaturalPerson(r.legalForm)).slice(0, limit);
  return { items, more: rows.length > limit };
}

/** Právnická osoba v seznamu se známou ulicí – stejné podmínky jako částečný index firms_legal_address. */
function legalAddressSql(): SQL {
  return and(listableSql(), legalSql(), isNotNull(f.street))!;
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
    .where(and(indexableSql(), legalSql(), activeEstablishmentSql(todayIso())));
  return row?.n ?? 0;
}

export async function indexableEstablishmentsChunk(chunk: number): Promise<{ icp: string; slug: string; updated: string | null }[]> {
  if (!hasDatabase()) return [];
  return getDb()
    .select({ icp: e.icp, slug: e.slug, updated: f.aresUpdatedAt })
    .from(e)
    .innerJoin(f, eq(f.ico, e.ico))
    // provozovny jen u právnických osob – i kdyby se OSVČ jednou indexovaly (CATALOG_INDEX_PERSONS), údaje ŽR o nich ne
    .where(and(indexableSql(), legalSql(), activeEstablishmentSql(todayIso())))
    .orderBy(asc(e.icp))
    .limit(SITEMAP_CHUNK)
    .offset(chunk * SITEMAP_CHUNK);
}
