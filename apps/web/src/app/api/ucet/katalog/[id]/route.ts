import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError } from "@/lib/server/auth";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { CatalogPatch } from "@/lib/server/schemas";

export const PATCH = ownerRoute<{ id: string }>(async ({ req, accountId, params }) => {
  const input = await parseJson(req, CatalogPatch);
  const [item] = await getDb()
    .update(schema.catalogItems)
    .set(input)
    .where(and(eq(schema.catalogItems.id, params.id), eq(schema.catalogItems.accountId, accountId)))
    .returning();
  if (!item) throw new HttpError(404, "Položka nenalezena");
  return Response.json({ item });
});

export const DELETE = ownerRoute<{ id: string }>(async ({ accountId, params }) => {
  await getDb()
    .delete(schema.catalogItems)
    .where(and(eq(schema.catalogItems.id, params.id), eq(schema.catalogItems.accountId, accountId)));
  return Response.json({ ok: true });
});
