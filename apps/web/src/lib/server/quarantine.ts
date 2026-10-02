import "server-only";
import { getDb, schema } from "@ez/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { absoluteUrl } from "@/lib/site";
import type { DeviceContext } from "./auth";
import { HttpError } from "./auth";
import { enqueueEmail } from "./mail";
import { ownerEmails } from "./owners";

/**
 * Karanténa tržeb (Р2). Tržba, kterou nelze přijmout kvůli datům (datum, jednotka, konflikt),
 * se uloží celá a čeká na vlastníka. Nikdy se nezahazuje.
 */
export const QUARANTINE_REASON_TEXT: Record<string, string> = {
  FUTURE_DATE: "Datum tržby je v budoucnosti – v pokladně je špatně nastavený čas.",
  TOO_OLD: "Tržba je starší než 45 dní.",
  UNKNOWN_UNIT: "Neznámá evidenční jednotka.",
  UNIT_WITHOUT_FS_ID: "Evidenční jednotka nemá číslo přidělené Finanční správou.",
  INVALID_SALE: "Tržba neprošla kontrolou (částky, položky nebo platby).",
  INVALID_PAYLOAD: "Pokladna poslala neúplná data.",
  SEQUENCE_CONFLICT: "Pořadové číslo už má jiná tržba.",
  CONTENT_CONFLICT: "Tržba se stejným identifikátorem už existuje s jiným obsahem.",
  ID_CONFLICT: "Identifikátor tržby už patří jiné pokladně.",
  REFUND_EXCEEDS: "Vratka je vyšší než původní tržba.",
  REFUND_UNKNOWN_ORIGINAL: "Původní tržba k vratce není na serveru.",
  REFUND_DUPLICATE: "K této tržbě už vratka existuje.",
  REFUND_NOT_AUTHORIZED: "Vratku smí udělat jen vlastník nebo s jeho schválením.",
  UNKNOWN_STAFF: "Pokladní nepatří k tomuto účtu.",
  PRODUCTION_NOT_OPEN: "Ostré prostředí Finanční správy přijímá tržby až od 1. 11. 2026 (přechodný režim) – tržba z dřívější doby se odeslat nedá. Vyřiďte ji ručně.",
  MODE_MISMATCH: "Pokladna prodávala v režimu, který už neplatí – účet byl mezitím přepnut. Rozhodněte, zda tržbu odeslat v aktuálním režimu, nebo šlo o zkoušku.",
};

export async function quarantineSale(ctx: DeviceContext, payload: unknown, reasonCode: string, reason: string): Promise<void> {
  const db = getDb();
  const id = (payload as { id?: unknown })?.id;
  if (typeof id !== "string") return;
  await db
    .insert(schema.saleQuarantine)
    .values({ id, accountId: ctx.account.id, deviceId: ctx.device.id, payload: payload as object, reasonCode, reason })
    .onConflictDoUpdate({
      target: schema.saleQuarantine.id,
      set: {
        payload: payload as object,
        reasonCode,
        reason,
        attempts: sql`${schema.saleQuarantine.attempts} + 1`,
        updatedAt: new Date(),
        resolution: null,
        resolvedAt: null,
      },
      // cizí účet nikdy nepřepíše záznam jiného účtu
      setWhere: eq(schema.saleQuarantine.accountId, ctx.account.id),
    });
  for (const to of await ownerEmails(ctx.account.id)) {
    await enqueueEmail({
      to,
      template: "notice",
      dedupeKey: `quarantine:${ctx.account.id}:${new Date().toISOString().slice(0, 13)}:${to}`,
      payload: {
        subject: "Tržba čeká na vaše rozhodnutí",
        text: `Pokladna ${ctx.device.registerId} poslala tržbu, kterou jsme nemohli přijmout: ${QUARANTINE_REASON_TEXT[reasonCode] ?? reason}\nTržba je uložená a neztratí se. Otevřete nastavení pokladny a rozhodněte, co s ní – dokud ji nevyřídíte, Finanční správě se neodešle.`,
        url: absoluteUrl("/pokladna/nastaveni#problemove-trzby"),
        buttonLabel: "Vyřídit tržbu",
      },
    });
  }
}

/**
 * Tržbu z karantény už vlastník přijal (resolution 'ingested') a je v evidenci → opakované odeslání původní
 * verze z pokladny (např. s budoucím časem) nesmí karanténu otevřít znovu ani poslat e-mail (R5.7).
 */
export async function ingestedFromQuarantine(accountId: string, id: string): Promise<boolean> {
  const db = getDb();
  const q = await db.query.saleQuarantine.findFirst({ where: and(eq(schema.saleQuarantine.id, id), eq(schema.saleQuarantine.accountId, accountId)), columns: { resolution: true } });
  if (q?.resolution !== "ingested") return false;
  return !!(await db.query.sales.findFirst({ where: and(eq(schema.sales.id, id), eq(schema.sales.accountId, accountId)), columns: { id: true } }));
}

