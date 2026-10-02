/** Verze obchodních podmínek – při změně textu zvýšit; souhlas se ukládá k uživateli (users.terms_version). */
export const TERMS_VERSION = "2026-10-02";
export const TERMS_VERSION_LABEL = "2. 10. 2026";
/** Verze zásad ochrany osobních údajů. */
export const PRIVACY_VERSION = "2026-10-02";
export const PRIVACY_VERSION_LABEL = "2. 10. 2026";

/** Doby uložení ze zásad – vykonává je cron (lib/server/lifecycle.ts → runRetention). */
export const RETENTION = {
  /** spuštění pokladny – od něj běží 12 měsíců pro předregistrace bez účtu a bez souhlasu */
  launch: "2026-12-01",
  preregistrationMonths: 12,
  consentProofYears: 3,
  objectionYears: 3,
  closedAccountDays: 30,
  emailLogDays: 90,
  sessionDays: 90,
  aresCacheHours: 24,
} as const;
