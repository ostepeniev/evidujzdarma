-- S11 (3. 11. 2026): účetní a doporučená nastavení. Nová tabulka service_orders (poptávky z /nastaveni-na-klic, dřív jen
--  e-mail provozovateli) se stavem zadano | v_reseni | hotovo | zruseno a kódem doporučující kanceláře; accounts.partner_code
--  (stálý kód účetní kanceláře, nullable, unikátní). Data, která už jsou: tabulka prázdná, partner_code null (doplní se
--  při prvním otevření kabinetu).
CREATE TABLE "service_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package" varchar(16) NOT NULL,
	"email" varchar(254) NOT NULL,
	"ico" varchar(8),
	"company_name" text,
	"establishments" smallint,
	"referrer_account_id" uuid,
	"ref_code" varchar(12),
	"status" varchar(16) DEFAULT 'zadano' NOT NULL,
	"status_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "partner_code" varchar(12);--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_referrer_account_id_accounts_id_fk" FOREIGN KEY ("referrer_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_orders_referrer_idx" ON "service_orders" USING btree ("referrer_account_id","created_at");--> statement-breakpoint
CREATE INDEX "service_orders_created_idx" ON "service_orders" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_partner_code_uq" ON "accounts" USING btree ("partner_code") WHERE "accounts"."partner_code" is not null;