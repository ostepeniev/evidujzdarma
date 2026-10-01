/**
 * Sdílené typy a konstanty hromadné kontroly IČO (klient + POST /api/ico/hromadne).
 * Route soubory smí exportovat jen pole Next.js, proto je to tady.
 */
import type { EetOff, Verdict } from "@/lib/eet-assessment";

/** Max. počet IČO v jednom požadavku na API. */
export const BULK_MAX_BATCH = 50;
/** Max. počet IČO v jednom spuštění kontroly v prohlížeči. */
export const BULK_MAX_TOTAL = 500;
/** Limit požadavků na API za minutu z jedné IP adresy. */
export const BULK_REQ_PER_MIN = 10;

export type BulkErrorCode = "not_found" | "ares_unavailable" | "busy";

export interface BulkRow {
  ico: string;
  name: string | null;
  /** zkratka právní formy (OSVČ, s.r.o., …) */
  legalForm: string | null;
  city: string | null;
  verdict: Verdict | null;
  eetOff: EetOff | null;
  /** počet aktivních provozoven v RŽP */
  establishments: number | null;
  error: BulkErrorCode | null;
}

export interface BulkResponse {
  rows: BulkRow[];
  /** položky, které nejsou platné IČO */
  invalid: string[];
  /** pokud některé řádky mají `busy`, za kolik sekund je zkusit znovu */
  retryAfter?: number;
  checkedAt: string;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  likely: "Pravděpodobně ano",
  possible: "Možná",
  unlikely: "Pravděpodobně ne",
  dissolved: "Zaniklý subjekt",
};

export const EET_OFF_LABEL: Record<EetOff, string> = {
  possible: "Možný",
  not_available: "Nelze",
  check: "Ověřit",
};

export const EET_OFF_HINT: Record<EetOff, string> = {
  possible: "Splňuje podmínky EET OFF",
  not_available: "EET OFF je jen pro fyzické osoby v 1. pásmu paušálního režimu",
  check: "Fyzická osoba – EET OFF je možný, pokud je v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč",
};

export const ERROR_LABEL: Record<BulkErrorCode, string> = {
  not_found: "IČO v ARES nenalezeno",
  ares_unavailable: "Registr ARES neodpověděl",
  busy: "Čeká na opakování",
};
