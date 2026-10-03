-- R7.3: odhlášení neprodlužuje uchování předregistrace. Starší odhlášené záznamy: ponechat jen adresu a datum
-- odhlášení, u udělaného souhlasu navíc jeho doklad. Povinné sloupce dostanou náhodné hodnoty, které nikam nevedou.
UPDATE "preregistrations" SET
  "ico" = NULL,
  "company_name" = NULL,
  "industry" = NULL,
  "establishments_count" = NULL,
  "needs" = '{}'::text[],
  "utm" = NULL,
  "referred_by" = NULL,
  "referral_code" = 'u' || substr(md5(random()::text || "id"::text), 1, 11),
  "confirm_token_hash" = md5(random()::text || "id"::text) || md5("id"::text || random()::text)
WHERE "unsubscribed_at" IS NOT NULL;--> statement-breakpoint
UPDATE "preregistrations" SET "confirmed_at" = NULL, "consent_evidence" = NULL
WHERE "unsubscribed_at" IS NOT NULL AND "marketing_consent_at" IS NULL;
