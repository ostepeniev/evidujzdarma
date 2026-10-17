import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { IMPORT_LIMITS, nameKey } from "@/lib/pos/import-products";
import { HttpError } from "./auth";

export interface CatalogImportItem {
  name: string;
  /** cena s DPH v haléřích */
  price: number;
  vatRate: number;
  /** S3-POKLADNA: kategorie a kód zboží (EAN / PLU / SKU) z exportu jiné pokladny */
  category?: string | null;
  ean?: string | null;
}

/**
 * S2-E: hromadné vložení zboží do katalogu účtu. Názvy, které už v katalogu jsou (nebo se v importu opakují), přeskočí –
 * server to kontroluje sám, náhled v prohlížeči je jen pomoc. Katalog účtu má strop IMPORT_LIMITS.maxCatalog.
 * Souběžné importy téhož účtu se seřadí zámkem řádku účtu (stejně jako import certifikátu).
 */
export async function importCatalogItems(accountId: string, items: readonly CatalogImportItem[]) {
  return getDb().transaction(async (tx) => {
    const [account] = await tx
      .select({ id: schema.accounts.id, closedAt: schema.accounts.closedAt })
      .from(schema.accounts)
      .where(eq(schema.accounts.id, accountId))
      .for("update");
    if (!account) throw new HttpError(404, "Účet nenalezen");
    if (account.closedAt) throw new HttpError(400, "Účet je zrušený.");

    const existing = await tx.select({ name: schema.catalogItems.name, sort: schema.catalogItems.sort }).from(schema.catalogItems).where(eq(schema.catalogItems.accountId, accountId));
    const seen = new Set(existing.map((e) => nameKey(e.name)));
    const fresh: CatalogImportItem[] = [];
    const skipped: { name: string; reason: "duplicate" }[] = [];
    for (const it of items) {
      const name = it.name.trim().replace(/\s+/g, " ");
      const key = nameKey(name);
      if (seen.has(key)) {
        skipped.push({ name, reason: "duplicate" });
        continue;
      }
      seen.add(key);
      fresh.push({ ...it, name });
    }
    if (existing.length + fresh.length > IMPORT_LIMITS.maxCatalog) {
      throw new HttpError(400, `Katalog pojme nejvýš ${IMPORT_LIMITS.maxCatalog.toLocaleString("cs-CZ")} položek. Teď jich má ${existing.length}, import by přidal ${fresh.length}.`);
    }
    if (fresh.length === 0) return { created: [] as { id: string; name: string }[], skipped };

    // nová tlačítka za stávající; pořadí určil náhled (kategorie, pak pořadí v souboru)
    const start = existing.reduce((m, e) => Math.max(m, e.sort + 1), existing.length);
    const created: { id: string; name: string }[] = [];
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500);
      const rows = await tx
        .insert(schema.catalogItems)
        .values(chunk.map((it, j) => ({ accountId, name: it.name, price: it.price, vatRate: it.vatRate, category: it.category ?? null, ean: it.ean ?? null, sort: start + i + j, active: true })))
        .returning({ id: schema.catalogItems.id, name: schema.catalogItems.name });
      created.push(...rows);
    }
    return { created, skipped };
  });
}

/**
 * Jedna položka z nastavení (S3-POKLADNA): stejný strop katalogu IMPORT_LIMITS.maxCatalog jako import, pod zámkem řádku
 * účtu, aby ho souběžné přidávání nepřekročilo.
 */
export async function createCatalogItem(
  accountId: string,
  input: { name: string; price: number; vatRate: number; color?: string | null; sort?: number; active?: boolean; category?: string | null; ean?: string | null },
) {
  return getDb().transaction(async (tx) => {
    const [account] = await tx.select({ id: schema.accounts.id, closedAt: schema.accounts.closedAt }).from(schema.accounts).where(eq(schema.accounts.id, accountId)).for("update");
    if (!account) throw new HttpError(404, "Účet nenalezen");
    if (account.closedAt) throw new HttpError(400, "Účet je zrušený.");
    const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.catalogItems).where(eq(schema.catalogItems.accountId, accountId));
    if ((c?.n ?? 0) >= IMPORT_LIMITS.maxCatalog) {
      throw new HttpError(400, `Katalog pojme nejvýš ${IMPORT_LIMITS.maxCatalog.toLocaleString("cs-CZ")} položek. Nejdřív nějakou smažte.`);
    }
    const [item] = await tx
      .insert(schema.catalogItems)
      .values({
        accountId,
        name: input.name,
        price: input.price,
        vatRate: input.vatRate,
        color: input.color ?? null,
        sort: input.sort ?? 0,
        active: input.active ?? true,
        category: input.category ?? null,
        ean: input.ean ?? null,
      })
      .returning();
    return item!;
  });
}

/** Vrácení importu: smaže položky podle id – jen z katalogu tohoto účtu. */
export async function undoCatalogImport(accountId: string, ids: readonly string[]): Promise<number> {
  const rows = await getDb()
    .delete(schema.catalogItems)
    .where(and(eq(schema.catalogItems.accountId, accountId), inArray(schema.catalogItems.id, [...ids])))
    .returning({ id: schema.catalogItems.id });
  return rows.length;
}

/** Počet položek v katalogu účtu (pro testy a přehled). */
export async function catalogCount(accountId: string): Promise<number> {
  const [r] = await getDb().select({ n: sql<number>`count(*)::int` }).from(schema.catalogItems).where(eq(schema.catalogItems.accountId, accountId));
  return r?.n ?? 0;
}
