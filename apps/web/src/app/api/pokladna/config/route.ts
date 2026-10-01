import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { authenticateDevice, errorResponse } from "@/lib/server/auth";
import { accountMode } from "@/lib/server/fiscal";

/** Konfigurace pro pokladnu (uloží se offline v zařízení). Obsahuje hashe PINů pro offline přihlášení. */
export async function GET(req: Request) {
  try {
    const { device, account } = await authenticateDevice(req);
    const db = getDb();
    const [units, staff, catalog] = await Promise.all([
      db.select().from(schema.evidenceUnits).where(eq(schema.evidenceUnits.accountId, account.id)).orderBy(asc(schema.evidenceUnits.createdAt)),
      db
        .select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role, pinHash: schema.staff.pinHash })
        .from(schema.staff)
        .where(and(eq(schema.staff.accountId, account.id), eq(schema.staff.active, true)))
        .orderBy(asc(schema.staff.createdAt)),
      db
        .select()
        .from(schema.catalogItems)
        .where(and(eq(schema.catalogItems.accountId, account.id), eq(schema.catalogItems.active, true)))
        .orderBy(asc(schema.catalogItems.sort), asc(schema.catalogItems.name)),
    ]);
    return Response.json(
      {
        fetchedAt: new Date().toISOString(),
        device: { id: device.id, name: device.name, registerId: device.registerId, sequencePrefix: device.sequencePrefix, unitId: device.unitId },
        account: {
          id: account.id,
          name: account.name,
          ico: account.ico,
          dic: account.dic,
          vatPayer: account.vatPayer,
          iban: account.iban,
          receiptHeader: account.receiptHeader,
          receiptFooter: account.receiptFooter,
          mode: accountMode(account),
          plan: account.plan,
        },
        units: units.map((u) => ({ id: u.id, label: u.label, type: u.type, fsUnitId: u.fsUnitId, active: u.active, address: u.address })),
        staff,
        catalog: catalog.map((c) => ({ id: c.id, name: c.name, price: c.price, vatRate: c.vatRate, color: c.color })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
