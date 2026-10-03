CREATE TABLE "preregistration_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preregistration_id" uuid NOT NULL,
	"campaign" varchar(40) NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirm_token_hash" varchar(64)
);
--> statement-breakpoint
ALTER TABLE "preregistration_interests" ADD CONSTRAINT "preregistration_interests_preregistration_id_preregistrations_id_fk" FOREIGN KEY ("preregistration_id") REFERENCES "public"."preregistrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prereg_interest_uq" ON "preregistration_interests" USING btree ("preregistration_id","campaign");--> statement-breakpoint
CREATE INDEX "prereg_interest_token_idx" ON "preregistration_interests" USING btree ("confirm_token_hash");