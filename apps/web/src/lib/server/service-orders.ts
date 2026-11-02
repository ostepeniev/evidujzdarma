import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { SERVICE_ORDER_STATUSES, type ServiceOrderStatus } from "@ez/db/schema";
import { ACCOUNTANT_SETUP_REWARD, SETUP_SERVICE } from "@/content/services";
import { isPartnerCode } from "@/lib/setup-ref";
import { HttpError } from "./auth";
import { shortCode } from "./tokens";

/**
 * S11: poptávky služeb uložené v DB (service_orders) a doporučení od účetních kanceláří.
 *  - Kancelář má stálý kód (accounts.partner_code); odkaz /nastaveni-na-klic?ref=<kód> ho přenese do poptávky.
 *  - Stav poptávky mění jen správce (/admin/nastaveni). Odměna ACCOUNTANT_SETUP_REWARD Kč za každé „hotovo“ u balíčku
 *    Nastavení na klíč; výplata je ruční, kabinet ukazuje jen součet.
 */

export { SERVICE_ORDER_STATUSES, type ServiceOrderStatus };

export const SERVICE_ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  zadano: "zadáno",
  v_reseni: "v řešení",
  hotovo: "hotovo",
  zruseno: "zrušeno",
};

export const isServiceOrderStatus = (v: unknown): v is ServiceOrderStatus => typeof v === "string" && (SERVICE_ORDER_STATUSES as readonly string[]).includes(v);

/** Kód kanceláře; když ještě není, vytvoří ho (unikátní index, při kolizi nový pokus). */
export async function ensurePartnerCode(accountantAccountId: string): Promise<string> {
  const db = getDb();
  for (let i = 0; i < 5; i++) {
    const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountantAccountId), columns: { partnerCode: true, kind: true } });
    if (!acc) throw new HttpError(404, "Kancelář nenalezena");
    if (acc.kind !== "accountant") throw new HttpError(400, "Kód má jen účetní kancelář");
    if (acc.partnerCode) return acc.partnerCode;
    try {
      const [row] = await db
        .update(schema.accounts)
        .set({ partnerCode: shortCode(8) })
        .where(and(eq(schema.accounts.id, accountantAccountId), isNull(schema.accounts.partnerCode)))
        .returning({ code: schema.accounts.partnerCode });
      if (row?.code) return row.code;
    } catch {
      // kolize unikátního kódu – zkusíme jiný
    }
  }
  throw new Error("partner code: no free code");
}

/** Účetní kancelář podle kódu z odkazu, nebo null (neplatný či neznámý kód se tiše ignoruje). */
export async function referrerByCode(code: unknown): Promise<{ accountId: string; code: string } | null> {
  if (!isPartnerCode(code)) return null;
  const acc = await getDb().query.accounts.findFirst({
    where: and(eq(schema.accounts.partnerCode, code), eq(schema.accounts.kind, "accountant"), isNull(schema.accounts.closedAt)),
    columns: { id: true },
  });
  return acc ? { accountId: acc.id, code } : null;
}

export async function createServiceOrder(input: {
  package: string;
  email: string;
  ico: string | null;
  companyName: string | null;
  establishments: number | null;
  referrer: { accountId: string; code: string } | null;
}): Promise<string> {
  const [row] = await getDb()
    .insert(schema.serviceOrders)
    .values({
      package: input.package,
      email: input.email,
      ico: input.ico,
      companyName: input.companyName,
      establishments: input.establishments,
      referrerAccountId: input.referrer?.accountId ?? null,
      refCode: input.referrer?.code ?? null,
    })
    .returning({ id: schema.serviceOrders.id });
  return row!.id;
}

export interface ReferredOrder {
  id: string;
  createdAt: string;
  service: string;
  /** název firmy z ARES, jinak null – e-mail klienta účetní neukazujeme */
  companyName: string | null;
  ico: string | null;
  status: ServiceOrderStatus;
  statusLabel: string;
  /** odměna v Kč (jen dokončené Nastavení na klíč) */
  reward: number;
}

/** Odměna za jednu poptávku. */
export const orderReward = (o: { package: string; status: string }) => (o.package === SETUP_SERVICE.id && o.status === "hotovo" ? ACCOUNTANT_SETUP_REWARD : 0);

/** Poptávky klientů, které kancelář doporučila (tabulka „Doporučená nastavení“ v kabinetu). */
export async function referredOrders(accountantAccountId: string): Promise<{ orders: ReferredOrder[]; rewardTotal: number }> {
  const rows = await getDb()
    .select()
    .from(schema.serviceOrders)
    .where(eq(schema.serviceOrders.referrerAccountId, accountantAccountId))
    .orderBy(desc(schema.serviceOrders.createdAt))
    .limit(500);
  const orders = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    service: r.package === SETUP_SERVICE.id ? "Nastavení na klíč" : "Připojení pokladny",
    companyName: r.companyName,
    ico: r.ico,
    status: r.status,
    statusLabel: SERVICE_ORDER_STATUS_LABEL[r.status] ?? r.status,
    reward: orderReward(r),
  }));
  return { orders, rewardTotal: orders.reduce((s, o) => s + o.reward, 0) };
}

export interface AdminServiceOrder {
  id: string;
  createdAt: Date;
  package: string;
  email: string;
  ico: string | null;
  companyName: string | null;
  establishments: number | null;
  status: ServiceOrderStatus;
  referrerName: string | null;
  refCode: string | null;
}

/** Seznam pro /admin/nastaveni (nejnovější nahoře). */
export async function adminServiceOrders(limit = 300): Promise<AdminServiceOrder[]> {
  const db = getDb();
  return db
    .select({
      id: schema.serviceOrders.id,
      createdAt: schema.serviceOrders.createdAt,
      package: schema.serviceOrders.package,
      email: schema.serviceOrders.email,
      ico: schema.serviceOrders.ico,
      companyName: schema.serviceOrders.companyName,
      establishments: schema.serviceOrders.establishments,
      status: schema.serviceOrders.status,
      referrerName: schema.accounts.name,
      refCode: schema.serviceOrders.refCode,
    })
    .from(schema.serviceOrders)
    .leftJoin(schema.accounts, eq(schema.accounts.id, schema.serviceOrders.referrerAccountId))
    .orderBy(desc(schema.serviceOrders.createdAt))
    .limit(limit);
}

/** Změna stavu – jen správce (volající ověří currentAdmin). */
export async function setServiceOrderStatus(id: string, status: unknown): Promise<void> {
  if (!isServiceOrderStatus(status)) throw new HttpError(400, "Neplatný stav");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Poptávka nenalezena");
  const [row] = await getDb()
    .update(schema.serviceOrders)
    .set({ status, statusChangedAt: sql`now()` })
    .where(eq(schema.serviceOrders.id, id))
    .returning({ id: schema.serviceOrders.id });
  if (!row) throw new HttpError(404, "Poptávka nenalezena");
}
