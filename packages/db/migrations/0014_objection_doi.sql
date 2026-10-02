ALTER TABLE "objections" ADD COLUMN "confirm_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "objections" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "objections" ADD COLUMN "digested_at" timestamp with time zone;--> statement-breakpoint
-- Dosavadní námitky dostal provozovatel e-mailem jednotlivě – do denního přehledu je už nezahrnovat.
UPDATE "objections" SET "digested_at" = "created_at" WHERE "digested_at" IS NULL;
