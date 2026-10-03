import "server-only";
import { getDb, schema } from "@ez/db";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
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
  REFUND_MODE_MISMATCH: "Vratka je v jiném režimu než původní prodej – pokladna ji neodešle. Vyřiďte ji ručně.",
  UNKNOWN_STAFF: "Pokladní nepatří k tomuto účtu.",
  PRODUCTION_NOT_OPEN: "Ostré prostředí Finanční správy přijímá tržby až od 1. 11. 2026 (přechodný režim) – tržba z dřívější doby se odeslat nedá. Vyřiďte ji ručně.",
  ACCOUNT_CLOSED: "Účet je zrušený – prodej po zrušení účtu se Finanční správě neodešle.",
  MODE_MISMATCH: "Pokladna prodávala v režimu, který už neplatí – účet byl mezitím přepnut. Rozhodněte, zda tržbu odeslat v aktuálním režimu, nebo šlo o zkoušku.",
};

/**
 * Uloží tržbu do karantény a upozorní vlastníka. Karanténu, kterou vlastník už vyřídil ručně (dismissed), opakované
 * odeslání z pokladny znovu neotevře ani nepošle e-mail (Д-10) – vrací `{ dismissed: poznámka }`.
 */
export async function quarantineSale(ctx: DeviceContext, payload: unknown, reasonCode: string, reason: string): Promise<{ dismissed: string } | null> {
  const db = getDb();
  const id = (payload as { id?: unknown })?.id;
  if (typeof id !== "string") return null;
  const prior = await db.query.saleQuarantine.findFirst({ where: and(eq(schema.saleQuarantine.id, id), eq(schema.saleQuarantine.accountId, ctx.account.id)), columns: { resolution: true, note: true } });
  if (prior?.resolution === "dismissed") return { dismissed: prior.note ?? "Vyřízeno vlastníkem" };
  const written = await db
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
      // cizí účet nikdy nepřepíše záznam jiného účtu; vyřízenou karanténu neotevře ani souběžný požadavek (Д-10)
      setWhere: and(eq(schema.saleQuarantine.accountId, ctx.account.id), or(isNull(schema.saleQuarantine.resolution), ne(schema.saleQuarantine.resolution, "dismissed"))),
    })
    .returning({ resolution: schema.saleQuarantine.resolution });
  if (!written.length && prior) return { dismissed: "Vyřízeno vlastníkem" };
  // zrušený účet: „dokud ji nevyřídíte, Finanční správě se neodešle“ neplatí – neodešle se vůbec (R7.15 N8). Ostrá tržba se
  // objeví v seznamu neodeslaných (souhrnné e-maily, „Evidováno jinak“) a vlastník dostane jen e-mail o ní (R7.12).
  if (ctx.account.closedAt) {
    const mode = (payload as { mode?: unknown }).mode;
    if (mode === "production" || (reasonCode === "MODE_MISMATCH" && ctx.account.eetMode === "production")) await notifyClosedUnsent(ctx);
    return null;
  }
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
  return null;
}

/**
 * Zrušený účet: pokladna dovezla ostrou tržbu, která se Finanční správě už neodešle (R7.12). Objeví se v seznamu
 * neodeslaných tržeb v nastavení; vlastník dostane e-mail nejvýš jednou denně, aby ho nepřekvapila až „Evidováno jinak“.
 */
export async function notifyClosedUnsent(ctx: DeviceContext): Promise<void> {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });
  for (const to of await ownerEmails(ctx.account.id)) {
    await enqueueEmail({
      to,
      template: "notice",
      dedupeKey: `closed-unsent:${ctx.account.id}:${day}:${to}`,
      payload: {
        subject: "Zrušený účet: pokladna předala neodeslanou ostrou tržbu",
        text: `Pokladna ${ctx.device.registerId} předala do zrušeného účtu ostrou tržbu, která se Finanční správě už neodešle. Najdete ji v seznamu neodeslaných tržeb v nastavení pokladny. Evidujte ji jinak (např. v aplikaci MOJE eet) a potom ji v nastavení pokladny označte „Evidováno jinak“.`,
        url: absoluteUrl("/pokladna/nastaveni"),
        buttonLabel: "Otevřít nastavení",
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

const MODE_RANK: Record<string, number> = { mock: 0, playground: 1, production: 2 };

/**
 * Smí se tržba z režimu `sold` odeslat v režimu `target`? Jen směrem nahoru (R6.1): tržba z ostrého
 * provozu nesmí skončit v Playgroundu ani v simulaci – dostala by falešný POK a do FS by nic nešlo (Р3).
 */
export function canSendInMode(sold: string | null | undefined, target: string): boolean {
  const from = MODE_RANK[sold ?? "mock"];
  const to = MODE_RANK[target];
  return from !== undefined && to !== undefined && to >= from;
}

/** Proč nejde tržbu odeslat v nižším režimu (text pro vlastníka). */
export function sendDownRefused(sold: string | null | undefined): string {
  return sold === "production"
    ? "Tržbu prodanou v ostrém režimu nelze odeslat v testovacím. Přepněte účet zpět, nebo ji vyřiďte ručně."
    : "Tržbu prodanou v režimu Playground nelze odeslat v ukázkovém. Přepněte účet zpět, nebo ji vyřiďte ručně.";
}

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
    const target = accountMode(account);
    if (!canSendInMode(payload.mode as string | undefined, target)) throw new HttpError(400, sendDownRefused(payload.mode as string | undefined));
    payload = { ...payload, mode: target };
  }
  const { ingestSales, DeviceSaleSchema } = await import("./sales");
  const parsed = DeviceSaleSchema.safeParse(payload);
  if (!parsed.success) throw new HttpError(400, "Data tržby jsou neúplná – vyřiďte ji ručně.");
  const [result] = await ingestSales({ device, account }, [parsed.data]);
  return result!.ok ? { ok: true as const, result } : { ok: false as const, result };
}
