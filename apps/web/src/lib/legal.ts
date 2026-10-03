/** Verze obchodních podmínek – při změně textu zvýšit; souhlas se ukládá k uživateli (users.terms_version). */
// R7 (рецензія №4): návrh pro právníka; datum zveřejnění nastaví kontrolor v den otevření webu (Z10)
export const TERMS_VERSION = "2026-10-03-r7";
export const TERMS_VERSION_LABEL = "3. 10. 2026";
/** Verze zásad ochrany osobních údajů. */
export const PRIVACY_VERSION = "2026-10-03-r7";
export const PRIVACY_VERSION_LABEL = "3. 10. 2026";
/**
 * Verze textu marketingového souhlasu v předregistraci (prereg-form.tsx). Ukládá se jako doklad souhlasu
 * (preregistrations.consent_evidence = "souhlas:<verze>"); při změně textu zvýšit.
 */
export const MARKETING_CONSENT_VERSION = "2026-09-20";

/** Doby uložení ze zásad – vykonává je cron (lib/server/lifecycle.ts → runRetention). */
export const RETENTION = {
  /** spuštění pokladny – od něj běží 12 měsíců pro předregistrace bez účtu a bez souhlasu */
  launch: "2026-12-01",
  preregistrationMonths: 12,
  /** nepotvrzená předregistrace (bez DOI) – od posledního potvrzovacího odkazu */
  unconfirmedPreregistrationDays: 90,
  consentProofYears: 3,
  objectionYears: 3,
  closedAccountDays: 30,
  /** zrušený účet s neodeslanými ostrými tržbami – nejdéle (Б7, R6.4) */
  closedAccountHoldDays: 60,
  /** pokladny zrušeného účtu se odpojí (i když se účet ještě drží) */
  closedDeviceDays: 30,
  /** souhrnné e-maily po zrušení: den zrušení, 30. a 55. den */
  closedSummaryDays: [0, 30, 55] as readonly number[],
  emailLogDays: 90,
  sessionDays: 90,
  aresCacheHours: 24,
} as const;
