/** Testovací data: účet, vlastník, jednotka, zařízení, pokladní. */
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import type { DeviceContext } from "@/lib/server/auth";

export async function seedAccount(opts: { mode?: "mock" | "playground" | "production"; eic?: string | null } = {}) {
  const db = getDb();
  const [user] = await db.insert(schema.users).values({ email: `owner-${randomUUID()}@example.cz` }).returning();
  const [account] = await db
    .insert(schema.accounts)
    .values({ name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345679", eic: opts.eic === undefined ? "CZ12345679" : opts.eic, eetMode: opts.mode ?? "mock" })
    .returning();
  await db.insert(schema.memberships).values({ accountId: account!.id, userId: user!.id, role: "owner" });
  const [owner] = await db.insert(schema.staff).values({ accountId: account!.id, name: "Jana", role: "owner" }).returning();
  const [cashier] = await db.insert(schema.staff).values({ accountId: account!.id, name: "Petra", role: "cashier" }).returning();
  const [unit] = await db.insert(schema.evidenceUnits).values({ accountId: account!.id, type: "stala_provozovna", label: "Salon", fsUnitId: 303 }).returning();
  const [device] = await db
    .insert(schema.devices)
    .values({ accountId: account!.id, name: "Tablet", registerId: "P1", sequencePrefix: "P1-TEST-", tokenHash: randomUUID(), unitId: unit!.id })
    .returning();
  return { user: user!, account: account!, owner: owner!, cashier: cashier!, unit: unit!, device: device! };
}

export async function deviceContext(deviceId: string): Promise<DeviceContext> {
  const db = getDb();
  const device = (await db.query.devices.findFirst({ where: eq(schema.devices.id, deviceId) }))!;
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, device.accountId) }))!;
  return { device, account };
}

let seq = 0;
/** Tržba tak, jak ji posílá pokladna. */
export function deviceSale(unitId: string, over: Record<string, unknown> = {}) {
  seq++;
  return {
    id: randomUUID(),
    sequence: `P1-TEST-${String(seq).padStart(6, "0")}`,
    soldAt: new Date(Math.floor(Date.now() / 1000) * 1000).toISOString(),
    unitId,
    staffId: null,
    lines: [{ name: "Střih", qty: 1, unitPrice: 35000, vatRate: 21 }],
    payments: [{ method: "cash", amount: 35000 }],
    discount: 0,
    tip: 0,
    refundOf: null,
    mode: "mock",
    ...over,
  };
}
