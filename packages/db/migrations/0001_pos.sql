CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" varchar(16) DEFAULT 'cashier' NOT NULL,
	"pin_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales" DROP CONSTRAINT "sales_cashier_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "eet_mode" SET DEFAULT 'mock';--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "eic" varchar(12);--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "environment" varchar(16) DEFAULT 'production' NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "sequence_prefix" varchar(12) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "staff_id" uuid;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_account_idx" ON "staff" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN "pin_hash";--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "cashier_user_id";