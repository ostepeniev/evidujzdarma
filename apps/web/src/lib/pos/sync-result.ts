/**
 * Jak pokladna naloží s výsledkem serveru pro jednu tržbu (čistá logika, testovaná zvlášť).
 * Р2: dočasná chyba tržbu nechává ve frontě, trvalá ji ukáže jako „Odmítnuto" s možností
 * „Odeslat znovu" – nikdy ji nezahodí.
 */
import type { LocalSale, LocalStatus, PosMode } from "./types";

const POS_MODES: readonly PosMode[] = ["mock", "playground", "production"];

/**
 * Režim tržby tak, jak ji přijal server (R8.6, Р3): po „Odeslat v aktuálním režimu“ server tržbu eviduje v jiném režimu,
 * než v jakém ji pokladna prodala. Neznámá hodnota se ignoruje.
 */
const serverMode = (mode: unknown): { mode?: PosMode } => (POS_MODES.includes(mode as PosMode) ? { mode: mode as PosMode } : {});

export interface ServerSaleResult {
  id: string;
  ok: boolean;
  retryable?: boolean;
  quarantined?: boolean;
  code?: string;
  error?: string;
  status?: LocalStatus;
  confirmationCode?: string | null;
  lastError?: string | null;
  /** režim, ve kterém tržbu eviduje server (odpověď POST obsahuje její stav) – R8.6 */
  mode?: PosMode;
}

export function applyServerResult(r: ServerSaleResult, now = new Date()): Partial<LocalSale> {
  if (!r.ok) {
    if (r.retryable) return { status: "local", error: r.error ?? "Server je dočasně nedostupný, tržba se odešle znovu." };
    return {
      status: "rejected",
      error: r.quarantined ? `${r.error ?? "Tržbu nebylo možné přijmout."} Tržba je uložená na serveru a čeká na rozhodnutí vlastníka.` : (r.error ?? "Tržbu se nepodařilo uložit"),
      quarantined: !!r.quarantined,
    };
  }
  return {
    ...serverMode(r.mode),
    status: r.status ?? "queued",
    confirmationCode: r.confirmationCode ?? null,
    error: r.status === "rejected" ? (r.lastError ?? "Finanční správa tržbu odmítla") : (r.lastError ?? null),
    quarantined: false,
    syncedAt: now.toISOString(),
  };
}

/**
 * Co se při synchronizaci s tržbou udělá (R1.8): POST jen pro tržby, které server ještě nemá;
 * u přijatých tržeb se jen ptáme na stav – odesílání do FS řídí server podle backoffu.
 */
export function planSync(sales: Pick<LocalSale, "id" | "status" | "resolution">[], opts: { pollRejected?: boolean } = {}): { post: string[]; poll: string[] } {
  const post: string[] = [];
  const poll: string[] = [];
  for (const s of sales) {
    if (s.status === "local") post.push(s.id);
    else if (s.status === "queued" || s.status === "sending" || s.status === "failed") poll.push(s.id);
    // odmítnuté: vlastník je mohl vyřešit (odeslat znovu, karanténa) – ptáme se řidčeji (R5.7)
    else if (opts.pollRejected && s.status === "rejected" && !s.resolution) poll.push(s.id);
  }
  return { post, poll };
}

/** Odmítnuté tržby, které ještě čekají na vyřízení – jen ty dělají pokladnu „nečistou“ (Р2, R5.7). */
export function unresolvedRejected<T extends Pick<LocalSale, "status" | "resolution">>(sales: T[]): T[] {
  return sales.filter((s) => s.status === "rejected" && !s.resolution);
}

/** Jak často se ptát na stav odmítnutých tržeb. */
export const REJECTED_POLL_MS = 5 * 60_000;

export interface ServerSaleStatus {
  id: string;
  status: LocalStatus;
  confirmationCode: string | null;
  lastError: string | null;
  /** režim, ve kterém tržbu eviduje server (R8.6) */
  mode?: PosMode;
  /** tržba není v evidenci, je v karanténě: čeká na vlastníka, nebo ji vyřídil ručně (R5.7) */
  quarantine?: "open" | "dismissed";
}

/**
 * Výsledek dotazu na stavy. Přijatou tržbu, kterou server nezná (např. obnova ze zálohy), pošleme znovu;
 * odmítnutou ne – tu musí vyřešit vlastník (R5.7).
 */
