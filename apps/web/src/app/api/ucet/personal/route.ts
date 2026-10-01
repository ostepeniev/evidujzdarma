import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError } from "@/lib/server/auth";
import { limitsFor } from "@/lib/server/account";
import { hashPin } from "@/lib/pos/pin";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { StaffInput } from "@/lib/server/schemas";

export const POST = ownerRoute(async ({ req, accountId }) => {
  const input = await parseJson(req, StaffInput);
  const db = getDb();
  const account = (await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }))!;
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.staff)
    .where(and(eq(schema.staff.accountId, accountId), eq(schema.staff.active, true)));
  const limit = limitsFor(account.plan).staff;
  if (n >= limit) throw new HttpError(400, `Zdarma až ${limit} uživatelů. Více v Premium.`);
  const [row] = await db
    .insert(schema.staff)
    .values({ accountId, name: input.name, role: input.role, pinHash: input.pin ? await hashPin(input.pin) : null })
    .returning({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role, active: schema.staff.active });
  return Response.json({ staff: { ...row, hasPin: !!input.pin } });
});
