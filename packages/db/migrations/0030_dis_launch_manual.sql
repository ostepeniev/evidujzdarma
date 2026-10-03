-- R7.6: e-mail ke spuštění DIS+ (dis-launch) tvrdí fakt o FS – už se neplánuje automaticky na 1. 11., ale spouští
-- ho ručně provozovatel (POST /api/internal/dis-launch). Dříve naplánované a neodeslané řádky odstraníme,
-- aby neodešly samy a nový ruční běh je mohl zařadit znovu (stejný dedupe_key).
DELETE FROM "email_outbox" WHERE "template" = 'dis-launch' AND "status" = 'queued';
