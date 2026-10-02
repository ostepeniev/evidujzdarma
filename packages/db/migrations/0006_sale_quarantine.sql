CREATE TABLE "sale_quarantine" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"device_id" uuid,
	"payload" jsonb NOT NULL,
	"reason_code" varchar(32) NOT NULL,
	"reason" text NOT NULL,
	"attempts" smallint DEFAULT 1 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution" varchar(16),
	"resolved_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "sale_quarantine" ADD CONSTRAINT "sale_quarantine_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_quarantine" ADD CONSTRAINT "sale_quarantine_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_quarantine_open" ON "sale_quarantine" USING btree ("account_id","resolved_at");