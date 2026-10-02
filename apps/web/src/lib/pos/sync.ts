"use client";

/**
 * Synchronizace pokladny se serverem: odeslání offline fronty, načtení stavů (POK)
 * a konfigurace. Server je idempotentní, takže opakované odeslání stejné tržby je bezpečné.
 */
import { getDevice, markCashSynced, setMeta, unsettledSales, unsyncedCash, updateSale } from "./db";
import { applyPolledStatuses, applyServerResult, clockOffsetFrom, planSync, type ServerSaleResult, type ServerSaleStatus } from "./sync-result";
import type { PosConfig } from "./types";

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

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const device = await getDevice();
  if (!device) throw new DeviceRevokedError("Zařízení není registrované");
  const sentAt = Date.now();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${device.token}`, "content-type": "application/json" },
    cache: "no-store",
  });
  // posun hodin zařízení proti serveru – pokladna podle něj opraví čas prodeje (R1.1)
  const offset = clockOffsetFrom(res.headers.get("date"), sentAt, Date.now());
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
  const pending = await unsettledSales();
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
  const plan = planSync(pending);
  const toPost = pending.filter((p) => plan.post.includes(p.id));
  try {
    for (let i = 0; i < toPost.length; i += 50) {
      const batch = toPost.slice(i, i + 50);
      const res = await api("/api/pokladna/sales", {
        method: "POST",
        body: JSON.stringify({
          sales: batch.map((s) => ({
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
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Server odpověděl ${res.status}`);
      const { results } = (await res.json()) as { results: ServerSaleResult[] };
      for (const r of results) {
        if (r.ok) sent++;
        await updateSale(r.id, applyServerResult(r));
      }
    }
    // přijaté tržby: jen stav (POK doplní server/cron), nikdy znovu odeslání
    for (let i = 0; i < plan.poll.length; i += 200) {
      const ids = plan.poll.slice(i, i + 200);
      const res = await api(`/api/pokladna/sales?ids=${ids.join(",")}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Server odpověděl ${res.status}`);
      const { statuses } = (await res.json()) as { statuses: ServerSaleStatus[] };
      for (const [id, patch] of applyPolledStatuses(ids, statuses)) await updateSale(id, patch);
    }
    await syncCash();
    lastReport = { at: new Date().toISOString(), online: true, sent, error: null };
  } catch (e) {
    if (e instanceof DeviceRevokedError) throw e;
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    lastReport = { at: new Date().toISOString(), online: !offline && !(e instanceof TypeError), sent, error: e instanceof Error ? e.message : String(e) };
  }
  return lastReport;
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
): Promise<{ ok: true; approval: string | null } | { ok: false; error: string }> {
  try {
    const res = await api("/api/pokladna/pin", { method: "POST", body: JSON.stringify({ staffId, pin, purpose }) });
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
