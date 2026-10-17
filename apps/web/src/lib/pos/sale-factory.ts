"use client";

import { buildSale, refundLinesFrom, type Payment, type SaleLine } from "@ez/fiscal-core";
import { getMeta, nextSequence, saveSale } from "./db";
import { isConfigStale } from "./sync";
import { mirrorPayments } from "./split-payment";
import { correctedNow } from "./sync-result";
import { modeIn } from "@/lib/modes";
import { linesTotal, refundLinesFor, refundPayments, refundableLines, type RefundLookupDto } from "./refund";
import type { DeviceCredentials, LocalSale, PosConfig, PosMode } from "./types";

export interface NewSaleInput {
  lines: SaleLine[];
  payments: Payment[];
  discount: number;
  tip: number;
  cashReceived: number | null;
  refundOf?: string | null;
  /** schválení vratky vlastníkem (podepsané serverem) */
  approval?: string | null;
  unitId: string;
  staff: { id: string; name: string } | null;
}

/**
 * Vytvoří tržbu v zařízení: ověří ji stejnou logikou jako server (buildSale), přidělí
 * pořadové číslo a uloží do IndexedDB. Teprve potom se pokladna pokusí o odeslání.
 */
export async function createLocalSale(device: DeviceCredentials, config: PosConfig, input: NewSaleInput): Promise<LocalSale> {
  // účet mezitím přepnul režim evidence – prodej v původním režimu by se tiše neevidoval (R5.1)
  if (config.account.closed) throw new Error("Účet je zrušený – pokladna už neprodává. Uložené tržby se odešlou samy.");
  if (isConfigStale()) throw new Error("Účet změnil režim evidence. Pokladna načítá nové nastavení – zkuste to za chvíli (je potřeba připojení k internetu).");
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
    approval: input.approval ?? null,
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

/**
 * Vratka jen v režimu původní tržby (R7.13, Р3): k tržbě z jiného režimu ji pokladna nenabízí a řekne proč.
 * Server takovou vratku stejně nepřijme (karanténa REFUND_MODE_MISMATCH).
 */
export function refundBlockedReason(original: { mode: PosMode }, accountMode: PosMode): string | null {
  if (original.mode === accountMode) return null;
  return `Původní prodej proběhl ${modeIn(original.mode)}. Vratku k němu pokladna neodešle.`;
}

/** Položky pro vratku: záporné množství původních položek (po slevě); platby zrcadlí originál (R6.9). */
export function refundInput(original: LocalSale): { lines: SaleLine[]; payments: Payment[]; total: number } {
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
  // vracíme stejnými způsoby, jakými se platilo, poměrně – jinak by se evidovala jiná částka než u originálu (R6.9)
  return { lines, payments: mirrorPayments(original.payments, original.tip, total), total };
}

/**
 * S3-POKLADNA: doklad, ke kterému se dělá (částečná) vratka – z tohoto zařízení i z jiné pokladny účtu (dohledaný na
 * serveru). `lines` jsou položky PO slevě, `refunds` všechny známé dřívější vratky (server + zařízení, bez duplicit).
 */
export interface RefundSource {
  id: string;
  sequence: string;
  soldAt: string;
  unitId: string | null;
  unitLabel: string | null;
  mode: PosMode;
  status: string;
  refundOf: string | null;
  lines: SaleLine[];
  payments: Payment[];
  tip: number;
  /** součet položek po slevě (bez spropitného) – víc vratky dohromady vrátit nemohou */
  subtotal: number;
  total: number;
  refunds: { id: string; lines: SaleLine[]; payments: Payment[]; total: number }[];
  /** doklad je jen na serveru (z jiného zařízení, nebo už smazaný ze zařízení) */
  remote: boolean;
}

function mergeRefunds(server: RefundSource["refunds"], local: readonly LocalSale[]): RefundSource["refunds"] {
  const out = [...server];
  for (const r of local) if (!out.some((x) => x.id === r.id)) out.push({ id: r.id, lines: r.lines, payments: r.payments, total: r.total });
  return out;
}

/** Doklad z tohoto zařízení (bez spojení se serverem jen s vratkami, které zná zařízení). */
export function refundSourceFromLocal(original: LocalSale, localRefunds: readonly LocalSale[], serverRefunds: RefundSource["refunds"] = []): RefundSource {
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
  return {
    id: original.id,
    sequence: original.sequence,
    soldAt: original.soldAt,
    unitId: original.unitId,
    unitLabel: original.unitLabel,
    mode: original.mode,
    status: original.status,
    refundOf: original.refundOf,
    lines: probe.lines,
    payments: original.payments,
    tip: original.tip,
    subtotal: probe.subtotal,
    total: probe.total,
    refunds: mergeRefunds(serverRefunds, localRefunds),
    remote: false,
  };
}

/** Doklad dohledaný na serveru (/api/pokladna/vratka) – položky už jsou po slevě. */
export function refundSourceFromServer(dto: RefundLookupDto, localRefunds: readonly LocalSale[], remote = true): RefundSource {
  const s = dto.sale;
  return {
    id: s.id,
    sequence: s.sequence,
    soldAt: s.soldAt,
    unitId: s.unitId,
    unitLabel: s.unitLabel,
    mode: s.mode,
    status: s.status,
    refundOf: s.refundOf,
    lines: s.lines,
    payments: s.payments,
    tip: s.tip,
    subtotal: s.total - s.tip,
    total: s.total,
    refunds: mergeRefunds(
      dto.refunds.map((r) => ({ id: r.id, lines: r.lines, payments: r.payments, total: r.total })),
      localRefunds,
    ),
    remote,
  };
}

/** Kolik z dokladu ještě jde vrátit (haléře, kladně). */
export function refundRemaining(source: RefundSource): number {
  return Math.max(0, source.subtotal + source.refunds.reduce((s, r) => s + r.total, 0));
}

/** Proč k dokladu vratku udělat nejde (nebo null). Režim kontroluje refundBlockedReason. */
export function refundUnavailableReason(source: RefundSource, config: Pick<PosConfig, "units">, currentUnitId: string): string | null {
  if (source.refundOf) return "Toto je vratka – k vratce další vratku udělat nejde.";
  if (source.total <= 0) return "Doklad nemá kladnou částku – vratka k němu nejde.";
  if (source.status === "rejected") return "Tržbu Finanční správa odmítla – vratka k ní není. Vyřiďte ji v nastavení pokladny.";
  if (refundRemaining(source) <= 0) return "Doklad už byl celý vrácen.";
  const unit = config.units.find((u) => u.id === source.unitId && u.active);
  if (!unit) return "Evidenční jednotka původního prodeje už není aktivní – vratku vyřiďte s účetní.";
  // vratka patří do provozovny, kde se prodávalo (záporná tržba se eviduje v její evidenční jednotce)
  if (unit.id !== currentUnitId) return `Doklad je z evidenční jednotky ${unit.label}. Přepněte ji v záhlaví pokladny, nebo vratku udělejte na pokladně v této jednotce.`;
  return null;
}

/** Návrh vratky z výběru množství: záporné položky, platby zrcadlící zbytek originálu a částka. */
export function refundDraft(source: RefundSource, selection: Readonly<Record<number, number>>): { lines: SaleLine[]; payments: Payment[]; total: number } {
  const rows = refundableLines(source.lines, source.refunds);
  const lines = refundLinesFor(rows, selection);
  const total = linesTotal(lines);
  return { lines, payments: refundPayments(source, source.refunds, total), total };
}
