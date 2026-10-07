import "server-only";
import { isNotNull, or } from "drizzle-orm";
import { schema } from "@ez/db";

/**
 * Doklad o odvolaném souhlasu (R8.2): po konci lhůty předregistrace ji retention zmenší na doklad – bez data potvrzovacího
 * odkazu a bez odhlášení, ale s confirmed_at a dokladem souhlasu. Pro formulář, odkazy i e-maily to už předregistrace
 * není: adresa se chová jako neznámá (R9.3). Živá předregistrace má confirm_token_issued_at vždy, záznam-blokace
 * („Zrušit předregistraci“) má unsubscribed_at.
 */
export function isConsentProof(row: { confirmTokenIssuedAt: Date | null; unsubscribedAt: Date | null }): boolean {
  return row.confirmTokenIssuedAt === null && row.unsubscribedAt === null;
}

/** SQL: předregistrace nebo záznam-blokace, ne doklad – stejná podmínka jako částečný unikátní index na e-mail (schema). */
export const NOT_CONSENT_PROOF = or(isNotNull(schema.preregistrations.confirmTokenIssuedAt), isNotNull(schema.preregistrations.unsubscribedAt))!;
