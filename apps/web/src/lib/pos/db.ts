"use client";

/**
 * Offline úložiště pokladny (IndexedDB). Tržby se ukládají DŘÍV, než se pokusí odeslat —
 * výpadek sítě ani zavření aplikace o ně nepřipraví.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DeviceCredentials, LocalCashMovement, LocalClosing, LocalSale, PosConfig } from "./types";

interface PosDB extends DBSchema {
  meta: { key: string; value: unknown };
  sales: { key: string; value: LocalSale; indexes: { bySoldAt: string; byStatus: string } };
  movements: { key: string; value: LocalCashMovement; indexes: { byAt: string } };
  closings: { key: string; value: LocalClosing; indexes: { byClosedAt: string } };
}

let dbPromise: Promise<IDBPDatabase<PosDB>> | null = null;

export function posDb(): Promise<IDBPDatabase<PosDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PosDB>("evidujzdarma-pokladna", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("meta");
          const sales = db.createObjectStore("sales", { keyPath: "id" });
          sales.createIndex("bySoldAt", "soldAt");
          sales.createIndex("byStatus", "status");
        }
        if (oldVersion < 2) {
          db.createObjectStore("movements", { keyPath: "id" }).createIndex("byAt", "at");
          db.createObjectStore("closings", { keyPath: "id" }).createIndex("byClosedAt", "closedAt");
        }
      },
      // jiná karta otevírá novější verzi → uvolnit spojení, ať upgrade neblokujeme
      blocking() {
        void dbPromise?.then((d) => d.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await posDb()).get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await posDb()).put("meta", value, key);
}

export async function deleteMeta(key: string): Promise<void> {
  await (await posDb()).delete("meta", key);
}

export const getDevice = () => getMeta<DeviceCredentials>("device");
export const getConfig = () => getMeta<PosConfig>("config");

/**
 * Atomicky přidělí další pořadové číslo tohoto zařízení. Čítač žije jen v zařízení,
 * jedinečnost napříč zařízeními zaručuje prefix přidělený při registraci.
 */
export async function nextSequence(prefix: string): Promise<string> {
  const db = await posDb();
  const tx = db.transaction("meta", "readwrite");
  const current = ((await tx.store.get("counter")) as number | undefined) ?? 0;
  const next = current + 1;
  await tx.store.put(next, "counter");
  await tx.done;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export async function saveSale(sale: LocalSale): Promise<void> {
  await (await posDb()).put("sales", sale);
}

export async function getSale(id: string): Promise<LocalSale | undefined> {
  return (await posDb()).get("sales", id);
}

export async function updateSale(id: string, patch: Partial<LocalSale>): Promise<LocalSale | undefined> {
  const db = await posDb();
  const tx = db.transaction("sales", "readwrite");
  const cur = await tx.store.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function salesSince(iso: string): Promise<LocalSale[]> {
  const db = await posDb();
  const all = await db.getAllFromIndex("sales", "bySoldAt", IDBKeyRange.lowerBound(iso));
  return all.reverse();
}

/** Tržby, které ještě nemají konečný stav (POK, zamítnutí nebo "neeviduje se"). */
export async function unsettledSales(): Promise<LocalSale[]> {
  const db = await posDb();
  const out: LocalSale[] = [];
  for (const status of ["local", "queued", "sending", "failed"] as const) {
    out.push(...(await db.getAllFromIndex("sales", "byStatus", status)));
  }
  return out.sort((a, b) => a.soldAt.localeCompare(b.soldAt));
}

/** Vratka k dané tržbě, pokud už v zařízení je (na jednu tržbu nejvýš jedna – R1.7). */
export async function refundFor(saleId: string): Promise<LocalSale | undefined> {
  return (await (await posDb()).getAll("sales")).find((s) => s.refundOf === saleId);
}

/** Tržby, které server nebo FS odmítly – pokladna není „čistá“, dokud je někdo nevyřeší (Р2). */
export async function rejectedSales(): Promise<LocalSale[]> {
  return (await posDb()).getAllFromIndex("sales", "byStatus", "rejected");
}

/** Smaže z IndexedDB potvrzené tržby starší než `days` (data zůstávají na serveru). */
export async function pruneOld(days = 90): Promise<void> {
  const db = await posDb();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const old = await db.getAllFromIndex("sales", "bySoldAt", IDBKeyRange.upperBound(cutoff));
  const tx = db.transaction("sales", "readwrite");
  for (const s of old) if (s.status === "confirmed" || s.status === "not_required") await tx.store.delete(s.id);
  await tx.done;
}

/* ───────────── hotovost: vklady/výběry a uzávěrky ───────────── */

export async function saveMovement(m: LocalCashMovement): Promise<void> {
  await (await posDb()).put("movements", m);
}

export async function movementsSince(iso: string | null): Promise<LocalCashMovement[]> {
  const db = await posDb();
  return iso ? db.getAllFromIndex("movements", "byAt", IDBKeyRange.lowerBound(iso, true)) : db.getAllFromIndex("movements", "byAt");
}

export async function saveClosing(c: LocalClosing): Promise<void> {
  await (await posDb()).put("closings", c);
}

export async function getClosing(id: string): Promise<LocalClosing | undefined> {
  return (await posDb()).get("closings", id);
}

/** Uzávěrky od nejnovější. */
export async function listClosings(limit = 20): Promise<LocalClosing[]> {
  const all = await (await posDb()).getAllFromIndex("closings", "byClosedAt");
  return all.reverse().slice(0, limit);
}

export async function unsyncedCash(): Promise<{ movements: LocalCashMovement[]; closings: LocalClosing[] }> {
  const db = await posDb();
  const [movements, closings] = await Promise.all([db.getAll("movements"), db.getAll("closings")]);
  return { movements: movements.filter((m) => !m.syncedAt), closings: closings.filter((c) => !c.syncedAt) };
}

export async function markCashSynced(movementIds: string[], closingIds: string[]): Promise<void> {
  const db = await posDb();
  const tx = db.transaction(["movements", "closings"], "readwrite");
  const at = new Date().toISOString();
  for (const id of movementIds) {
    const m = await tx.objectStore("movements").get(id);
    if (m) await tx.objectStore("movements").put({ ...m, syncedAt: at });
  }
  for (const id of closingIds) {
    const c = await tx.objectStore("closings").get(id);
    if (c) await tx.objectStore("closings").put({ ...c, syncedAt: at });
  }
  await tx.done;
}
