CREATE TYPE "public"."eet_relevance" AS ENUM('likely', 'possible', 'unlikely');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'premium', 'partner');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'cashier', 'accountant');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('queued', 'sending', 'confirmed', 'failed', 'rejected', 'test');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('provozovna', 'web', 'vozidlo', 'mimo_provozovnu', 'jine');--> statement-breakpoint
CREATE TABLE "accountant_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountant_account_id" uuid NOT NULL,
	"ico" varchar(8) NOT NULL,
	"label" text,
	"client_account_id" uuid,
	"invite_token" varchar(64),
	"invited_at" timestamp with time zone,
	"manual_status" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(16) DEFAULT 'business' NOT NULL,
	"name" text NOT NULL,
	"ico" varchar(8),
	"dic" varchar(14),
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"plan_valid_until" timestamp with time zone,
	"receipt_header" text,
	"receipt_footer" text,
	"vat_payer" boolean DEFAULT false NOT NULL,
	"iban" varchar(34),
	"eet_mode" varchar(16) DEFAULT 'test' NOT NULL,
	"referred_by_accountant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ares_cache" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" bigint NOT NULL,
	"vat_rate" smallint DEFAULT 0 NOT NULL,
	"color" varchar(16),
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"serial_number" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"storage" varchar(16) DEFAULT 'server' NOT NULL,
	"encrypted_key" "bytea",
	"encrypted_dek" "bytea",
	"key_version" varchar(32),
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"unit_id" uuid,
	"name" text NOT NULL,
	"register_id" varchar(20) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" varchar(254) NOT NULL,
	"template" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(128),
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "unit_type" NOT NULL,
	"label" text NOT NULL,
	"external_id" varchar(32),
	"icp" varchar(10),
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firm_establishments" (
	"icp" varchar(12) PRIMARY KEY NOT NULL,
	"ico" varchar(8) NOT NULL,
	"name" text,
	"slug" varchar(96) NOT NULL,
	"street" text,
	"city" text,
	"city_code" integer,
	"postal_code" varchar(5),
	"region_code" smallint,
	"lat" double precision,
	"lng" double precision,
	"trades" text[] DEFAULT '{}'::text[] NOT NULL,
	"eet_relevance" "eet_relevance" DEFAULT 'possible' NOT NULL,
	"started_at" date,
	"ended_at" date,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"ico" varchar(8) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(96) NOT NULL,
	"legal_form" varchar(4),
	"is_natural_person" boolean DEFAULT false NOT NULL,
	"dic" varchar(14),
	"vat_payer" boolean DEFAULT false NOT NULL,
	"founded_at" date,
	"dissolved_at" date,
	"ares_updated_at" date,
	"street" text,
	"city" text,
	"city_code" integer,
	"postal_code" varchar(5),
	"region_code" smallint,
	"nace" text[] DEFAULT '{}'::text[] NOT NULL,
	"eet_relevance" "eet_relevance" DEFAULT 'possible' NOT NULL,
	"establishments_count" integer DEFAULT 0 NOT NULL,
	"claimed_account_id" uuid,
	"profile" jsonb,
	"noindex" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"redirect_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"display_name" text,
	"pin_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_account_id_user_id_pk" PRIMARY KEY("account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "objections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ico" varchar(8),
	"icp" varchar(12),
	"name" text NOT NULL,
	"email" varchar(254) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preregistrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"ico" varchar(8),
	"company_name" text,
	"industry" text,
	"establishments_count" smallint,
	"needs" text[] DEFAULT '{}'::text[] NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent_at" timestamp with time zone,
	"consent_evidence" text,
	"referral_code" varchar(12) NOT NULL,
	"referred_by" varchar(12),
	"confirm_token" varchar(64) NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribe_token" varchar(64) NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"locale" varchar(5) DEFAULT 'cs' NOT NULL,
	"utm" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"unit_id" uuid,
	"cashier_user_id" uuid,
	"sequence" varchar(25) NOT NULL,
	"sold_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total" bigint NOT NULL,
	"tip" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"payments" jsonb NOT NULL,
	"items" jsonb,
	"vat_breakdown" jsonb,
	"refund_of" uuid,
	"status" "sale_status" DEFAULT 'queued' NOT NULL,
	"mode" varchar(16) DEFAULT 'test' NOT NULL,
	"confirmation_code" varchar(64),
	"security_code" varchar(64),
	"signature" text,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"deadline_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" text,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accountant_clients" ADD CONSTRAINT "accountant_clients_accountant_account_id_accounts_id_fk" FOREIGN KEY ("accountant_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountant_clients" ADD CONSTRAINT "accountant_clients_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_unit_id_evidence_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."evidence_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_units" ADD CONSTRAINT "evidence_units_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_establishments" ADD CONSTRAINT "firm_establishments_ico_firms_ico_fk" FOREIGN KEY ("ico") REFERENCES "public"."firms"("ico") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_unit_id_evidence_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."evidence_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_user_id_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acc_clients_uq" ON "accountant_clients" USING btree ("accountant_account_id","ico");--> statement-breakpoint
CREATE INDEX "accounts_ico_idx" ON "accounts" USING btree ("ico");--> statement-breakpoint
CREATE INDEX "catalog_account_idx" ON "catalog_items" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "certs_account_idx" ON "certificates" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_token_uq" ON "devices" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_register_uq" ON "devices" USING btree ("account_id","register_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_dedupe_uq" ON "email_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "email_queue_idx" ON "email_outbox" USING btree ("status","send_after");--> statement-breakpoint
CREATE INDEX "units_account_idx" ON "evidence_units" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "est_ico_idx" ON "firm_establishments" USING btree ("ico");--> statement-breakpoint
CREATE INDEX "est_city_idx" ON "firm_establishments" USING btree ("city_code");--> statement-breakpoint
CREATE INDEX "firms_city_idx" ON "firms" USING btree ("city_code");--> statement-breakpoint
CREATE INDEX "firms_region_idx" ON "firms" USING btree ("region_code");--> statement-breakpoint
CREATE INDEX "firms_founded_idx" ON "firms" USING btree ("founded_at");--> statement-breakpoint
CREATE INDEX "firms_nace_gin" ON "firms" USING gin ("nace");--> statement-breakpoint
CREATE INDEX "firms_name_trgm" ON "firms" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "login_tokens_email_idx" ON "login_tokens" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "prereg_email_uq" ON "preregistrations" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "prereg_referral_uq" ON "preregistrations" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "prereg_referred_by_idx" ON "preregistrations" USING btree ("referred_by");--> statement-breakpoint
CREATE INDEX "prereg_created_idx" ON "preregistrations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_device_seq_uq" ON "sales" USING btree ("device_id","sequence");--> statement-breakpoint
CREATE INDEX "sales_account_sold_idx" ON "sales" USING btree ("account_id","sold_at");--> statement-breakpoint
CREATE INDEX "sales_pending_idx" ON "sales" USING btree ("status","deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));