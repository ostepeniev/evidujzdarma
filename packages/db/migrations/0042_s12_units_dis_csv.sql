-- S12 (22. 11. 2026): údaje evidenční jednotky pro hromadný import do DIS+ (CSV podle GFŘ, 3. 11. 2026) – CZ-NACE,
--  kód adresního místa RÚIAN, lokalizace volným textem, druh dopravního prostředku a jeho upřesnění, příznak nepřímého
--  zastoupení. Data, která už jsou: nové sloupce null, nepřímé zastoupení false (vlastník doplní v nastavení).
ALTER TABLE "evidence_units" ADD COLUMN "cz_nace" varchar(6);--> statement-breakpoint
ALTER TABLE "evidence_units" ADD COLUMN "ruian_code" varchar(9);--> statement-breakpoint
ALTER TABLE "evidence_units" ADD COLUMN "location_text" varchar(255);--> statement-breakpoint
ALTER TABLE "evidence_units" ADD COLUMN "vehicle_type" varchar(1);--> statement-breakpoint
ALTER TABLE "evidence_units" ADD COLUMN "vehicle_note" varchar(150);--> statement-breakpoint
ALTER TABLE "evidence_units" ADD COLUMN "indirect_representation" boolean DEFAULT false NOT NULL;