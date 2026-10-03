-- Д3-5: odeslané / zrušené / definitivně neúspěšné e-maily už nepotřebují jednorázová tajemství v payloadu
-- (token potvrzení předregistrace, přihlašovací odkaz). Nové řádky čistí processOutbox; tady jen staré.
UPDATE "email_outbox" SET "payload" = "payload" - 'confirmToken' WHERE "template" = 'prereg-confirm' AND "status" IN ('sent', 'cancelled', 'failed') AND "payload" ? 'confirmToken';--> statement-breakpoint
UPDATE "email_outbox" SET "payload" = "payload" - 'url' WHERE "template" = 'login-link' AND "status" IN ('sent', 'cancelled', 'failed') AND "payload" ? 'url';
