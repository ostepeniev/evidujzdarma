CREATE TABLE "admin_audit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid,
	"email" varchar(254) NOT NULL,
	"page" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"metric" varchar(12) NOT NULL,
	"key" varchar(200) NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"seconds_sum" bigint DEFAULT 0 NOT NULL,
	"seconds_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_day_metric_key_pk" PRIMARY KEY("day","metric","key")
);
--> statement-breakpoint
ALTER TABLE "preregistrations" ADD COLUMN "crm_status" varchar(16) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "preregistrations" ADD COLUMN "crm_note" text;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_created" ON "admin_audit" USING btree ("created_at");