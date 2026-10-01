import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError } from "@/lib/server/auth";
import { limitsFor } from "@/lib/server/account";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { UnitInput } from "@/lib/server/schemas";

export const POST = ownerRoute(async ({ req, accountId }) => {
  const input = await parseJson(req, UnitInput);
  const db = getDb();
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.evidenceUnits)
    .where(and(eq(schema.evidenceUnits.accountId, accountId), eq(schema.evidenceUnits.active, true)));
  const limit = limitsFor(account.plan).units;
  if (n >= limit) throw new HttpError(400, `Zdarma můžete mít ${limit} evidenční jednotky. Více v Premium.`);
  const [unit] = await db
    .insert(schema.evidenceUnits)
    .values({ accountId, type: input.type, label: input.label, fsUnitId: input.fsUnitId ?? null, address: input.address ?? null, changedAt: new Date() })
    .returning();
  return Response.json({ unit });
});
