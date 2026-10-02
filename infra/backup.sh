#!/bin/sh
# Denní záloha PostgreSQL: pg_dump -Fc | age → evidujzdarma-<čas>.dump.age (R3.12).
#
# Šifruje se VEŘEJNÝM klíčem age (BACKUP_AGE_RECIPIENT=age1…, víc klíčů oddělte čárkou).
# Soukromý klíč na serveru NENÍ – leží u provozovatele offline. Zálohu na serveru ani offsite
# kopii tak bez něj nikdo nepřečte. Bez příjemce se nezálohuje vůbec: nešifrovaný dump nevznikne.
# MASTER_KEY v záloze také není – klíče certifikátů jsou v DB jen zašifrované.
# Obnova: docs/deploy.md, oddíl „Бекапи“.
#
# Staré zálohy se mažou po BACKUP_KEEP_DAYS dnech, a to jen po úspěšné nové záloze.
# BACKUP_ONCE=1 – jedna záloha a konec (ruční: docker compose run --rm -e BACKUP_ONCE=1 backup).
set -eu

dir="${BACKUP_DIR:-/backups}"
keep="${BACKUP_KEEP_DAYS:-14}"
recipients=""
count=0
for r in $(printf '%s' "${BACKUP_AGE_RECIPIENT:-}" | tr ',' ' '); do
  case "$r" in
    age1?*) recipients="$recipients -r $r"; count=$((count + 1)) ;;
    *)
      echo "[backup] CHYBA: BACKUP_AGE_RECIPIENT smí obsahovat jen veřejné klíče age (age1…), ne soukromý klíč" >&2
      exit 1
      ;;
  esac
done
if [ "$count" -eq 0 ]; then
  echo "[backup] CHYBA: chybí BACKUP_AGE_RECIPIENT – nešifrovanou zálohu nevytvořím (viz docs/deploy.md)" >&2
  exit 1
fi
command -v age >/dev/null 2>&1 || { echo "[backup] CHYBA: chybí program age" >&2; exit 1; }

umask 077
mkdir -p "$dir"

backup_once() {
  ts=$(date +%Y%m%d-%H%M%S)
  out="$dir/evidujzdarma-$ts.dump.age"
  status="$dir/.pg_dump.status"
  rm -f "$status" "$out.tmp"
  # stav pg_dump jde do souboru: POSIX sh nemá pipefail a selhání dumpu se nesmí ztratit
  # shellcheck disable=SC2086 # $recipients jsou ověřené klíče bez mezer
  { if pg_dump -Fc; then echo ok >"$status"; fi; } | age $recipients -o "$out.tmp"
  age_rc=$?
  dump_ok=$(cat "$status" 2>/dev/null || true)
  rm -f "$status"
  if [ "$age_rc" -ne 0 ] || [ "$dump_ok" != ok ]; then
    rm -f "$out.tmp"
    echo "[backup] CHYBA: pg_dump nebo šifrování selhalo, záloha nevznikla" >&2
    return 1
  fi
  if [ "$(head -c 21 "$out.tmp")" != "age-encryption.org/v1" ]; then
    rm -f "$out.tmp"
    echo "[backup] CHYBA: výstup není soubor age, záloha zahozena" >&2
    return 1
  fi
  mv "$out.tmp" "$out"
  echo "[backup] OK $(basename "$out") ($(wc -c <"$out" | tr -d ' ') B)"
}

prune() {
  find "$dir" -name 'evidujzdarma-*.dump.age' -mtime "+$keep" -delete
  # nešifrované zálohy z doby před R3.12 mizí podle stejné lhůty
  find "$dir" -name 'evidujzdarma-*.dump' -mtime "+$keep" -delete
  plain=$(find "$dir" -name 'evidujzdarma-*.dump' | wc -l | tr -d ' ')
  if [ "$plain" -gt 0 ]; then
    echo "[backup] POZOR: $plain nešifrovaných záloh z doby před R3.12 – po ověřené obnově ze šifrované je smažte (docs/deploy.md)" >&2
  fi
}

echo "[backup] start: šifruji pro $count klíč(e) age, uchovávám $keep dní"
while :; do
  ok=0
  if backup_once; then
    prune
  else
    ok=1
  fi
  [ "${BACKUP_ONCE:-0}" = 1 ] && exit "$ok"
  sleep 86400
done
