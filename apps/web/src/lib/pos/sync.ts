"use client";

/**
 * Synchronizace pokladny se serverem: odeslání offline fronty, načtení stavů (POK)
 * a konfigurace. Server je idempotentní, takže opakované odeslání stejné tržby je bezpečné.
 */
import { getDevice, getMeta, markCashSynced, rejectedSales, setMeta, unsettledSales, unsyncedCash, updateSale } from "./db";
import {
  REJECTED_POLL_MS,
  accountModeChanged,
  applyPolledStatuses,
  applyServerResult,
  batchByBytes,
  clockOffsetFrom,
  planSync,
  postBatches,
  shouldRefreshConfig,
  type BatchResponse,
  type ServerSaleResult,
  type ServerSaleStatus,
} from "./sync-result";
import type { LocalSale, PosConfig } from "./types";

type Listener = () => void;
const listeners = new Set<Listener>();
let running: Promise<SyncReport> | null = null;
let lastReport: SyncReport = { at: null, online: true, sent: 0, error: null };

export interface SyncReport {
  at: string | null;
  online: boolean;
  sent: number;
  error: string | null;
}

export function onSyncChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const l of listeners) l();
}

export function lastSync(): SyncReport {
  return lastReport;
}

export class DeviceRevokedError extends Error {}

/* ── konfigurace a režim účtu (R5.1) ── */
let configStale = false;
let configVer = 0;
let lastConfigAt = 0;
let lastRejectedPollAt = 0;

/** Server hlásí jiný režim účtu, než má pokladna – do načtení nového nastavení se neprodává. */
export function isConfigStale(): boolean {
  return configStale;
}

/** Zvyšuje se při každém načtení konfigurace ze serveru (pokladna podle něj obnoví obrazovku). */
export function configVersion(): number {
  return configVer;
}

async function checkAccountMode(serverMode: unknown): Promise<void> {
  const current = await getMeta<PosConfig>("config");
  if (!accountModeChanged(serverMode, current?.account.mode)) return;
  configStale = true;
  emit();
  const fresh = await refreshConfig();
  if (fresh && !accountModeChanged(serverMode, fresh.account.mode)) configStale = false;
  emit();
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const device = await getDevice();
  if (!device) throw new DeviceRevokedError("Zařízení není registrované");
  const sentAt = Date.now();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${device.token}`, "content-type": "application/json" },
    cache: "no-store",
  });
  // posun hodin zařízení proti serveru – pokladna podle něj opraví čas prodeje (R1.1);
  // jen z úspěšné odpovědi našeho API, ne z chybové stránky proxy (Д-10)
  const offset = res.ok ? clockOffsetFrom(res.headers.get("date"), sentAt, Date.now()) : null;
  if (offset !== null) void setMeta("clockOffset", { ms: Math.round(offset), at: Date.now() });
  if (res.status === 401) throw new DeviceRevokedError((await res.json().catch(() => ({}))).error ?? "Zařízení bylo odpojeno");
  return res;
}

export async function refreshConfig(): Promise<PosConfig | null> {
  try {
    const res = await api("/api/pokladna/config");
    if (!res.ok) return null;
    const cfg = (await res.json()) as PosConfig;
    await setMeta("config", cfg);
    lastConfigAt = Date.now();
    configVer++;
    // čerstvá konfigurace je pravda o režimu účtu
    configStale = false;
    emit();
    return cfg;
  } catch (e) {
    if (e instanceof DeviceRevokedError) throw e;
    return null;
  }
}

/** Vklady/výběry a uzávěrky – nejsou tržby, posílají se odděleně a idempotentně. */
async function syncCash(): Promise<void> {
  const { movements, closings } = await unsyncedCash();
  if (!movements.length && !closings.length) return;
  const res = await api("/api/pokladna/uzaverky", {
    method: "POST",
    body: JSON.stringify({
      movements: movements.slice(0, 200).map(({ syncedAt: _s, ...m }) => m),
      closings: closings.slice(0, 50).map(({ syncedAt: _s, unitLabel: _u, ...c }) => c),
    }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Server odpověděl ${res.status}`);
  const saved = (await res.json()) as { movements: string[]; closings: string[] };
  await markCashSynced(saved.movements, saved.closings);
}

