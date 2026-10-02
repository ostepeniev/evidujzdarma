ALTER TABLE "accountant_clients" ADD COLUMN "invite_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "accountant_clients" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
-- Dosavadní pozvánky: token se nahradí jeho SHA-256 a dostane platnost 14 dní od vytvoření.
UPDATE "accountant_clients" SET "invite_token_hash" = encode(sha256(convert_to("invite_token", 'UTF8')), 'hex'), "invite_expires_at" = coalesce("invited_at", now()) + interval '14 days' WHERE "invite_token" IS NOT NULL;
