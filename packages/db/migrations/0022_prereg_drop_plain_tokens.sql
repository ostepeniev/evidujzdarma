ALTER TABLE "preregistrations" ALTER COLUMN "confirm_token_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "preregistrations" DROP COLUMN "confirm_token";--> statement-breakpoint
ALTER TABLE "preregistrations" DROP COLUMN "unsubscribe_token";