export function applyPolledStatuses(
  ids: string[],
  statuses: ServerSaleStatus[],
  now = new Date(),
  opts: { rejected?: ReadonlySet<string> } = {},
): [string, Partial<LocalSale>][] {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const out: [string, Partial<LocalSale>][] = [];
  for (const id of ids) {
    const s = byId.get(id);
    if (!s) {
      if (!opts.rejected?.has(id)) out.push([id, { status: "local" }]);
      continue;
    }
    if (s.quarantine === "dismissed") {
      out.push([id, { status: "rejected", quarantined: false, resolution: "dismissed", error: `Vyřízeno vlastníkem: ${s.lastError ?? "bez poznámky"}` }]);
      continue;
    }
    if (s.quarantine === "open") {
      out.push([id, { status: "rejected", quarantined: true }]);
      continue;
    }
    out.push([id, { ...applyServerResult({ id, ok: true, status: s.status, confirmationCode: s.confirmationCode, lastError: s.lastError, mode: s.mode }, now), resolution: undefined }]);
  }
  return out;
}

/** Hodiny zařízení vs. server: posun z hlavičky Date (přesnost ~1 s). */
/**
 * Nejvyšší posun hodin, který bereme vážně (Д-10): víc než 45 dní server stejně nepřijme (tržba půjde do karantény
 * s vysvětlením) a takový údaj je spíš nesmyslná hlavička Date (proxy, chybová stránka) než skutečný čas.
 */
export const MAX_CLOCK_OFFSET_MS = 45 * 86_400_000;

export function clockOffsetFrom(dateHeader: string | null, sentAt: number, receivedAt: number): number | null {
  if (!dateHeader) return null;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return null;
  // server odpověděl někdy mezi odesláním a přijetím – vezmeme střed
  const offset = server + 500 - (sentAt + receivedAt) / 2;
  return Math.abs(offset) > MAX_CLOCK_OFFSET_MS ? null : offset;
}

/** Limity jedné dávky tržeb: reverse proxy přijme tělo do 1 MB – dávka má nejvýš čtvrtinu (Д-10). */
export const SALES_BATCH = { maxItems: 50, maxBytes: 256 * 1024 } as const;

/** Rozdělí položky do dávek podle počtu i velikosti (jedna příliš velká položka jde sama). */
export function batchByBytes<T>(items: T[], size: (t: T) => number, opts: { maxItems: number; maxBytes: number } = SALES_BATCH): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let bytes = 0;
  for (const it of items) {
    const b = size(it);
    if (cur.length && (cur.length >= opts.maxItems || bytes + b > opts.maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(it);
    bytes += b;
  }
  if (cur.length) out.push(cur);
  return out;
}

export type BatchResponse<R> = { ok: true; value: R } | { ok: false; status: number; error: string };

/**
 * Odešle dávky postupně. 413 (tělo moc velké) dávku rozpůlí; jiná chyba jedné dávky nezastaví ostatní (Д-10).
 * Vrací první chybu (nebo null). Výjimka (síť, odpojené zařízení) běh přeruší – to řeší volající.
 */
export async function postBatches<T, R>(batches: T[][], post: (batch: T[]) => Promise<BatchResponse<R>>, onOk: (batch: T[], value: R) => Promise<void>): Promise<string | null> {
  const queue = [...batches];
  let firstError: string | null = null;
  while (queue.length) {
    const batch = queue.shift()!;
    const r = await post(batch);
    if (r.ok) {
      await onOk(batch, r.value);
      continue;
    }
    if (r.status === 413 && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      queue.unshift(batch.slice(0, mid), batch.slice(mid));
      continue;
    }
    firstError ??= r.error;
  }
  return firstError;
}

/** Čas prodeje opravený o známý posun hodin (jen při posunu nad 30 s z posledních 24 h). */
export function correctedNow(offset: { ms: number; at: number } | undefined, now = Date.now()): number {
  if (!offset || Math.abs(offset.ms) < 30_000 || now - offset.at > 86_400_000) return now;
  return now + offset.ms;
}

/**
 * Server hlásí jiný režim účtu, než má pokladna v uložené konfiguraci → pokladna má staré nastavení
 * a nesmí prodávat, dokud ho nenačte (R5.1).
 */
export function accountModeChanged(serverMode: unknown, configMode: string | undefined): boolean {
  return typeof serverMode === "string" && serverMode !== "" && serverMode !== configMode;
}

/** Konfiguraci obnovujeme nejméně jednou za 5 minut, i když se nic nezměnilo (R5.1). */
export const CONFIG_REFRESH_MS = 5 * 60_000;

/**
 * Načíst konfiguraci teď? Zastaralou (server hlásí jiný režim) při každé synchronizaci – pokladna do té doby
 * neprodává (Д-5); jinak jednou za CONFIG_REFRESH_MS.
 */
export function shouldRefreshConfig(o: { stale: boolean; lastConfigAt: number; now: number }): boolean {
  return o.stale || o.now - o.lastConfigAt > CONFIG_REFRESH_MS;
}
