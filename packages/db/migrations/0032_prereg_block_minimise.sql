-- R8.2 (Д-6): záznam-blokace (zrušená předregistrace) drží jen e-mail, datum předregistrace, datum zrušení a hash
-- odhlašovacího tokenu (a doklad souhlasu, byl-li udělen) – bez data potvrzovacího odkazu a jazyka.
UPDATE "preregistrations" SET "confirm_token_issued_at" = NULL, "locale" = NULL
WHERE "unsubscribed_at" IS NOT NULL;--> statement-breakpoint
-- Dřívější odhlášení odvolalo i souhlas (R7.3) – doklad odvolání = datum odhlášení.
UPDATE "preregistrations" SET "marketing_consent_withdrawn_at" = "unsubscribed_at"
WHERE "unsubscribed_at" IS NOT NULL AND "marketing_consent_at" IS NOT NULL AND "marketing_consent_withdrawn_at" IS NULL;
