import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { EET_PRODUCTION_ACCEPTS_FROM, MAX_EET_AMOUNT, PAYMENT_METHODS, SaleValidationError, buildSale, deadlineFor, evidencedAmounts } from "@ez/fiscal-core";
import type { DeviceContext } from "./auth";
import { accountMode, type EetMode } from "./fiscal";
import { ingestedFromQuarantine, markIngested, quarantineSale } from "./quarantine";
import { verifyApproval } from "./staff-pin";

/** Tržba tak, jak ji posílá pokladna (částky v haléřích). */
export const DeviceSaleSchema = z.object({
  id: z.string().uuid(),
  sequence: z.string().min(1).max(25),
  soldAt: z.string().datetime({ offset: true }),
  unitId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  lines: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        qty: z.number().finite().refine((v) => v !== 0 && Math.abs(v) <= 10_000),
        unitPrice: z.number().int().min(-100_000_000_00).max(100_000_000_00),
        vatRate: z.number().int().min(0).max(30),
        kind: z.enum(["goods", "prepayment"]).optional(),
      }),
    )
    .min(1)
    .max(300),
  payments: z
    .array(z.object({ method: z.enum(PAYMENT_METHODS), amount: z.number().int() }))
    .min(1)
    .max(5),
  discount: z.number().int().min(0).optional(),
  tip: z.number().int().min(0).optional(),
  refundOf: z.string().uuid().nullable().optional(),
  /** schválení vratky vlastníkem, které vydal server po ověření jeho PINu (R3.10) */
  approval: z.string().max(1000).nullable().optional(),
  /** režim v okamžiku prodeje – tržba se odesílá jen v něm (Р3), nikdy podle aktuálního režimu účtu */
  mode: z.enum(["mock", "playground", "production"]),
});
export type DeviceSale = z.infer<typeof DeviceSaleSchema>;

export type IngestResult =
  | { id: string; ok: true; /** true = tržba přišla poprvé (ne opakovaná synchronizace) */ inserted: boolean }
  | {
      id: string;
      ok: false;
      /** true = dočasná chyba serveru, pokladna tržbu pošle znovu sama */
      retryable: boolean;
      /** true = server tržbu uložil do karantény a čeká na vlastníka */
      quarantined: boolean;
      code: string;
      error: string;
      httpStatus?: number;
    };

/** Trvalé odmítnutí kvůli datům tržby → karanténa (nikdy zahození). */
export class IngestRejection extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 422,
  ) {
    super(message);
  }
}

const MAX_FUTURE_MS = 10 * 60_000;
const MAX_PAST_MS = 45 * 86_400_000;

/** Stabilní JSON (seřazené klíče) – jsonb v Postgresu pořadí klíčů nezachovává. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

/**
 * Pokladní a vratka musí patřit k účtu; vratku dělá vlastník nebo ji vlastník schválí PINem.
 * Vratka nesmí přesáhnout původní tržbu a na jednu tržbu je nejvýš jedna (R1.7).
 */
