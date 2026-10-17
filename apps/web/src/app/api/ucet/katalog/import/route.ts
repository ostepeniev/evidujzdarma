import { HttpError } from "@/lib/server/auth";
import { importCatalogItems, undoCatalogImport } from "@/lib/server/catalog-import";
import { rateLimit } from "@/lib/server/rate-limit";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { CatalogImportInput, CatalogImportUndo } from "@/lib/server/schemas";

/**
 * S2-E: import zboží ze souboru jiné pokladny. Soubor čte a kontroluje prohlížeč (lib/pos/import-products.ts);
 * sem přijdou jen hotové položky jako JSON (tělo nejvýš 1 MB – API_BODY_LIMIT, nejvýš 2 000 položek – CatalogImportInput).
 * Server znovu ověří každou položku, přeskočí názvy, které už v katalogu jsou, a hlídá strop katalogu.
 */
export const POST = ownerRoute(async ({ req, accountId }) => {
  if (!rateLimit(`catalog-import:${accountId}`, 10, 3600)) throw new HttpError(429, "Import lze spustit nejvýš 10× za hodinu. Zkuste to prosím později.");
  const input = await parseJson(req, CatalogImportInput);
  const { created, skipped } = await importCatalogItems(accountId, input.items);
  return Response.json({ created: created.length, ids: created.map((c) => c.id), skipped });
});

/** Vrátit import: smaže položky, které vytvořil poslední import (id z odpovědi POST). */
export const DELETE = ownerRoute(async ({ req, accountId }) => {
  if (!rateLimit(`catalog-import-undo:${accountId}`, 20, 3600)) throw new HttpError(429, "Příliš mnoho požadavků. Zkuste to prosím později.");
  const input = await parseJson(req, CatalogImportUndo);
  const deleted = await undoCatalogImport(accountId, input.ids);
  return Response.json({ deleted });
});
