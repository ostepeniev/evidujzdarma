ALTER TABLE "sales" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_approved_by_staff_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_refund_of_uq" ON "sales" USING btree ("refund_of") WHERE "sales"."refund_of" is not null;