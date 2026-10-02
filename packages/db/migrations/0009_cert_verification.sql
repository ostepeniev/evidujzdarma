ALTER TABLE "certificates" ADD COLUMN "issuer" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "verified_at" timestamp with time zone;