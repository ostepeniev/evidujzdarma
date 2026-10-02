ALTER TABLE "sale_attempts" ALTER COLUMN "attempt" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "attempts" SET DATA TYPE integer;