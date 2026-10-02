import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError } from "@/lib/server/auth";
import { setUnitActive } from "@/lib/server/account";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { UnitPatch } from "@/lib/server/schemas";

export const PATCH = ownerRoute<{ id: string }>(async ({ req, accountId, params }) => {
  const { active, ...input } = await parseJson(req, UnitPatch);
  // zapnutí jednotky hlídá limit plánu (B Дрібне 6)
  if (active !== undefined) await setUnitActive(accountId, params.id, active);
  const [unit] = await getDb()
    .update(schema.evidenceUnits)
    .set({ ...input, changedAt: new Date() })
    .where(and(eq(schema.evidenceUnits.id, params.id), eq(schema.evidenceUnits.accountId, accountId)))
    .returning();
  if (!unit) throw new HttpError(404, "Jednotka nenalezena");
  return Response.json({ unit });
});

/** Jednotky nemažeme, jen deaktivujeme — historie tržeb musí zůstat dohledatelná. */
export const DELETE = ownerRoute<{ id: string }>(async ({ accountId, params }) => {
  const [unit] = await getDb()
    .update(schema.evidenceUnits)
    .set({ active: false, changedAt: new Date() })
    .where(and(eq(schema.evidenceUnits.id, params.id), eq(schema.evidenceUnits.accountId, accountId)))
    .returning();
  if (!unit) throw new HttpError(404, "Jednotka nenalezena");
  return Response.json({ ok: true });
});
