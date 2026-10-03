-- R7.4: zájem ze starších předregistrací. Formulář webináře posílal utm_source=ucetni a utm_campaign
-- (webinar-…, kabinet); ostatní předregistrace jsou k pokladně. Potvrzení zájmu = potvrzení e-mailu (DOI).
INSERT INTO "preregistration_interests" ("preregistration_id", "campaign", "requested_at", "confirmed_at")
SELECT "id",
  CASE WHEN "utm"->>'utm_source' = 'ucetni' THEN (CASE WHEN "utm"->>'utm_campaign' = 'kabinet' THEN 'kabinet' ELSE 'webinar' END) ELSE 'pokladna' END,
  "created_at", "confirmed_at"
FROM "preregistrations"
WHERE "unsubscribed_at" IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- „Pokladna je připravena“ jen předregistraci k pokladně – webinář/kabinet ji nedostane (Z3)
UPDATE "email_outbox" SET "status" = 'cancelled', "last_error" = 'NOT_POKLADNA_INTEREST'
WHERE "template" = 'app-ready' AND "status" = 'queued'
  AND lower("to") IN (SELECT lower("email") FROM "preregistrations" WHERE "utm"->>'utm_source' = 'ucetni');
