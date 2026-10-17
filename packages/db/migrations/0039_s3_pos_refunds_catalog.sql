-- S3-POKLADNA (17. 10. 2026, pokladna je do 2. 11. 2026 za heslem):
--  1) částečné vratky – k jedné tržbě může být víc vratek, součet hlídá ingest pod zámkem řádku původní tržby
--     (lib/server/sales.ts); unikátní index sales_refund_of_uq (R1.7) nahrazuje obyčejný index pro součet vratek;
--  2) dohledání dokladu podle čísla pro vratku z jiného zařízení (účet + pořadové číslo);
--  3) katalog zboží: kategorie a kód (EAN / PLU / SKU) z importu z jiné pokladny – nové sloupce jsou nullable.
-- Idempotentní (IF EXISTS / IF NOT EXISTS): opakované spuštění nevadí. Tabulky jsou v produkci malé, indexy vzniknou hned.
DROP INDEX IF EXISTS "sales_refund_of_uq";--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN IF NOT EXISTS "ean" varchar(64);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_refund_of_idx" ON "sales" USING btree ("refund_of") WHERE "sales"."refund_of" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_account_seq_idx" ON "sales" USING btree ("account_id","sequence");
