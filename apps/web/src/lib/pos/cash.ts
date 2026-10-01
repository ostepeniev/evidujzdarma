"use client";

/**
 * Hotovost v pokladně: vklady/výběry a denní uzávěrka. Funguje offline – počítá se
 * z tržeb a pohybů uložených v zařízení, na server se uzávěrka pošle při synchronizaci.
 */
import { computeClosing, type ClosingSale, type ClosingTotals } from "@ez/fiscal-core";
import { listClosings, movementsSince, saveClosing, saveMovement, salesSince } from "./db";
import { syncNow } from "./sync";
import type { LocalCashMovement, LocalClosing, LocalSale, PosConfig } from "./types";

export interface CashPeriod {
  /** začátek období (výlučně) – konec poslední uzávěrky, u první uzávěrky půlnoc dneška */
  periodFrom: string;
  /** null = první uzávěrka, počáteční stav zadává obsluha */
  openingCash: number | null;
  nextNumber: number;
  lastClosing: { closedAt: string; number: number } | null;
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Období od poslední uzávěrky (místní nebo ze serveru – podle toho, která je novější). */
export async function currentPeriod(config: PosConfig): Promise<CashPeriod> {
  const [local] = await listClosings(1);
  const server = config.lastClosing ?? null;
  const candidates = [
    local ? { closedAt: local.closedAt, number: local.number, closingCash: local.totals.closingCash } : null,
    server ? { closedAt: server.closedAt, number: server.number, closingCash: server.closingCash } : null,
  ].filter((c): c is NonNullable<typeof c> => !!c);
  const last = candidates.sort((a, b) => b.closedAt.localeCompare(a.closedAt))[0];
  if (!last) return { periodFrom: startOfToday(), openingCash: null, nextNumber: 1, lastClosing: null };
  return {
    periodFrom: last.closedAt,
    openingCash: last.closingCash,
    nextNumber: Math.max(local?.number ?? 0, server?.number ?? 0) + 1,
    lastClosing: { closedAt: last.closedAt, number: last.number },
  };
}

export function toClosingSale(s: LocalSale): ClosingSale {
  return {
    id: s.id,
    sequence: s.sequence,
    soldAt: s.soldAt,
    payments: s.payments,
    tip: s.tip,
    discount: s.discount,
    total: s.total,
    refundOf: s.refundOf,
    fiscal: s.status === "confirmed" ? "confirmed" : s.status === "not_required" ? "not_required" : s.status === "rejected" ? "rejected" : "pending",
  };
}

export interface CashSnapshot {
  period: CashPeriod;
  sales: LocalSale[];
  movements: LocalCashMovement[];
}

export async function cashSnapshot(config: PosConfig): Promise<CashSnapshot> {
  const period = await currentPeriod(config);
  const [sales, movements] = await Promise.all([salesSince(period.periodFrom), movementsSince(period.periodFrom)]);
  return { period, sales, movements };
}

/** Výpočet uzávěrky k danému okamžiku (náhled i finální uložení). */
export function closingTotals(
  snap: CashSnapshot,
  opts: { closedAt: string; openingCash: number; countedCash: number; cashOut: number },
): ClosingTotals {
  return computeClosing({
    periodFrom: snap.period.periodFrom,
    closedAt: opts.closedAt,
    openingCash: opts.openingCash,
    sales: snap.sales.map(toClosingSale),
    movements: snap.movements.map((m) => ({ id: m.id, at: m.at, type: m.type, amount: m.amount, note: m.note, staffName: m.staffName })),
    countedCash: opts.countedCash,
    cashOut: opts.cashOut,
  });
}

export async function recordMovement(input: {
  type: LocalCashMovement["type"];
  amount: number;
  note: string | null;
  staff: { id: string; name: string } | null;
}): Promise<LocalCashMovement> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("Zadejte kladnou částku.");
  const m: LocalCashMovement = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: input.type,
    amount: input.amount,
    note: input.note?.trim() || null,
    staffId: input.staff?.id ?? null,
    staffName: input.staff?.name ?? null,
    syncedAt: null,
  };
  await saveMovement(m);
  void syncNow().catch(() => {});
  return m;
}

export async function recordClosing(
  config: PosConfig,
  snap: CashSnapshot,
  input: {
    openingCash: number;
    countedCash: number;
    cashOut: number;
    denominations: Record<string, number> | null;
    note: string | null;
    staff: { id: string; name: string } | null;
    unitLabel: string | null;
  },
): Promise<LocalClosing> {
  const closedAt = new Date().toISOString();
  const totals = closingTotals(snap, { closedAt, openingCash: input.openingCash, countedCash: input.countedCash, cashOut: input.cashOut });
  const c: LocalClosing = {
    id: crypto.randomUUID(),
    number: snap.period.nextNumber,
    periodFrom: snap.period.periodFrom,
    closedAt,
    totals,
    denominations: input.denominations,
    note: input.note?.trim() || null,
    staffId: input.staff?.id ?? null,
    staffName: input.staff?.name ?? null,
    mode: config.account.mode,
    unitLabel: input.unitLabel,
    syncedAt: null,
  };
  await saveClosing(c);
  void syncNow().catch(() => {});
  return c;
}
