#!/usr/bin/env bash
# Public production smoke gate. Yalnızca GET istekleri yapar; hesap, sipariş,
# ödeme veya başka bir iş kaydı oluşturmaz. İsteğe bağlı mağaza kontrolü normal
# storefront görüntülenme analitiğini artırabileceği için varsayılan olarak kapalıdır.
set -Eeuo pipefail

SITE_URL="${SITE_URL:-https://gulumsalim.com}"
API_HEALTH_URL="${API_HEALTH_URL:-}"
SMOKE_VENDOR_SLUG="${SMOKE_VENDOR_SLUG:-}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-5}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-20}"

SITE_URL=${SITE_URL%/}
API_HEALTH_URL=${API_HEALTH_URL:-$SITE_URL/api/healthz}
if [[ ! "$SITE_URL" =~ ^https?://[^/]+(:[0-9]+)?$ ]]; then
  echo "Geçersiz SITE_URL: $SITE_URL" >&2
  exit 2
fi
if [[ ! "$API_HEALTH_URL" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "Geçersiz API_HEALTH_URL" >&2
  exit 2
fi
if ! [[ "$CONNECT_TIMEOUT" =~ ^[1-9][0-9]*$ && "$REQUEST_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Timeout değerleri pozitif tam sayı olmalı" >&2
  exit 2
fi
if [[ -n "$SMOKE_VENDOR_SLUG" && ! "$SMOKE_VENDOR_SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Geçersiz SMOKE_VENDOR_SLUG" >&2
  exit 2
fi

for command_name in curl grep mktemp; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Eksik komut: $command_name" >&2
    exit 2
  fi
done

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf -- "$TMP_DIR"
}
trap cleanup EXIT

FAILURES=0
CHECK_INDEX=0

check_url() {
  local url=$1
  local marker=$2
  local label=$3
  local display=$4
  local marker_2=${5:-}
  local marker_3=${6:-}
  local body="$TMP_DIR/$CHECK_INDEX.body"
  local status
  CHECK_INDEX=$((CHECK_INDEX + 1))

  if ! status=$(curl --silent --show-error --location --compressed \
      --connect-timeout "$CONNECT_TIMEOUT" --max-time "$REQUEST_TIMEOUT" \
      --retry 2 --retry-delay 1 --retry-all-errors \
      --user-agent 'GulumSalim-Deploy-Smoke/1.0' \
      --output "$body" --write-out '%{http_code}' "$url"); then
    echo "FAIL $label ($display): bağlantı hatası" >&2
    FAILURES=$((FAILURES + 1))
    return
  fi

  if [[ "$status" != "200" ]]; then
    echo "FAIL $label ($display): HTTP $status" >&2
    FAILURES=$((FAILURES + 1))
    return
  fi

  for expected in "$marker" "$marker_2" "$marker_3"; do
    [[ -z "$expected" ]] && continue
    if ! grep -Fq -- "$expected" "$body"; then
      echo "FAIL $label ($display): beklenen içerik bulunamadı: $expected" >&2
      FAILURES=$((FAILURES + 1))
      return
    fi
  done

  echo "PASS $label ($display)"
}

check_route() {
  local path=$1
  local marker=$2
  local label=$3
  local marker_2=${4:-}
  local marker_3=${5:-}
  check_url "$SITE_URL$path" "$marker" "$label" "$path" "$marker_2" "$marker_3"
}

check_route "/" "Gülüm Şalım" "Ana sayfa"
check_route "/giris" "Bireysel Üye Girişi" "Bireysel giriş"
check_route "/kayit" "Bireysel Üyelik" "Bireysel kayıt"
check_route "/satici/giris" "Kurumsal Üye Girişi" "Kurumsal giriş"
check_route "/satici/kayit" "Kurumsal Üyelik" "Kurumsal kayıt"
check_route "/magazalar" "Mağazalar" "Mağaza ve ürün keşfi" "Mağazaya Git" "product-card"
check_route "/kampanyalar" "Kampanyalar" "Kampanyalar"
check_route "/siparis-takip" "Sipariş Takip" "Sipariş takibi"
check_url "$API_HEALTH_URL" '"status":"ok"' "API/Postgres/Redis sağlığı" "/api/healthz"

if [[ -n "$SMOKE_VENDOR_SLUG" ]]; then
  check_route "/$SMOKE_VENDOR_SLUG" "Ürünler (" "Doğrudan mağaza ürünleri"
fi

if [[ "$FAILURES" -ne 0 ]]; then
  echo "Smoke başarısız: $FAILURES kontrol geçmedi" >&2
  exit 1
fi

echo "Smoke başarılı: $CHECK_INDEX/$CHECK_INDEX kontrol geçti"
