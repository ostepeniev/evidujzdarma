-- S3 (katalog firem otevřený): seznamy kraje, obce a obor × obec ukazují jmenovitě jen právnické osoby (OSVČ jen počtem,
-- LIA – docs/LIA-katalog-firem.md). Stránkování podle názvu jde po částečných indexech bez řazení celé obce/kraje.
-- Migrace běží v transakci (drizzle migrator), proto ne CONCURRENTLY; tabulka firms má v produkci ~80 tis. řádků
-- (kraj 51), index se postaví za zlomek sekundy. IF NOT EXISTS: opakované spuštění nevadí.
CREATE INDEX IF NOT EXISTS "firms_listable_legal_region_name" ON "firms" USING btree ("region_code","name") WHERE "firms"."noindex" = false and "firms"."dissolved_at" is null and "firms"."is_natural_person" = false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "firms_listable_legal_city_name" ON "firms" USING btree ("city_code","name") WHERE "firms"."noindex" = false and "firms"."dissolved_at" is null and "firms"."is_natural_person" = false;
