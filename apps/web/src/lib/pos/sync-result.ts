/**
 * Jak pokladna naloží s výsledkem serveru pro jednu tržbu (čistá logika, testovaná zvlášť).
 * Р2: dočasná chyba tržbu nechává ve frontě, trvalá ji ukáže jako „Odmítnuto" s možností
 * „Odeslat znovu" – nikdy ji nezahodí.
 */
import type { LocalSale, LocalStatus } from "./types";

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
    out.push([id, { ...applyServerResult({ id, ok: true, status: s.status, confirmationCode: s.confirmationCode, lastError: s.lastError }, now), resolution: undefined }]);
  }
  return out;
}

/** Hodiny zařízení vs. server: posun z hlavičky Date (přesnost ~1 s). */
export function clockOffsetFrom(dateHeader: string | null, sentAt: number, receivedAt: number): number | null {
  if (!dateHeader) return null;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return null;
  // server odpověděl někdy mezi odesláním a přijetím – vezmeme střed
  return server + 500 - (sentAt + receivedAt) / 2;
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
