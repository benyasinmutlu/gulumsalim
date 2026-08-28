#!/usr/bin/env bash
# Atomik release deploy'u. Aktif release'in üstüne yazmaz; yeni release'i
# tamamen hazırlar, DB yedeğini alır, migration'ı uygular ve health-check
# sonrasında `app` symlink'ini değiştirir. Başarısızlıkta önceki release'e döner.
#
# Kullanım: ./infra/scripts/deploy.sh
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

SERVER="${SERVER:-root@128.140.120.121}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/gulumsalim}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
PREPARE_ONLY="${PREPARE_ONLY:-0}"
ARTIFACT_OUT="${ARTIFACT_OUT:-}"

if ! [[ "$KEEP_RELEASES" =~ ^[2-9][0-9]*$ ]]; then
  echo "KEEP_RELEASES en az 2 olan bir tam sayı olmalı" >&2
  exit 2
fi

if [[ "$PREPARE_ONLY" != "0" && "$PREPARE_ONLY" != "1" ]]; then
  echo "PREPARE_ONLY yalnızca 0 veya 1 olabilir" >&2
  exit 2
fi

REVISION=$(git rev-parse --short HEAD 2>/dev/null || printf 'artifact')
RELEASE_ID="${REVISION}-$(date -u +%Y%m%d%H%M%S)"
LOCAL_ARCHIVE="/tmp/gulumsalim-deploy-${RELEASE_ID}.tar.gz"
REMOTE_ARCHIVE="/tmp/gulumsalim-deploy-${RELEASE_ID}.tar.gz"
ARCHIVE_LIST="/tmp/gulumsalim-deploy-${RELEASE_ID}.files"

cleanup_local() {
  rm -f -- "$LOCAL_ARCHIVE" "$ARCHIVE_LIST"
}
trap cleanup_local EXIT

echo "==> ${RELEASE_ID} artefaktı hazırlanıyor..."
# Bu repo bazı makinelerde başka bir çalışma ağacının içinde bulunabiliyor.
# Yalnızca bu kanonik dizinin içeriğini paketliyoruz; mevcut .bak-* dosyaları
# özellikle korunur. Runtime/env ve yeniden üretilebilir klasörler dışarıda.
tar --exclude='node_modules' --exclude='.git' --exclude='.next' \
    --exclude='.turbo' --exclude='coverage' --exclude='dist' \
    --exclude='uploads' --exclude='.claude' --exclude='.config' \
    --exclude='audit' --exclude='tmp' --exclude='output' --exclude='*.tsbuildinfo' \
    --exclude='.env' --exclude='.env.local' \
    --exclude='services/discovery/discovery' \
    -czf "$LOCAL_ARCHIVE" .

# Bozuk/eksik bir paket sunucuya ulaşmadan önce yerelde durdurulsun. Bilinen
# runtime secret'ları zaten dışlanıyor; ayrıca yanlışlıkla eklenmiş başka bir
# .env varyantı varsa güvenli tarafta kalıp deploy'u reddediyoruz.
tar -tzf "$LOCAL_ARCHIVE" > "$ARCHIVE_LIST"
for required in \
  './package.json' \
  './pnpm-lock.yaml' \
  './apps/api/package.json' \
  './apps/web/package.json' \
  './services/discovery/go.mod' \
  './infra/scripts/backup-db.sh' \
  './infra/scripts/smoke-prod.sh' \
  './infra/postgres/migrations/meta/_journal.json'; do
  if ! grep -Fxq -- "$required" "$ARCHIVE_LIST"; then
    echo "Artefakt zorunlu dosyayı içermiyor: $required" >&2
    exit 2
  fi
done

