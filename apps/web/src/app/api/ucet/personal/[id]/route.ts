import { and, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError } from "@/lib/server/auth";
import { hashPin } from "@/lib/pos/pin";
import { validatePinForRole } from "@/lib/server/staff-pin";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { StaffPatch } from "@/lib/server/schemas";

export const PATCH = ownerRoute<{ id: string }>(async ({ req, accountId, params }) => {
  const input = await parseJson(req, StaffPatch);
  const db = getDb();
  const current = await db.query.staff.findFirst({ where: and(eq(schema.staff.id, params.id), eq(schema.staff.accountId, accountId)) });
  if (!current) throw new HttpError(404, "Uživatel nenalezen");
  if (input.pin) validatePinForRole(current.role, input.pin);
  if (input.pin === null && current.role === "owner") throw new HttpError(400, "Vlastník musí mít PIN (6–8 číslic).");
  if (input.active === false && current.role === "owner") {
    const others = await db.query.staff.findFirst({
      where: and(eq(schema.staff.accountId, accountId), eq(schema.staff.role, "owner"), eq(schema.staff.active, true), ne(schema.staff.id, params.id)),
    });
    if (!others) throw new HttpError(400, "Vlastníka nelze deaktivovat.");
  }
  const [row] = await db
    .update(schema.staff)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.pin !== undefined ? { pinHash: input.pin ? await hashPin(input.pin) : null } : {}),
    })
    // příslušnost k účtu ověřil dotaz výše; UPDATE se na účet omezí i tak (obrana do hloubky, B Дрібне 5)
    .where(and(eq(schema.staff.id, params.id), eq(schema.staff.accountId, accountId)))
    .returning({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role, active: schema.staff.active, pinHash: schema.staff.pinHash });
  return Response.json({ staff: { id: row!.id, name: row!.name, role: row!.role, active: row!.active, hasPin: !!row!.pinHash } });
});
