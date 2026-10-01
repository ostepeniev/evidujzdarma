import "server-only";
import { getDb, schema } from "@ez/db";
import { CASH_MOVEMENT_LABEL, PAYMENT_METHODS, decimalString, type ClosingTotals } from "@ez/fiscal-core";
import { and, asc, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { z } from "zod";
import type { DeviceContext } from "./auth";

const MAX_AMOUNT = 100_000_000_00; // 100 mil. Kč v haléřích
const amount = z.number().int().min(0).max(MAX_AMOUNT);
const signedAmount = z.number().int().min(-MAX_AMOUNT).max(MAX_AMOUNT);
const iso = z.string().datetime({ offset: true });

export const DeviceMovementSchema = z.object({
  id: z.string().uuid(),
  at: iso,
  type: z.enum(["deposit", "withdrawal"]),
  amount: amount.refine((v) => v > 0, "Částka musí být kladná"),
  note: z.string().trim().max(200).nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  staffName: z.string().trim().max(80).nullable().optional(),
});

const TotalsSchema = z.object({
  salesCount: z.number().int().min(0),
  refundsCount: z.number().int().min(0),
  gross: signedAmount,
  refundsTotal: signedAmount,
  byMethod: z.object(Object.fromEntries(PAYMENT_METHODS.map((m) => [m, signedAmount])) as Record<(typeof PAYMENT_METHODS)[number], typeof signedAmount>),
  tips: signedAmount,
  discounts: signedAmount,
  evidencedTotal: signedAmount,
  notEvidencedTotal: signedAmount,
  openingCash: amount,
  cashSales: signedAmount,
  deposits: amount,
  withdrawals: amount,
  expectedCash: signedAmount,
  countedCash: amount,
  difference: signedAmount,
  cashOut: amount,
  closingCash: amount,
  pending: z.number().int().min(0),
  rejected: z.number().int().min(0),
  firstSequence: z.string().max(25).nullable(),
  lastSequence: z.string().max(25).nullable(),
});

export const DeviceClosingSchema = z
  .object({
    id: z.string().uuid(),
    number: z.number().int().min(1).max(1_000_000),
    periodFrom: iso.nullable(),
    closedAt: iso,
    totals: TotalsSchema,
    denominations: z.record(z.string().regex(/^\d{1,4}$/), z.number().int().min(0).max(100_000)).nullable().optional(),
    note: z.string().trim().max(300).nullable().optional(),
    staffId: z.string().uuid().nullable().optional(),
    staffName: z.string().trim().max(80).nullable().optional(),
    mode: z.enum(["mock", "playground", "production"]),
  })
  // vnitřní konzistence – chrání export pokladní knihy před nesmyslnými čísly
  .refine((c) => c.totals.expectedCash === c.totals.openingCash + c.totals.cashSales + c.totals.deposits - c.totals.withdrawals, "Nesouhlasí očekávaná hotovost")
  .refine((c) => c.totals.difference === c.totals.countedCash - c.totals.expectedCash, "Nesouhlasí rozdíl")
  .refine((c) => c.totals.closingCash === c.totals.countedCash - c.totals.cashOut, "Nesouhlasí zůstatek");

export type DeviceMovement = z.infer<typeof DeviceMovementSchema>;
export type DeviceClosing = z.infer<typeof DeviceClosingSchema>;

/** Uloží pohyby a uzávěrky ze zařízení. Idempotentní: opakované odeslání stejného ID nic nezmění. */
export async function ingestCash(ctx: DeviceContext, movements: DeviceMovement[], closings: DeviceClosing[]): Promise<{ movements: string[]; closings: string[] }> {
  const db = getDb();
  const base = { accountId: ctx.account.id, deviceId: ctx.device.id, registerId: ctx.device.registerId };
  if (movements.length) {
    await db
      .insert(schema.cashMovements)
      .values(
        movements.map((m) => ({
          ...base,
          id: m.id,
          at: new Date(m.at),
          type: m.type,
          amount: m.amount,
          note: m.note ?? null,
          staffId: m.staffId ?? null,
          staffName: m.staffName ?? null,
        })),
      )
      .onConflictDoNothing();
  }
  if (closings.length) {
    await db
      .insert(schema.closings)
      .values(
        closings.map((c) => ({
          ...base,
          id: c.id,
          number: c.number,
          periodFrom: c.periodFrom ? new Date(c.periodFrom) : null,
          closedAt: new Date(c.closedAt),
          openingCash: c.totals.openingCash,
          expectedCash: c.totals.expectedCash,
          countedCash: c.totals.countedCash,
          difference: c.totals.difference,
          cashOut: c.totals.cashOut,
          closingCash: c.totals.closingCash,
          totals: c.totals,
          denominations: c.denominations ?? null,
          note: c.note ?? null,
          staffId: c.staffId ?? null,
          staffName: c.staffName ?? null,
          mode: c.mode,
        })),
      )
      .onConflictDoNothing();
  }
  // Potvrdit jen záznamy, které opravdu patří tomuto účtu (cizí kolizní ID se neuloží ani nepotvrdí)
  const [okMovements, okClosings] = await Promise.all([
    movements.length
      ? db
          .select({ id: schema.cashMovements.id })
          .from(schema.cashMovements)
          .where(and(eq(schema.cashMovements.accountId, ctx.account.id), inArray(schema.cashMovements.id, movements.map((m) => m.id))))
      : [],
    closings.length
      ? db
          .select({ id: schema.closings.id })
          .from(schema.closings)
          .where(and(eq(schema.closings.accountId, ctx.account.id), inArray(schema.closings.id, closings.map((c) => c.id))))
      : [],
  ]);
  return { movements: okMovements.map((r) => r.id), closings: okClosings.map((r) => r.id) };
}

/** Poslední uzávěrka zařízení – obnoví stav pokladny i po smazání dat v prohlížeči. */
export async function lastClosingFor(deviceId: string) {
  const [row] = await getDb()
    .select({ id: schema.closings.id, number: schema.closings.number, closedAt: schema.closings.closedAt, closingCash: schema.closings.closingCash })
    .from(schema.closings)
    .where(eq(schema.closings.deviceId, deviceId))
    .orderBy(desc(schema.closings.closedAt))
    .limit(1);
  return row ? { ...row, closedAt: row.closedAt.toISOString() } : null;
}

export async function closingsForAccount(accountId: string, from: Date, to: Date) {
  const db = getDb();
  const closings = await db
    .select()
    .from(schema.closings)
    .where(and(eq(schema.closings.accountId, accountId), gte(schema.closings.closedAt, from), lt(schema.closings.closedAt, to)))
    .orderBy(asc(schema.closings.registerId), asc(schema.closings.closedAt));
  if (!closings.length) return { closings, movements: [] };
  // pohyby patří do období uzávěrek (i když začalo před `from`)
  const lower = new Date(Math.min(...closings.map((c) => (c.periodFrom ?? c.closedAt).getTime())));
  const upper = new Date(Math.max(...closings.map((c) => c.closedAt.getTime())));
  const movements = await db
    .select()
    .from(schema.cashMovements)
    .where(and(eq(schema.cashMovements.accountId, accountId), gte(schema.cashMovements.at, lower), lte(schema.cashMovements.at, upper)))
    .orderBy(asc(schema.cashMovements.at));
  return { closings, movements };
}

type ClosingRow = typeof schema.closings.$inferSelect;
type MovementRow = typeof schema.cashMovements.$inferSelect;

export interface CashBookRow {
  at: Date;
  registerId: string;
  doc: string;
  text: string;
  income: number;
  expense: number;
  balance: number;
  staff: string;
  note: string;
}

/**
 * Pokladní kniha z uzávěrek: počáteční stav, vklady/výběry, tržby hotově (souhrnně za uzávěrku),
 * manko/přebytek a odvod. Zůstatek po každé uzávěrce = spočítaná hotovost − odvod.
 */
export function buildCashBook(closings: readonly ClosingRow[], movements: readonly MovementRow[]): CashBookRow[] {
  const out: CashBookRow[] = [];
  const byRegister = new Map<string, ClosingRow[]>();
  for (const c of closings) byRegister.set(c.registerId, [...(byRegister.get(c.registerId) ?? []), c]);
  for (const [registerId, list] of byRegister) {
    let balance: number | null = null;
    let prevClosedAt: Date | null = null;
    for (const c of list) {
      const t = c.totals as ClosingTotals;
      const doc = `Z-${c.number}`;
      const row = (at: Date, text: string, delta: number, extra: Partial<CashBookRow> = {}) => {
        balance = (balance ?? 0) + delta;
        out.push({ at, registerId, doc, text, income: delta > 0 ? delta : 0, expense: delta < 0 ? -delta : 0, balance, staff: c.staffName ?? "", note: "", ...extra });
      };
      const start = c.periodFrom ?? new Date(c.closedAt.getTime() - 86_400_000);
      if (balance === null) {
        balance = c.openingCash;
        out.push({ at: start, registerId, doc, text: "Počáteční stav pokladny", income: 0, expense: 0, balance, staff: c.staffName ?? "", note: "" });
      } else if (balance !== c.openingCash) {
        row(start, "Úprava počátečního stavu (liší se od zůstatku předchozí uzávěrky)", c.openingCash - balance);
      }
      for (const m of movements) {
        if (m.registerId !== registerId || m.at > c.closedAt) continue;
        if (c.periodFrom ? m.at <= c.periodFrom : prevClosedAt ? m.at <= prevClosedAt : false) continue;
        row(m.at, CASH_MOVEMENT_LABEL[m.type as "deposit" | "withdrawal"] ?? m.type, m.type === "withdrawal" ? -m.amount : m.amount, {
          staff: m.staffName ?? "",
          note: m.note ?? "",
        });
      }
      const seq = t.firstSequence ? ` (doklady ${t.firstSequence === t.lastSequence ? t.firstSequence : `${t.firstSequence}–${t.lastSequence}`})` : "";
      if (t.cashSales !== 0) row(c.closedAt, `Tržby v hotovosti${seq}`, t.cashSales);
      if (c.difference !== 0) row(c.closedAt, c.difference < 0 ? "Manko při uzávěrce" : "Přebytek při uzávěrce", c.difference, { note: c.note ?? "" });
      if (c.cashOut > 0) row(c.closedAt, "Odvod hotovosti při uzávěrce", -c.cashOut);
      // vklady/výběry, které na server (zatím) nedorazily – kniha musí končit zůstatkem uzávěrky
      if (balance !== c.closingCash) row(c.closedAt, "Vklady/výběry podle uzávěrky (bez dokladu na serveru)", c.closingCash - (balance ?? 0));
      prevClosedAt = c.closedAt;
    }
  }
  return out.sort((a, b) => a.registerId.localeCompare(b.registerId) || a.at.getTime() - b.at.getTime());
}

/** Český Excel: středník, desetinná čárka, UTF-8 s BOM. */
export function cashBookCsv(rows: readonly CashBookRow[]): string {
  const num = (h: number) => (h ? decimalString(h).replace(".", ",") : "");
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmt = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Prague" });
  const head = ["Datum a čas", "Pokladna", "Doklad", "Popis", "Příjem", "Výdaj", "Zůstatek", "Pokladní", "Poznámka"];
  const lines = rows.map((r) =>
    [fmt.format(r.at), r.registerId, r.doc, r.text, num(r.income), num(r.expense), decimalString(r.balance).replace(".", ","), r.staff, r.note].map(cell).join(";"),
  );
  return "﻿" + [head.join(";"), ...lines].join("\r\n");
}
