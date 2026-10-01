/**
 * Politika fronty pro offline režim. Stejná logika běží v prohlížeči (IndexedDB)
 * i na serveru (tabulka sales) — proto je isomorfní a bez závislostí.
 *
 * Pravidla:
 *  - tržbu opakujeme se STEJNOU identitou (EIČ, jednotka, pokladna, pořadové číslo,
 *    datum a částka), ale s NOVÝM uuid_zpravy a prvni_zaslani=false, dokud nedostaneme POK;
 *  - po přijetí POK už nikdy znovu neodesíláme (idempotence je na straně pokladny);
 *  - lhůta pro dodatečné odeslání (48 h) se počítá od okamžiku přijetí platby.
 *    Zdroj: eet.gov.cz – Praktické informace.
 */

export const OFFLINE_WINDOW_HOURS = 48;

export type QueueState = "queued" | "sending" | "confirmed" | "failed" | "rejected" | "test";

export function deadlineFor(soldAt: string | Date, hours = OFFLINE_WINDOW_HOURS): Date {
  const t = typeof soldAt === "string" ? Date.parse(soldAt) : soldAt.getTime();
  return new Date(t + hours * 3_600_000);
}

const BACKOFF_S = [0, 5, 15, 30, 60, 120, 300, 600, 900];

/** Prodleva před dalším pokusem (sekundy). Strop 15 minut — lhůta 48 h je dost dlouhá. */
export function retryDelaySeconds(attempts: number): number {
  return BACKOFF_S[Math.min(attempts, BACKOFF_S.length - 1)]!;
}

export type Urgency = "ok" | "soon" | "critical" | "overdue";

export function urgency(deadline: Date, now = new Date()): Urgency {
  const left = deadline.getTime() - now.getTime();
  if (left <= 0) return "overdue";
  if (left <= 2 * 3_600_000) return "critical";
  if (left <= 12 * 3_600_000) return "soon";
  return "ok";
}

export function formatRemaining(deadline: Date, now = new Date()): string {
  const left = Math.max(0, deadline.getTime() - now.getTime());
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Je chyba dočasná (síť, 5xx, timeout) → opakovat; trvalá (validace, 4xx) → zastavit a upozornit. */
export function isRetryable(err: { status?: number; code?: string } | undefined): boolean {
  if (!err) return true;
  if (err.code && ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "TIMEOUT", "NETWORK"].includes(err.code))
    return true;
  if (err.status === undefined) return true;
  return err.status >= 500 || err.status === 408 || err.status === 429;
}
