-- S8 (30. 10. 2026): EET API pro partnery v1 (docs/tasks/2026-10-30-S8-partner-api.md, rozd. 1).
--  Integrace = řádek devices s kind = 'integration' + řádek integrations s oprávněními; tržby z API jsou běžné řádky sales
--  (nové sloupce integration_id a external_ref jsou nullable). Nové tabulky jsou prázdné.
--  Data, která už jsou: všechna zařízení dostanou kind = 'pos' (výchozí hodnota sloupce), tržby integration_id = null.
CREATE TYPE "public"."device_kind" AS ENUM('pos', 'integration');--> statement-breakpoint
CREATE TYPE "public"."integration_environment" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "api_rate_windows" (
	"integration_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_windows_integration_id_window_start_pk" PRIMARY KEY("integration_id","window_start")
);
--> statement-breakpoint
CREATE TABLE "api_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"integration_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" varchar(8) NOT NULL,
	"route" varchar(64) NOT NULL,
	"status" smallint NOT NULL,
	"duration_ms" integer NOT NULL,
	"error_code" varchar(40),
	"request_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_sale_keys" (
	"sale_id" uuid PRIMARY KEY NOT NULL,
	"integration_id" uuid NOT NULL,
	"body_hash" varchar(64) NOT NULL,
	"sequence" varchar(25) NOT NULL,
	"external_ref" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"integration_id" uuid NOT NULL,
	"date" date NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"sales_accepted" integer DEFAULT 0 NOT NULL,
	"active_units" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_daily_integration_id_date_pk" PRIMARY KEY("integration_id","date")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"name" text NOT NULL,
	"partner_app_id" uuid,
	"environment" "integration_environment" NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"unit_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"next_sequence" bigint DEFAULT 1 NOT NULL,
	"token_prefix" varchar(16) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code_hash" varchar(64) PRIMARY KEY NOT NULL,
	"partner_app_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"unit_ids" uuid[] NOT NULL,
	"environment" "integration_environment" NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"integration_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_id" varchar(64) NOT NULL,
	"client_secret_hash" varchar(64) NOT NULL,
	"redirect_uris" text[] DEFAULT '{}'::text[] NOT NULL,
	"logo_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event" varchar(40) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" varchar(120),
	"last_http_status" smallint,
	"last_error" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret_enc" "bytea" NOT NULL,
	"secret_dek" "bytea" NOT NULL,
	"secret_key_version" varchar(32) NOT NULL,
	"events" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failing_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "kind" "device_kind" DEFAULT 'pos' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "integration_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "external_ref" varchar(64);--> statement-breakpoint
ALTER TABLE "api_rate_windows" ADD CONSTRAINT "api_rate_windows_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_sale_keys" ADD CONSTRAINT "api_sale_keys_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_partner_app_id_partner_apps_id_fk" FOREIGN KEY ("partner_app_id") REFERENCES "public"."partner_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_partner_app_id_partner_apps_id_fk" FOREIGN KEY ("partner_app_id") REFERENCES "public"."partner_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_requests_integration_at" ON "api_requests" USING btree ("integration_id","at");--> statement-breakpoint
CREATE INDEX "api_requests_at" ON "api_requests" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_sale_keys_ref_uq" ON "api_sale_keys" USING btree ("integration_id","external_ref") WHERE "api_sale_keys"."external_ref" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_device_uq" ON "integrations" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "integrations_account_idx" ON "integrations" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_apps_client_uq" ON "partner_apps" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_dedupe_uq" ON "webhook_deliveries" USING btree ("endpoint_id","dedupe_key") WHERE "webhook_deliveries"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "webhook_endpoints_integration" ON "webhook_endpoints" USING btree ("integration_id");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_integration_ref_uq" ON "sales" USING btree ("integration_id","external_ref") WHERE "sales"."external_ref" is not null;--> statement-breakpoint
CREATE INDEX "sales_integration_sold_idx" ON "sales" USING btree ("integration_id","sold_at") WHERE "sales"."integration_id" is not null;