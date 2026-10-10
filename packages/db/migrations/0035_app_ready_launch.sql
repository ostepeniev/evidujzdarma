-- R17.1: pokladna se spouští 2. 11. 2026 (ne 1. 12.). Už zařazené e-maily „Pokladna je připravena“ (app-ready)
-- naplánované na pozdější čas se přesunou na den spuštění v 8:00 Praha; dokud je /pokladna zavřená, aplikace je jen odkládá.
UPDATE "email_outbox"
SET "send_after" = TIMESTAMPTZ '2026-11-02 08:00:00+01'
WHERE "template" = 'app-ready'
  AND "status" = 'queued'
  AND "send_after" > TIMESTAMPTZ '2026-11-02 08:00:00+01';
