CREATE TABLE "sale_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sale_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sale_id" uuid NOT NULL,
	"attempt" smallint NOT NULL,
	"environment" varchar(16) NOT NULL,
	"message_uuid" uuid,
	"first_attempt" boolean NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" varchar(16) NOT NULL,
	"code" varchar(32),
	"message" text,
	"pok" varchar(39),
	"received_at" timestamp with time zone,
	"http_status" smallint,
	"request_sha256" varchar(64),
	"response_body" text
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "claim_token" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "blocked_reason" varchar(32);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "eet_data" jsonb;--> statement-breakpoint
ALTER TABLE "sale_attempts" ADD CONSTRAINT "sale_attempts_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_attempts_sale" ON "sale_attempts" USING btree ("sale_id","attempt");--> statement-breakpoint
-- Tržby, které dřív skončily jako „rejected“ jen kvůli certifikátu (PREPARE), se vrací do fronty jako zablokované.
UPDATE "sales" SET "status" = 'queued', "blocked_reason" = 'PREPARE', "next_attempt_at" = now() WHERE "status" = 'rejected' AND "last_error" LIKE 'PREPARE:%';
