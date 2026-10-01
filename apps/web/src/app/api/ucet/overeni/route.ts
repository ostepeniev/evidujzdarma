import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { buildSale } from "@ez/fiscal-core";
import { HttpError } from "@/lib/server/auth";
import { accountMode, transportFor } from "@/lib/server/fiscal";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/**
 * Testovací tržba v ověřovacím režimu (overeni=true): Finanční správa zprávu zkontroluje
 * (certifikát, EIČ, číslo jednotky), ale tržbu NEeviduje.
 */
export const POST = ownerRoute(async ({ req, accountId }) => {
  const { unitId } = await parseJson(req, z.object({ unitId: z.string().uuid() }));
  const db = getDb();
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
  const unit = await db.query.evidenceUnits.findFirst({ where: and(eq(schema.evidenceUnits.id, unitId), eq(schema.evidenceUnits.accountId, accountId)) });
  if (!unit) throw new HttpError(404, "Jednotka nenalezena");
  const mode = accountMode(account);
  if (mode !== "mock" && !unit.fsUnitId) throw new HttpError(400, "Jednotka nemá číslo přidělené Finanční správou.");
  const eic = account.eic ?? account.dic;
  if (!eic) throw new HttpError(400, "Vyplňte EIČ (DIČ).");
  const now = new Date();
  const sale = buildSale({
    id: randomUUID(),
    deviceId: "verification",
    registerId: "OVERENI",
    unitId: String(unit.fsUnitId ?? 1),
    sequence: `OVERENI-${now.getTime()}`.slice(0, 25),
    soldAt: now.toISOString(),
    lines: [{ name: "Ověření", qty: 1, unitPrice: 100, vatRate: 0 }],
    payments: [{ method: "cash", amount: 100 }],
    vatPayer: false,
    mode: "test",
  });
  const result = await transportFor(account).send(sale, { firstAttempt: true, verifyOnly: true, eic });
  if (result.ok) return Response.json({ ok: true, mode, test: result.test, warnings: result.warnings });
  return Response.json({ ok: false, mode, code: result.code, message: result.message, retryable: result.retryable }, { status: 200 });
});
