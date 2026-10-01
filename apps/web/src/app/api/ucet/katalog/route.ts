import { getDb, schema } from "@ez/db";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { CatalogInput } from "@/lib/server/schemas";

export const POST = ownerRoute(async ({ req, accountId }) => {
  const input = await parseJson(req, CatalogInput);
  const [item] = await getDb()
    .insert(schema.catalogItems)
    .values({ accountId, name: input.name, price: input.price, vatRate: input.vatRate, color: input.color ?? null, sort: input.sort ?? 0, active: input.active ?? true })
    .returning();
  return Response.json({ item });
});
