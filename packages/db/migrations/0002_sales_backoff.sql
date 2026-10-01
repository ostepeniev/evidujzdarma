DROP INDEX "sales_pending_idx";--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "sales_pending_idx" ON "sales" USING btree ("status","next_attempt_at");