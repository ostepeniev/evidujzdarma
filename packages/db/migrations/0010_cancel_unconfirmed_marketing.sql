-- Р5: e-maily k termínům (dis-launch, app-ready) zařazené před zavedením kontroly při odeslání
-- se zruší pro nepotvrzené nebo odhlášené adresy. Nic se nemaže, jen status 'cancelled'.
UPDATE "email_outbox" o SET "status" = 'cancelled', "last_error" = 'UNCONFIRMED'
FROM "preregistrations" p
WHERE lower(p."email") = lower(o."to")
  AND o."status" = 'queued'
  AND o."template" IN ('dis-launch', 'app-ready')
  AND (p."confirmed_at" IS NULL OR p."unsubscribed_at" IS NOT NULL);
