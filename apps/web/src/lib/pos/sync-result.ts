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
