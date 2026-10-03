-- R7.5 (doplněk Д3-5): odeslané / zrušené / definitivně neúspěšné e-maily „notice“ s odkazem na potvrzení
-- námitky už token nepotřebují. Nové řádky čistí processOutbox; tady jen staré.
UPDATE "email_outbox"
SET "payload" = jsonb_set("payload", '{url}', to_jsonb(regexp_replace("payload"->>'url', '([?&])token=[^&#]*', '\1', 'g')))
WHERE "template" = 'notice' AND "status" IN ('sent', 'cancelled', 'failed') AND "payload"->>'url' ~ '[?&]token=';