async function checkStaffAndRefund(accountId: string, deviceId: string, input: DeviceSale, total: number): Promise<{ approvedBy: string; approvalJti: string } | null> {
  const db = getDb();
  const staffRow = (id: string) => db.query.staff.findFirst({ where: and(eq(schema.staff.id, id), eq(schema.staff.accountId, accountId)) });
  const cashier = input.staffId ? await staffRow(input.staffId) : undefined;
  if (input.staffId && !cashier) throw new IngestRejection("UNKNOWN_STAFF", "Pokladní nepatří k tomuto účtu");
  if (input.approval && !input.refundOf) throw new IngestRejection("INVALID_SALE", "Schválení vlastníkem patří jen k vratce");
  if (!input.refundOf) return null;

  // Zařízení samo nemůže tvrdit, že prodává vlastník: vratka potřebuje schválení podepsané serverem (R3.10),
  // vázané na tuto tržbu a částku a použitelné jednou (R5.5)
  const approval = verifyApproval(input.approval, { accountId, deviceId, soldAt: input.soldAt, refundOf: input.refundOf, amount: -total });
  const approver = approval ? await staffRow(approval.approverId) : undefined;
  if (approver?.role !== "owner" || !approver.active) throw new IngestRejection("REFUND_NOT_AUTHORIZED", "Vratku musí schválit vlastník (PIN ověřený online) – pro tuto tržbu a částku", 403);
  const usedBy = await db.query.sales.findFirst({ where: and(eq(schema.sales.approvalJti, approval!.jti), ne(schema.sales.id, input.id)), columns: { id: true } });
  if (usedBy) throw new IngestRejection("REFUND_NOT_AUTHORIZED", "Toto schválení vratky už bylo použito – vlastník musí schválit znovu", 403);
  if (total >= 0) throw new IngestRejection("INVALID_SALE", "Vratka musí mít zápornou částku");
  const original = await db.query.sales.findFirst({ where: and(eq(schema.sales.id, input.refundOf), eq(schema.sales.accountId, accountId)) });
  if (!original) throw new IngestRejection("REFUND_UNKNOWN_ORIGINAL", "Původní tržba k vratce není na serveru");
  if (original.refundOf) throw new IngestRejection("INVALID_SALE", "Vratku nelze vrátit");
  if (-total > original.total) throw new IngestRejection("REFUND_EXCEEDS", "Vratka je vyšší než původní tržba");
  const other = await db.query.sales.findFirst({ where: and(eq(schema.sales.refundOf, input.refundOf), ne(schema.sales.id, input.id)), columns: { id: true } });
  if (other) throw new IngestRejection("REFUND_DUPLICATE", "Tato tržba už byla vrácena", 409);
  return { approvedBy: approver.id, approvalJti: approval!.jti };
}

const MODE_LABEL: Record<EetMode, string> = { mock: "ukázkový", playground: "Playground", production: "ostrý provoz" };

/** Od kdy produkce FS přijímá tržby (produkce v1.1, 4.1; R5.9). Přepis přes env jen pro testy. */
function productionAcceptsFrom(): number {
  return Date.parse(process.env.EET_PRODUCTION_ACCEPTS_FROM || EET_PRODUCTION_ACCEPTS_FROM);
}

/**
 * Uloží tržby z pokladny. Idempotentní: stejné `id` se stejným obsahem se uloží jen jednou.
 * Trvalé problémy (datum, jednotka, konflikt) jdou do karantény; dočasné chyby serveru vrací
 * `retryable: true`, aby je pokladna poslala znovu. Žádná tržba se tiše neztratí (Р2).
 */
