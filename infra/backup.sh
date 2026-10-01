#!/bin/sh
# Denní záloha PostgreSQL (pg_dump -Fc) se smazáním starších než BACKUP_KEEP_DAYS.
# Zálohy obsahují klíče certifikátů jen v ZAŠIFROVANÉ podobě — MASTER_KEY v záloze NENÍ,
# uchovávejte ho odděleně (správce hesel / trezor). Bez něj nelze certifikáty obnovit.
# Offsite kopie: synchronizujte adresář /backups např. na Hetzner Storage Box (restic / rclone).
set -eu
mkdir -p /backups
echo "[backup] start, uchovávám ${BACKUP_KEEP_DAYS} dní"
while true; do
  ts=$(date +%Y%m%d-%H%M)
  if pg_dump -Fc -f "/backups/evidujzdarma-$ts.dump.tmp"; then
    mv "/backups/evidujzdarma-$ts.dump.tmp" "/backups/evidujzdarma-$ts.dump"
    echo "[backup] OK evidujzdarma-$ts.dump"
  else
    echo "[backup] CHYBA pg_dump" >&2
    rm -f "/backups/evidujzdarma-$ts.dump.tmp"
  fi
  find /backups -name 'evidujzdarma-*.dump' -mtime "+${BACKUP_KEEP_DAYS}" -delete
  sleep 86400
done
