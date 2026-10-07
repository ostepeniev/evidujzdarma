-- R9.3 (A3): doklad o odvolaném souhlasu (confirm_token_issued_at i unsubscribed_at NULL) nepatří do unikátnosti e-mailu –
-- adresa po něm založí novou předregistraci a doklad zůstane. Živá předregistrace i záznam-blokace dál nejvýš jednou.
DROP INDEX "prereg_email_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "prereg_email_uq" ON "preregistrations" USING btree (lower("email")) WHERE "preregistrations"."confirm_token_issued_at" is not null or "preregistrations"."unsubscribed_at" is not null;