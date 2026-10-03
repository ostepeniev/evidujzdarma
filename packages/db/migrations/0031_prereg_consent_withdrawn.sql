ALTER TABLE "preregistrations" ALTER COLUMN "confirm_token_issued_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "preregistrations" ALTER COLUMN "locale" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "preregistrations" ADD COLUMN "marketing_consent_withdrawn_at" timestamp with time zone;