"use client";

import { buildSale, refundLinesFrom, type Payment, type SaleLine } from "@ez/fiscal-core";
import { getMeta, nextSequence, saveSale } from "./db";
import { correctedNow } from "./sync-result";
import type { DeviceCredentials, LocalSale, PosConfig } from "./types";

export interface NewSaleInput {
  lines: SaleLine[];
  payments: Payment[];
  discount: number;
  tip: number;
  cashReceived: number | null;
  refundOf?: string | null;
  /** vlastník, který vratku schválil PINem */
  approvedBy?: string | null;
  unitId: string;
  staff: { id: string; name: string } | null;
}

/**
 * Vytvoří tržbu v zařízení: ověří ji stejnou logikou jako server (buildSale), přidělí
 * pořadové číslo a uloží do IndexedDB. Teprve potom se pokladna pokusí o odeslání.
 */
export async function createLocalSale(device: DeviceCredentials, config: PosConfig, input: NewSaleInput): Promise<LocalSale> {
  const unit = config.units.find((u) => u.id === input.unitId);
  if (!unit) throw new Error("Vyberte evidenční jednotku");
  const id = crypto.randomUUID();
  // čas prodeje opravený o posun hodin zařízení proti serveru (R1.1)
  const now = correctedNow(await getMeta<{ ms: number; at: number }>("clockOffset"));
  const soldAt = new Date(Math.floor(now / 1000) * 1000).toISOString();
  // Validace PŘED přidělením pořadového čísla — neplatná tržba číslo nespotřebuje.
  const probe = buildSale({
    id,
    deviceId: device.deviceId,
    registerId: device.registerId,
    unitId: String(unit.fsUnitId ?? 1),
    sequence: `${device.sequencePrefix}000000`.slice(0, 25),
    soldAt,
    lines: input.lines,
    payments: input.payments,
    discount: input.discount,
    tip: input.tip,
    refundOf: input.refundOf ?? null,
    vatPayer: config.account.vatPayer,
    mode: config.account.mode === "production" ? "production" : "test",
  });
  const sequence = await nextSequence(device.sequencePrefix);
  const sale: LocalSale = {
    id,
    sequence,
    soldAt,
    unitId: unit.id,
    unitLabel: unit.label,
    staffId: input.staff?.id ?? null,
    staffName: input.staff?.name ?? null,
    lines: input.lines,
    payments: input.payments,
    discount: input.discount,
    tip: input.tip,
    refundOf: input.refundOf ?? null,
    approvedBy: input.approvedBy ?? null,
    subtotal: probe.subtotal,
    total: probe.total,
    vat: probe.vat,
    cashReceived: input.cashReceived,
    mode: config.account.mode,
    status: "local",
    confirmationCode: null,
    error: null,
    syncedAt: null,
    createdAt: new Date().toISOString(),
  };
  await saveSale(sale);
  return sale;
}

/** Položky pro vratku: záporné množství původních položek (po slevě). */
export function refundInput(original: LocalSale): { lines: SaleLine[]; payments: Payment[] } {
  const probe = buildSale({
    id: original.id,
    deviceId: "x",
    registerId: "x",
    unitId: "1",
    sequence: "x",
    soldAt: original.soldAt,
    lines: original.lines,
    payments: original.payments,
    discount: original.discount,
    tip: original.tip,
    refundOf: original.refundOf,
    vatPayer: !!original.vat,
    mode: "test",
  });
  const lines = refundLinesFrom(probe);
  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.unitPrice), 0);
  // vracíme stejným způsobem, jakým se platilo (první způsob platby)
  const method = original.payments[0]?.method ?? "cash";
  return { lines, payments: [{ method, amount: total }] };
}