export async function ingestSales(ctx: DeviceContext, inputs: DeviceSale[]): Promise<IngestResult[]> {
  const db = getDb();
  const { device, account } = ctx;
  const unitIds = [...new Set(inputs.map((i) => i.unitId))];
  const units = unitIds.length
    ? await db
        .select()
        .from(schema.evidenceUnits)
        .where(and(eq(schema.evidenceUnits.accountId, account.id), inArray(schema.evidenceUnits.id, unitIds)))
    : [];
  const unitById = new Map(units.map((u) => [u.id, u]));
  const results: IngestResult[] = [];

  for (const input of inputs) {
    const mode = input.mode;
    try {
      const soldAtMs = Date.parse(input.soldAt);
      if (soldAtMs - Date.now() > MAX_FUTURE_MS) throw new IngestRejection("FUTURE_DATE", "Datum tržby je v budoucnosti – zkontrolujte čas v zařízení.");
      if (Date.now() - soldAtMs > MAX_PAST_MS) throw new IngestRejection("TOO_OLD", "Tržba je starší než 45 dní.");
      // zrušený účet: pokladny smí jen dovézt tržby prodané před zrušením – drží to server, ne jen pokladna (R6.2)
      if (account.closedAt && soldAtMs > account.closedAt.getTime()) {
        throw new IngestRejection("ACCOUNT_CLOSED", "Účet je zrušený – tržba prodaná po zrušení se do FS neodešle.");
      }
      // Pokladna se starou konfigurací (kiosk, offline při přepnutí) nesmí po přepnutí účtu prodávat
      // v předchozím režimu – „mock“ by dostal falešný POK a do FS by nic nešlo (R5.1). Tržby prodané
      // před přepnutím zůstávají ve svém režimu (Р3, T8/T9). Už přijatá tržba se posuzuje dál podle id.
      if (mode !== accountMode(account) && soldAtMs >= account.eetModeChangedAt.getTime()) {
        const known = await db.query.sales.findFirst({ where: and(eq(schema.sales.id, input.id), eq(schema.sales.accountId, account.id)), columns: { id: true } });
        if (!known) {
          throw new IngestRejection(
            "MODE_MISMATCH",
            `Tržba je v režimu ${MODE_LABEL[mode]}, ale účet je od ${account.eetModeChangedAt.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })} v režimu ${MODE_LABEL[accountMode(account)]}. Pokladna měla staré nastavení.`,
          );
        }
      }
      if (mode === "production" && soldAtMs < productionAcceptsFrom()) {
        throw new IngestRejection("PRODUCTION_NOT_OPEN", "Ostré prostředí Finanční správy přijímá tržby až od 1. 11. 2026 (přechodný režim).");
      }
      const unit = unitById.get(input.unitId);
      if (!unit) throw new IngestRejection("UNKNOWN_UNIT", "Neznámá evidenční jednotka");
      if (mode !== "mock" && !unit.fsUnitId) throw new IngestRejection("UNIT_WITHOUT_FS_ID", "Evidenční jednotka nemá číslo přidělené Finanční správou");

      let sale;
      try {
        sale = buildSale({
          id: input.id,
          deviceId: device.id,
          registerId: device.registerId,
          unitId: String(unit.fsUnitId ?? 1),
          sequence: input.sequence,
          soldAt: input.soldAt,
          lines: input.lines,
          payments: input.payments,
          discount: input.discount,
          tip: input.tip,
          refundOf: input.refundOf ?? null,
          vatPayer: account.vatPayer,
          mode: mode === "production" ? "production" : "test",
          cashierId: input.staffId ?? null,
        });
      } catch (e) {
        if (e instanceof SaleValidationError) throw new IngestRejection("INVALID_SALE", e.issues.join("; "));
        throw e;
      }
      const approved = await checkStaffAndRefund(account.id, device.id, input, sale.total);
      const amounts = evidencedAmounts(sale);
      // i dílčí částky zprávy (urceno_cerp_zuct, cerp_zuct) musí projít XSD – jinak by tržba visela jako MESSAGE_INVALID (A Дрібне 6)
      if ([amounts.total, amounts.prepayment, amounts.redeemed].some((a) => Math.abs(a) > MAX_EET_AMOUNT)) {
        throw new IngestRejection("INVALID_SALE", "Částka tržby přesahuje limit EET 99 999 999,99 Kč.");
      }

      let inserted: { id: string }[];
      try {
        inserted = await db
          .insert(schema.sales)
          .values({
            id: sale.id,
            accountId: account.id,
            deviceId: device.id,
            unitId: unit.id,
            staffId: input.staffId ?? null,
            registerId: sale.registerId,
            fsUnitId: unit.fsUnitId ?? 1,
            sequence: sale.sequence,
            soldAt: new Date(sale.soldAt),
            total: sale.total,
            tip: sale.tip,
            discount: sale.discount,
            payments: sale.payments,
            items: sale.lines,
            vatBreakdown: sale.vat,
            refundOf: sale.refundOf,
            approvedBy: approved?.approvedBy ?? null,
            approvalJti: approved?.approvalJti ?? null,
            evidencedTotal: amounts.total,
            prepaymentAmount: amounts.prepayment,
            redeemedAmount: amounts.redeemed,
            status: amounts.total === 0 ? "not_required" : "queued",
            mode,
            deadlineAt: deadlineFor(sale.soldAt),
          })
          .onConflictDoNothing({ target: schema.sales.id })
          .returning({ id: schema.sales.id });
      } catch (e) {
        // unikátní (zařízení, pořadové číslo) → jiná tržba už má toto číslo: trvalý konflikt
        if (/sales_device_seq_uq/.test(errorText(e))) throw new IngestRejection("SEQUENCE_CONFLICT", "Pořadové číslo už bylo použito jinou tržbou", 409);
        if (/sales_refund_of_uq/.test(errorText(e))) throw new IngestRejection("REFUND_DUPLICATE", "Tato tržba už byla vrácena", 409);
        if (/sales_approval_jti_uq/.test(errorText(e))) throw new IngestRejection("REFUND_NOT_AUTHORIZED", "Toto schválení vratky už bylo použito – vlastník musí schválit znovu", 403);
        throw e;
      }

      if (!inserted.length) {
        const existing = await db.query.sales.findFirst({ where: eq(schema.sales.id, sale.id) });
        if (!existing || existing.accountId !== account.id || existing.deviceId !== device.id) {
          throw new IngestRejection("ID_CONFLICT", "Konflikt identifikátoru tržby", 409);
        }
        // Stejné id musí znamenat stejnou tržbu – jinak jde o konflikt, ne o „už máme“.
        const same =
          existing.sequence === sale.sequence &&
          existing.soldAt.getTime() === Date.parse(sale.soldAt) &&
          existing.total === sale.total &&
          existing.tip === sale.tip &&
          existing.discount === sale.discount &&
          existing.unitId === unit.id &&
          existing.mode === mode &&
          (existing.refundOf ?? null) === (sale.refundOf ?? null) &&
          stable(existing.payments) === stable(sale.payments) &&
          stable(existing.items) === stable(sale.lines);
        if (!same) throw new IngestRejection("CONTENT_CONFLICT", "Tržba se stejným identifikátorem už existuje s jiným obsahem", 409);
      }
      await markIngested(account.id, sale.id);
      results.push({ id: sale.id, ok: true, inserted: inserted.length > 0 });
    } catch (e) {
      if (e instanceof IngestRejection) {
        // původní verze tržby, kterou vlastník z karantény už přijal (např. s časem přijetí) → známá, ne nová karanténa (R5.7)
        if (await ingestedFromQuarantine(account.id, input.id).catch(() => false)) {
          results.push({ id: input.id, ok: true, inserted: false });
          continue;
        }
        try {
          await quarantineSale(ctx, input, e.code, e.message);
          results.push({ id: input.id, ok: false, retryable: false, quarantined: true, code: e.code, error: e.message, httpStatus: e.httpStatus });
        } catch {
          // ani karanténu nešlo uložit → pokladna musí tržbu držet a poslat znovu
          results.push({ id: input.id, ok: false, retryable: true, quarantined: false, code: "TEMPORARY", error: "Server je dočasně nedostupný, tržba se odešle znovu." });
        }
        continue;
      }
      console.error("[ingest] dočasná chyba", { saleId: input.id, error: errorName(e) });
      results.push({ id: input.id, ok: false, retryable: true, quarantined: false, code: "TEMPORARY", error: "Server je dočasně nedostupný, tržba se odešle znovu." });
    }
  }
  return results;
}

function errorText(e: unknown): string {
  const cause = (e as { cause?: unknown })?.cause;
  return `${e instanceof Error ? e.message : String(e)} ${cause instanceof Error ? cause.message : ""} ${(cause as { constraint?: string })?.constraint ?? ""} ${(e as { constraint_name?: string })?.constraint_name ?? ""}`;
}

/** Do logu jen druh chyby – žádné parametry SQL ani data tržby (Р6). */
function errorName(e: unknown): string {
  const cause = (e as { cause?: { code?: string } })?.cause;
  return `${e instanceof Error ? e.name : typeof e}${cause?.code ? ` ${cause.code}` : ""}`;
}
