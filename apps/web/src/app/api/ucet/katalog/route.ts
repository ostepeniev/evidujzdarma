import { createCatalogItem } from "@/lib/server/catalog-import";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { CatalogInput } from "@/lib/server/schemas";

/** Nová položka katalogu z nastavení – strop katalogu (5 000 položek) hlídá createCatalogItem stejně jako import (S3-POKLADNA). */
export const POST = ownerRoute(async ({ req, accountId }) => {
  const input = await parseJson(req, CatalogInput);
  const item = await createCatalogItem(accountId, input);
  return Response.json({ item });
});