async function doSync(): Promise<SyncReport> {
  // kiosk s trvale viditelnou kartou: konfigurace se jinak obnovuje jen při startu a návratu (R5.1);
  // zastaralá konfigurace (pokladna neprodává) se zkouší při každé synchronizaci (Д-5)
  if (shouldRefreshConfig({ stale: configStale, lastConfigAt, now: Date.now() })) await refreshConfig();
  // odmítnuté tržby mohl vlastník mezitím vyřešit – zeptáme se na ně jednou za 5 min (R5.7)
  const pollRejected = Date.now() - lastRejectedPollAt > REJECTED_POLL_MS;
  const rejected = pollRejected ? await rejectedSales() : [];
  const pending = [...(await unsettledSales()), ...rejected];
  if (!pending.length) {
    try {
      await syncCash();
      lastReport = { at: new Date().toISOString(), online: true, sent: 0, error: null };
    } catch (e) {
      if (e instanceof DeviceRevokedError) throw e;
      lastReport = { at: new Date().toISOString(), online: typeof navigator === "undefined" || navigator.onLine, sent: 0, error: e instanceof Error ? e.message : String(e) };
    }
    return lastReport;
  }
  let sent = 0;
  const plan = planSync(pending, { pollRejected });
  const rejectedIds = new Set(rejected.map((r) => r.id));
  const toPost = pending.filter((p) => plan.post.includes(p.id)).map(toWire);
  const failure = async (res: Response): Promise<BatchResponse<never>> => ({ ok: false, status: res.status, error: (await res.json().catch(() => ({}))).error ?? `Server odpověděl ${res.status}` });
  try {
    // dávky omezené i velikostí těla; neúspěšná dávka nezastaví ostatní ani dotaz na stavy (Д-10)
    const encoder = new TextEncoder();
    let error = await postBatches(
      batchByBytes(toPost, (s) => encoder.encode(JSON.stringify(s)).length),
      async (batch): Promise<BatchResponse<{ results: ServerSaleResult[]; accountMode?: string }>> => {
        const res = await api("/api/pokladna/sales", { method: "POST", body: JSON.stringify({ sales: batch }) });
        return res.ok ? { ok: true, value: await res.json() } : failure(res);
      },
      async (_batch, { results, accountMode }) => {
        for (const r of results) {
          if (r.ok) sent++;
          await updateSale(r.id, applyServerResult(r));
        }
        await checkAccountMode(accountMode);
      },
    );
    // přijaté tržby: jen stav (POK doplní server/cron), nikdy znovu odeslání
    const pollBatches: string[][] = [];
    for (let i = 0; i < plan.poll.length; i += 200) pollBatches.push(plan.poll.slice(i, i + 200));
    const pollError = await postBatches(
      pollBatches,
      async (ids): Promise<BatchResponse<{ statuses: ServerSaleStatus[]; accountMode?: string }>> => {
        const res = await api(`/api/pokladna/sales?ids=${ids.join(",")}`);
        return res.ok ? { ok: true, value: await res.json() } : failure(res);
      },
      async (ids, { statuses, accountMode }) => {
        for (const [id, patch] of applyPolledStatuses(ids, statuses, new Date(), { rejected: rejectedIds })) await updateSale(id, patch);
        await checkAccountMode(accountMode);
      },
    );
    error ??= pollError;
    try {
      await syncCash();
    } catch (e) {
      if (e instanceof DeviceRevokedError || e instanceof TypeError) throw e;
      error ??= e instanceof Error ? e.message : String(e);
    }
    if (pollRejected && !pollError) lastRejectedPollAt = Date.now();
    lastReport = { at: new Date().toISOString(), online: true, sent, error };
  } catch (e) {
    if (e instanceof DeviceRevokedError) throw e;
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    lastReport = { at: new Date().toISOString(), online: !offline && !(e instanceof TypeError), sent, error: e instanceof Error ? e.message : String(e) };
  }
  return lastReport;
}

/** Tržba tak, jak ji přijímá POST /api/pokladna/sales. */
function toWire(s: LocalSale) {
  return {
    id: s.id,
    sequence: s.sequence,
    soldAt: s.soldAt,
    unitId: s.unitId,
    staffId: s.staffId,
    lines: s.lines,
    payments: s.payments,
    discount: s.discount,
    tip: s.tip,
    refundOf: s.refundOf,
    approval: s.approval ?? null,
    mode: s.mode,
  };
}

/** Spustí synchronizaci (souběžná volání sdílí jeden běh). */
export function syncNow(): Promise<SyncReport> {
  if (!running) {
    running = doSync().finally(() => {
      running = null;
      emit();
    });
  }
  return running;
}

/** Automatická synchronizace: po připojení, při návratu do aplikace a každých 20 s. */
export function startAutoSync(): () => void {
  const tick = () => {
    void syncNow().catch(() => {});
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") tick();
  };
  window.addEventListener("online", tick);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(tick, 20_000);
  tick();
  return () => {
    window.removeEventListener("online", tick);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}

export async function emailReceipt(saleId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api("/api/pokladna/uctenka", { method: "POST", body: JSON.stringify({ saleId, email }) });
    if (res.ok) return { ok: true };
    return { ok: false, error: (await res.json().catch(() => ({}))).error ?? "Nepodařilo se odeslat" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nepodařilo se odeslat" };
  }
}

/** Ověří PIN na serveru (vlastník; R3.10). Vrací schválení vratky, nebo důvod odmítnutí. */
export async function verifyStaffPin(
  staffId: string,
  pin: string,
  purpose: "unlock" | "refund",
  refund?: { refundOf: string; amount: number },
): Promise<{ ok: true; approval: string | null } | { ok: false; error: string }> {
  try {
    // schválení vratky platí jen pro tuto tržbu a částku (R5.5)
    const res = await api("/api/pokladna/pin", { method: "POST", body: JSON.stringify({ staffId, pin, purpose, ...refund }) });
    const data = (await res.json().catch(() => ({}))) as { approval?: string | null; error?: string; retryAfter?: number };
    if (res.ok) return { ok: true, approval: data.approval ?? null };
    if (res.status === 429 && data.retryAfter) return { ok: false, error: `Příliš mnoho chybných pokusů. Zkuste to za ${Math.ceil(data.retryAfter / 60)} min.` };
    return { ok: false, error: data.error ?? "Nesprávný PIN" };
  } catch (e) {
    if (e instanceof DeviceRevokedError) throw e;
    return { ok: false, error: "PIN vlastníka se ověřuje online – zkontrolujte připojení k internetu." };
  }
}

/** „Odeslat znovu": odmítnutou tržbu vrátí do fronty (server ji znovu posoudí). */
export async function resendSale(id: string): Promise<void> {
  await updateSale(id, { status: "local", error: null });
  await syncNow().catch(() => {});
}
