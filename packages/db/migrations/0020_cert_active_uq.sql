ALTER TABLE "certificates" ADD COLUMN "aad_version" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Д-4: případné duplicitní aktivní certifikáty (souběžný import) – platí nejnovější, starší se revokují
UPDATE "certificates" c SET "revoked_at" = now()
WHERE c."revoked_at" IS NULL AND EXISTS (
  SELECT 1 FROM "certificates" d
  WHERE d."account_id" = c."account_id" AND d."environment" = c."environment" AND d."revoked_at" IS NULL
    AND (d."created_at" > c."created_at" OR (d."created_at" = c."created_at" AND d."id" > c."id"))
);--> statement-breakpoint
CREATE UNIQUE INDEX "certs_active_uq" ON "certificates" USING btree ("account_id","environment") WHERE "certificates"."revoked_at" is null;