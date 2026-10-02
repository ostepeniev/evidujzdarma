ALTER TABLE "preregistrations" ALTER COLUMN "confirm_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "preregistrations" ALTER COLUMN "unsubscribe_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "preregistrations" ADD COLUMN "confirm_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "preregistrations" ADD COLUMN "confirm_token_issued_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "preregistrations" ADD COLUMN "unsubscribe_token_hash" varchar(64);--> statement-breakpoint
CREATE INDEX "prereg_confirm_hash_idx" ON "preregistrations" USING btree ("confirm_token_hash");--> statement-breakpoint
CREATE INDEX "prereg_unsub_hash_idx" ON "preregistrations" USING btree ("unsubscribe_token_hash");--> statement-breakpoint
-- B Дрібне 9: existující tokeny se převedou na SHA-256 (hex z UTF-8, stejně jako tokens.ts sha256); odkazy
-- v už odeslaných e-mailech tak dál fungují. Potvrzovací odkaz se počítá od registrace.
UPDATE "preregistrations" SET
  "confirm_token_hash" = encode(sha256(convert_to("confirm_token", 'UTF8')), 'hex'),
  "unsubscribe_token_hash" = encode(sha256(convert_to("unsubscribe_token", 'UTF8')), 'hex'),
  "confirm_token_issued_at" = "created_at"
WHERE "confirm_token" IS NOT NULL;
