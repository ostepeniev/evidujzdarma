CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"device_id" uuid,
	"register_id" varchar(20) NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"type" varchar(16) NOT NULL,
	"amount" bigint NOT NULL,
	"note" text,
	"staff_id" uuid,
	"staff_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"device_id" uuid,
	"register_id" varchar(20) NOT NULL,
	"number" integer NOT NULL,
	"period_from" timestamp with time zone,
	"closed_at" timestamp with time zone NOT NULL,
	"opening_cash" bigint NOT NULL,
	"expected_cash" bigint NOT NULL,
	"counted_cash" bigint NOT NULL,
	"difference" bigint NOT NULL,
	"cash_out" bigint DEFAULT 0 NOT NULL,
	"closing_cash" bigint NOT NULL,
	"totals" jsonb NOT NULL,
	"denominations" jsonb,
	"note" text,
	"staff_id" uuid,
	"staff_name" text,
	"mode" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "receipt_show_pok" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closings" ADD CONSTRAINT "closings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closings" ADD CONSTRAINT "closings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movements_account_at" ON "cash_movements" USING btree ("account_id","at");--> statement-breakpoint
CREATE INDEX "closings_account_closed" ON "closings" USING btree ("account_id","closed_at");--> statement-breakpoint
CREATE INDEX "closings_device_closed" ON "closings" USING btree ("device_id","closed_at");