"use client";

/**
 * Offline úložiště pokladny (IndexedDB). Tržby se ukládají DŘÍV, než se pokusí odeslat —
 * výpadek sítě ani zavření aplikace o ně nepřipraví.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DeviceCredentials, LocalSale, PosConfig } from "./types";

interface PosDB extends DBSchema {
  meta: { key: string; value: unknown };
  sales: { key: string; value: LocalSale; indexes: { bySoldAt: string; byStatus: string } };
}

let dbPromise: Promise<IDBPDatabase<PosDB>> | null = null;

export function posDb(): Promise<IDBPDatabase<PosDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PosDB>("evidujzdarma-pokladna", 1, {
      upgrade(db) {
        db.createObjectStore("meta");
        const sales = db.createObjectStore("sales", { keyPath: "id" });
        sales.createIndex("bySoldAt", "soldAt");
        sales.createIndex("byStatus", "status");
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

/** Smaže z IndexedDB potvrzené tržby starší než `days` (data zůstávají na serveru). */
export async function pruneOld(days = 90): Promise<void> {
  const db = await posDb();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const old = await db.getAllFromIndex("sales", "bySoldAt", IDBKeyRange.upperBound(cutoff));
  const tx = db.transaction("sales", "readwrite");
  for (const s of old) if (s.status === "confirmed" || s.status === "not_required") await tx.store.delete(s.id);
  await tx.done;
}
