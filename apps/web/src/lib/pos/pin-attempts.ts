/**
 * Rostoucí prodleva po chybných PINech pokladních ověřovaných v zařízení (R3.10).
 * Dva pokusy zdarma, pak 30 s, 1 min, 2 min… nejvýš 1 h.
 */
export const PIN_FREE_ATTEMPTS = 2;

export function pinLockUntil(failures: number, now = Date.now()): number {
  if (failures <= PIN_FREE_ATTEMPTS) return 0;
  return now + Math.min(60 * 60_000, 30_000 * 2 ** (failures - PIN_FREE_ATTEMPTS - 1));
}
