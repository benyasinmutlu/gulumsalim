#!/usr/bin/env bash
# PostgreSQL custom-format yedeği. Dump yalnız pg_restore liste kontrolü
# geçtikten sonra atomik olarak görünür olur; aynı anda iki yedek çalışmaz.
set -Eeuo pipefail

BACKUP_ROOT=${BACKUP_ROOT:-/opt/gulumsalim}
ENV_FILE=${ENV_FILE:-$BACKUP_ROOT/app/apps/api/.env}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}

if [[ "$BACKUP_ROOT" != /* || "$BACKUP_ROOT" == "/" ]]; then
  echo "BACKUP_ROOT güvenli bir mutlak dizin olmalı" >&2
  exit 2
fi
if ! [[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]{0,2}$ ]]; then
  echo "BACKUP_RETENTION_DAYS 1-999 arasında tam sayı olmalı" >&2
  exit 2
fi
test -f "$ENV_FILE"
for command in pg_dump pg_restore flock realpath sha256sum python3 base64; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Yedek için gerekli komut bulunamadı: $command" >&2
    exit 2
  }
done

ROOT=$(realpath -m -- "$BACKUP_ROOT")
BACKUP_DIR="$ROOT/backups"
case "$BACKUP_DIR" in
  "$ROOT"/backups) ;;
  *) echo "Güvensiz yedek dizini: $BACKUP_DIR" >&2; exit 2 ;;
esac

# .env dosyasını shell olarak source etmiyoruz. Yalnız DATABASE_URL okunur;
# parola URL'nin komut satırında görünmemesi için ayrılır. Güvenli URL pg_dump
# argümanı olur, parola yalnız kısa ömürlü child-process ortamına verilir.
mapfile -t CONNECTION_PARTS < <(python3 - "$ENV_FILE" <<'PYTHON'
import base64
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit, urlunsplit

content = Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r"^\s*DATABASE_URL\s*=\s*(.*?)\s*$", content, re.MULTILINE)
if not match:
    raise SystemExit(2)
value = match.group(1)
if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
    value = value[1:-1]

try:
    url = urlsplit(value)
    port = url.port
except ValueError:
    raise SystemExit(2)
if url.scheme not in {"postgres", "postgresql"} or not url.hostname:
    raise SystemExit(2)

password = unquote(url.password or "")
query = []
for key, item in parse_qsl(url.query, keep_blank_values=True):
    if key == "password":
        if not password:
            password = item
    else:
        query.append((key, item))

host = url.hostname
if ":" in host and not host.startswith("["):
    host = f"[{host}]"
netloc = host
if url.username is not None:
    netloc = f"{quote(unquote(url.username), safe='')}@{netloc}"
if port is not None:
    netloc = f"{netloc}:{port}"
safe_url = urlunsplit((url.scheme, netloc, url.path, urlencode(query), url.fragment))

print(base64.b64encode(safe_url.encode()).decode())
print(base64.b64encode(password.encode()).decode())
PYTHON
)
if [[ ${#CONNECTION_PARTS[@]} -ne 2 || -z "${CONNECTION_PARTS[0]}" ]]; then
  echo "ENV_FILE içindeki DATABASE_URL geçerli bir PostgreSQL URL'si değil" >&2
  exit 2
fi
SAFE_DATABASE_URL=$(printf '%s' "${CONNECTION_PARTS[0]}" | base64 --decode)
DB_PASSWORD=$(printf '%s' "${CONNECTION_PARTS[1]}" | base64 --decode)

umask 077
install -d -m 700 -- "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then
  echo "Başka bir veritabanı yedeği halen çalışıyor" >&2
  exit 3
fi

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FINAL="$BACKUP_DIR/gulumsalim-$STAMP-$$.dump"
TEMP="$BACKUP_DIR/.gulumsalim-$STAMP-$$.dump.tmp"
LIST_TEMP="$BACKUP_DIR/.gulumsalim-$STAMP-$$.list.tmp"

cleanup() {
  rm -f -- "$TEMP" "$LIST_TEMP"
}
trap cleanup EXIT INT TERM

# Komut satırındaki bağlantı URL'si parola içermez. Parola yalnız pg_dump
# process ortamında tutulur ve betik tamamlandığında shell değişkeni silinir.
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --dbname="$SAFE_DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --file="$TEMP"
unset DB_PASSWORD CONNECTION_PARTS

test -s "$TEMP"
pg_restore --list "$TEMP" > "$LIST_TEMP"
test -s "$LIST_TEMP"
mv -- "$TEMP" "$FINAL"
sha256sum "$FINAL" > "$FINAL.sha256"
chmod 600 -- "$FINAL" "$FINAL.sha256"

# Yalnız doğrulanmış dump ve checksum adlarını, yalnız doğrulanmış backup
# dizininin doğrudan altında döndürürüz.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type f \
  \( -name 'gulumsalim-*.dump' -o -name 'gulumsalim-*.dump.sha256' \) \
  -mtime "+$BACKUP_RETENTION_DAYS" -delete

trap - EXIT INT TERM
rm -f -- "$LIST_TEMP"
printf 'backup=%s status=verified retention_days=%s\n' "$FINAL" "$BACKUP_RETENTION_DAYS"