while IFS= read -r entry; do
  normalized=${entry#./}
  basename=${normalized##*/}
  case "/$normalized/" in
    */../*|*/./*)
      echo "Artefaktta güvensiz yol bulundu: $entry" >&2
      exit 2
      ;;
  esac
  case "$basename" in
    .env|.env.*)
      if [[ "$basename" != *.example ]]; then
        echo "Artefaktta secret olabilecek env dosyası bulundu: $entry" >&2
        exit 2
      fi
      ;;
  esac
done < "$ARCHIVE_LIST"

if grep -Eq '(^|/)(node_modules|\.git|\.next|\.turbo|coverage|dist|uploads|tmp|output)(/|$)' "$ARCHIVE_LIST"; then
  echo "Artefaktta yeniden üretilebilir veya VCS klasörü bulundu" >&2
  exit 2
fi

if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM=$(sha256sum "$LOCAL_ARCHIVE" | awk '{print $1}')
else
  CHECKSUM=$(shasum -a 256 "$LOCAL_ARCHIVE" | awk '{print $1}')
fi

FILE_COUNT=$(wc -l < "$ARCHIVE_LIST" | tr -d ' ')
ARCHIVE_SIZE=$(wc -c < "$LOCAL_ARCHIVE" | tr -d ' ')
echo "==> Artefakt doğrulandı: sha256=${CHECKSUM} dosya=${FILE_COUNT} byte=${ARCHIVE_SIZE}"

if [[ "$PREPARE_ONLY" == "1" ]]; then
  if [[ -n "$ARTIFACT_OUT" ]]; then
    install -m 600 "$LOCAL_ARCHIVE" "$ARTIFACT_OUT"
    echo "==> Doğrulanmış artefakt kaydedildi: $ARTIFACT_OUT"
  else
    echo "==> PREPARE_ONLY=1: sunucuya bağlantı kurulmadı"
  fi
  exit 0
fi

echo "==> Artefakt sunucuya yükleniyor..."
scp "$LOCAL_ARCHIVE" "$SERVER:$REMOTE_ARCHIVE"

echo "==> Yeni release hazırlanıyor ve atomik olarak açılıyor..."
ssh "$SERVER" bash -s -- "$RELEASE_ID" "$CHECKSUM" "$KEEP_RELEASES" "$REMOTE_ROOT" <<'REMOTE'
set -Eeuo pipefail

RELEASE_ID=$1
EXPECTED_CHECKSUM=$2
KEEP_RELEASES=$3
ROOT=$4
CURRENT="$ROOT/app"
RELEASES="$ROOT/releases"
RELEASE="$RELEASES/$RELEASE_ID"
ARCHIVE="/tmp/gulumsalim-deploy-${RELEASE_ID}.tar.gz"
NEXT_LINK="$ROOT/.app-next-${RELEASE_ID}"
PREVIOUS=""
SWITCHED=0

case "$RELEASE" in
  "$ROOT"/releases/*) ;;
  *) echo "Güvensiz release yolu: $RELEASE" >&2; exit 2 ;;
esac

cleanup_remote() {
  rm -f -- "$ARCHIVE" "$NEXT_LINK"
}

rollback_on_error() {
  status=$?
  if [ "$SWITCHED" -eq 1 ] && [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "HATA: health-check başarısız; önceki release'e dönülüyor: $PREVIOUS" >&2
    ln -s "$PREVIOUS" "$NEXT_LINK"
    mv -Tf "$NEXT_LINK" "$CURRENT"
    systemctl restart gulumsalim-discovery gulumsalim-api gulumsalim-web || true
  fi
  if [ "$SWITCHED" -eq 0 ] && [ -d "$RELEASE" ]; then
    rm -rf --one-file-system -- "$RELEASE"
  fi
  cleanup_remote
  exit "$status"
}
trap rollback_on_error ERR INT TERM
trap cleanup_remote EXIT

mkdir -p "$RELEASES"
test -f "$ARCHIVE"
printf '%s  %s\n' "$EXPECTED_CHECKSUM" "$ARCHIVE" | sha256sum -c -

if [ -e "$RELEASE" ]; then
  echo "Release zaten var: $RELEASE" >&2
  exit 2
fi

if [ -L "$CURRENT" ]; then
  PREVIOUS=$(readlink -f "$CURRENT")
  case "$PREVIOUS" in
    "$ROOT"/releases/*) ;;
    *) echo "Aktif symlink release ağacının dışında: $PREVIOUS" >&2; exit 2 ;;
  esac
else
  echo "$CURRENT bir release symlink'i değil; otomatik deploy durduruldu" >&2
  exit 2
fi

mkdir "$RELEASE"
tar -xzf "$ARCHIVE" -C "$RELEASE"

# Secret'lar release artefaktına girmez; yalnızca aktif release'ten kopyalanır.
install -o gulumsalim -g gulumsalim -m 600 "$CURRENT/apps/api/.env" "$RELEASE/apps/api/.env"
install -o gulumsalim -g gulumsalim -m 600 "$CURRENT/apps/web/.env.local" "$RELEASE/apps/web/.env.local"
install -o gulumsalim -g gulumsalim -m 600 "$CURRENT/services/discovery/.env" "$RELEASE/services/discovery/.env"
chown -R gulumsalim:gulumsalim "$RELEASE"

cd "$RELEASE"
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin HOME=/opt/gulumsalim \
  pnpm install --frozen-lockfile
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin HOME=/opt/gulumsalim \
  pnpm --filter @gulumsalim/api typecheck
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin HOME=/opt/gulumsalim \
  pnpm --filter @gulumsalim/web build

cd "$RELEASE/services/discovery"
sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim \
  go test ./...
sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim \
  go build -buildvcs=false -o discovery ./cmd/server

# Migration öncesinde taze DB dump'ı zorunlu. Release ile sürümlenen betik
# dump bütünlüğünü pg_restore -l ile doğrular, atomik yayınlar ve 14 günlük
# rotasyon uygular. Böylece sunucuda repo dışında kalan bilinmeyen bir betiğe
# bağımlı değiliz.
test -x "$RELEASE/infra/scripts/backup-db.sh"
ENV_FILE="$RELEASE/apps/api/.env" BACKUP_ROOT="$ROOT" \
  "$RELEASE/infra/scripts/backup-db.sh"
cd "$RELEASE"
sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin HOME=/opt/gulumsalim \
  pnpm --filter @gulumsalim/api db:migrate

ln -s "$RELEASE" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT"
SWITCHED=1

systemctl restart gulumsalim-discovery
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-all-errors http://127.0.0.1:8081/readyz >/dev/null
systemctl restart gulumsalim-api
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-all-errors http://127.0.0.1:3000/healthz >/dev/null
systemctl restart gulumsalim-web
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-all-errors http://127.0.0.1:3001/ >/dev/null

# Process health'in yanında kritik public akışların doğru release içeriğini
# sunduğunu da kanıtla. Bir marker kaybolursa ERR trap önceki symlink'e döner.
SITE_URL=http://127.0.0.1:3001 bash "$RELEASE/infra/scripts/smoke-prod.sh"

SWITCHED=2
trap - ERR INT TERM
cleanup_remote
trap - EXIT

# Son N release'i tut. Aktif ve bir önceki release hiçbir koşulda silinmez.
mapfile -t OLD_RELEASES < <(
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -rn | tail -n +$((KEEP_RELEASES + 1)) | cut -d' ' -f2-
)
for old in "${OLD_RELEASES[@]}"; do
  case "$old" in
    "$ROOT"/releases/*)
      if [ "$old" != "$RELEASE" ] && [ "$old" != "$PREVIOUS" ]; then
        rm -rf --one-file-system -- "$old"
      fi
      ;;
  esac
done

echo "release=$RELEASE_ID previous=$PREVIOUS status=ok"
REMOTE

echo "==> Deploy tamamlandı: $RELEASE_ID"