/** Stav tržeb, které nejsou v evidenci, ale jsou v karanténě (pro dotaz pokladny na stavy, R5.7). */
export async function quarantineStatuses(accountId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await getDb()
    .select()
    .from(schema.saleQuarantine)
    .where(and(eq(schema.saleQuarantine.accountId, accountId), inArray(schema.saleQuarantine.id, ids)));
  return rows
    .filter((q) => q.resolution !== "ingested")
    .map((q) => ({
      id: q.id,
      status: "rejected" as const,
      confirmationCode: null,
      lastError: q.resolution === "dismissed" ? (q.note ?? "Vyřízeno vlastníkem") : (QUARANTINE_REASON_TEXT[q.reasonCode] ?? q.reason),
      quarantine: q.resolution === "dismissed" ? ("dismissed" as const) : ("open" as const),
    }));
}

export async function markIngested(accountId: string, id: string): Promise<void> {
  await getDb()
    .update(schema.saleQuarantine)
    .set({ resolution: "ingested", resolvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.saleQuarantine.id, id), eq(schema.saleQuarantine.accountId, accountId), isNull(schema.saleQuarantine.resolvedAt)));
}

export async function listQuarantine(accountId: string) {
  return getDb()
    .select()
    .from(schema.saleQuarantine)
    .where(and(eq(schema.saleQuarantine.accountId, accountId), isNull(schema.saleQuarantine.resolvedAt)))
    .orderBy(desc(schema.saleQuarantine.updatedAt))
    .limit(200);
}

export type QuarantineAction = "retry" | "retry_with_received_time" | "dismiss" | "send_current_mode" | "was_test";

/**
 * Rozhodnutí vlastníka: znovu přijmout (po opravě nastavení), přijmout s časem přijetí serverem
 * (jen u data v budoucnosti), nebo vyřídit ručně (s poznámkou – tržba zůstává v záznamu).
 */
export async function resolveQuarantine(accountId: string, id: string, opts: { action: QuarantineAction; note?: string }) {
  const db = getDb();
  const row = await db.query.saleQuarantine.findFirst({ where: and(eq(schema.saleQuarantine.id, id), eq(schema.saleQuarantine.accountId, accountId)) });
  if (!row) throw new HttpError(404, "Tržba v karanténě neexistuje");
  if (row.resolvedAt) return { ok: true as const, already: true };
  if ((opts.action === "send_current_mode" || opts.action === "was_test") && row.reasonCode !== "MODE_MISMATCH") {
    throw new HttpError(400, "Tuto volbu lze použít jen u tržby prodané ve starém režimu.");
  }
  if (opts.action === "dismiss" || opts.action === "was_test") {
    // „byla to zkouška“: tržba se neeviduje, ale záznam s celým obsahem zůstává (R5.1)
    const note = opts.action === "was_test" ? "Byla to zkouška – pokladna prodávala ve starém režimu, do FS se neposílá." : (opts.note?.slice(0, 500) ?? null);
    await db.update(schema.saleQuarantine).set({ resolution: "dismissed", resolvedAt: new Date(), updatedAt: new Date(), note }).where(eq(schema.saleQuarantine.id, id));
    return { ok: true as const };
  }
  if (!row.deviceId) throw new HttpError(409, "Pokladna, ze které tržba přišla, už neexistuje – vyřiďte tržbu ručně.");
  const device = await db.query.devices.findFirst({ where: eq(schema.devices.id, row.deviceId) });
  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!device || !account) throw new HttpError(409, "Pokladna nebo účet už neexistuje.");
  let payload = row.payload as Record<string, unknown>;
  if (opts.action === "retry_with_received_time") {
    if (row.reasonCode !== "FUTURE_DATE") throw new HttpError(400, "Čas přijetí lze použít jen u tržby s datem v budoucnosti.");
    payload = { ...payload, soldAt: new Date(Math.floor(row.receivedAt.getTime() / 1000) * 1000).toISOString() };
  }
  if (opts.action === "send_current_mode") {
    // vlastník rozhodl: tržba byla skutečná → odeslat v režimu, který účet má teď (R5.1)
    const { accountMode } = await import("./fiscal");
    payload = { ...payload, mode: accountMode(account) };
  }
  const { ingestSales, DeviceSaleSchema } = await import("./sales");
  const parsed = DeviceSaleSchema.safeParse(payload);
  if (!parsed.success) throw new HttpError(400, "Data tržby jsou neúplná – vyřiďte ji ručně.");
  const [result] = await ingestSales({ device, account }, [parsed.data]);
  return result!.ok ? { ok: true as const, result } : { ok: false as const, result };
}
