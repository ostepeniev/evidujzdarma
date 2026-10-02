"use client";

import { setMeta } from "./db";

export type PersistState = "granted" | "denied" | "unsupported";

/**
 * Požádá prohlížeč o trvalé úložiště (R1.12). Bez něj smí prohlížeč při nedostatku místa
 * IndexedDB smazat – a s ní tržby, které ještě nedošly na server.
 */
export async function requestPersistentStorage(): Promise<PersistState> {
  let state: PersistState = "unsupported";
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      state = (await navigator.storage.persisted()) || (await navigator.storage.persist()) ? "granted" : "denied";
    }
  } catch {
    state = "denied";
  }
  await setMeta("storagePersist", { state, at: Date.now() }).catch(() => {});
  return state;
}
