#!/usr/bin/env bash
# Güvenli, tekrarlanabilir production güvenlik kapısı. Yalnız GET/HEAD/
# OPTIONS/TRACE kullanır; hesap, sipariş ve ödeme verisi oluşturmaz.
set -Eeuo pipefail

SITE_URL="${SITE_URL:-https://gulumsalim.com}"
REQUIRE_HSTS="${REQUIRE_HSTS:-1}"
REQUIRE_EDGE="${REQUIRE_EDGE:-1}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-5}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-20}"
SITE_URL=${SITE_URL%/}

if [[ ! "$SITE_URL" =~ ^https?://[^/]+(:[0-9]+)?$ ]]; then
  echo "Geçersiz SITE_URL" >&2
  exit 2
fi
if [[ "$REQUIRE_HSTS" != "0" && "$REQUIRE_HSTS" != "1" ]]; then
  echo "REQUIRE_HSTS yalnızca 0 veya 1 olabilir" >&2
  exit 2
fi
if [[ "$REQUIRE_EDGE" != "0" && "$REQUIRE_EDGE" != "1" ]]; then
  echo "REQUIRE_EDGE yalnızca 0 veya 1 olabilir" >&2
  exit 2
fi

TMP_DIR=$(mktemp -d)
cleanup() { rm -rf -- "$TMP_DIR"; }
trap cleanup EXIT

FAILURES=0
CHECKS=0
pass() { CHECKS=$((CHECKS + 1)); echo "PASS $1"; }
fail() { CHECKS=$((CHECKS + 1)); FAILURES=$((FAILURES + 1)); echo "FAIL $1" >&2; }

request() {
  local method=$1
  local path=$2
  local headers_file=$3
  local body_file=$4
  shift 4
  curl --silent --show-error --compressed \
    --connect-timeout "$CONNECT_TIMEOUT" --max-time "$REQUEST_TIMEOUT" \
    --user-agent 'GulumSalim-Security-Smoke/1.0' \
    --request "$method" --dump-header "$headers_file" --output "$body_file" \
    --write-out '%{http_code}' "$@" "$SITE_URL$path"
}

ROOT_HEADERS="$TMP_DIR/root.headers"
ROOT_BODY="$TMP_DIR/root.body"
status=$(request GET / "$ROOT_HEADERS" "$ROOT_BODY")
[[ "$status" == "200" ]] && pass "ana sayfa erişilebilir" || fail "ana sayfa HTTP $status"

csp=$(tr -d '\r' < "$ROOT_HEADERS" | sed -n 's/^[Cc]ontent-[Ss]ecurity-[Pp]olicy: //p' | tail -n 1)
script_src=$(printf '%s' "$csp" | tr ';' '\n' | sed -n 's/^ *script-src /script-src /p')
if [[ "$script_src" == *"'nonce-"* && "$script_src" != *"'unsafe-inline'"* ]]; then
  pass "script CSP nonce tabanlı ve unsafe-inline kapalı"
else
  fail "script CSP strict değil"
fi
[[ "$csp" == *"object-src 'none'"* && "$csp" == *"base-uri 'self'"* ]] \
  && pass "CSP object/base kısıtları aktif" || fail "CSP object/base kısıtları eksik"

if [[ "$REQUIRE_HSTS" == "1" ]]; then
  hsts=$(tr -d '\r' < "$ROOT_HEADERS" | sed -n 's/^[Ss]trict-[Tt]ransport-[Ss]ecurity: //p' | tail -n 1)
  [[ "$hsts" == *"max-age="* && "$hsts" == *"includeSubDomains"* ]] \
    && pass "HSTS aktif" || fail "HSTS eksik"
fi

for spec in \
  "/api/auth/me:401:müşteri yetki sınırı" \
  "/api/vendor/auth/me:401:satıcı yetki sınırı" \
  "/api/admin/auth/me:401:admin yetki sınırı" \
  "/.env:404:.env gizli" \
  "/.git/config:404:.git gizli"; do
  IFS=: read -r path expected label <<< "$spec"
  headers="$TMP_DIR/check-${CHECKS}.headers"
  body="$TMP_DIR/check-${CHECKS}.body"
  actual=$(request GET "$path" "$headers" "$body")
  [[ "$actual" == "$expected" ]] && pass "$label" || fail "$label HTTP $actual (beklenen $expected)"
done

CORS_HEADERS="$TMP_DIR/cors.headers"
CORS_BODY="$TMP_DIR/cors.body"
request GET /api/healthz "$CORS_HEADERS" "$CORS_BODY" -H 'Origin: https://attacker.invalid' >/dev/null
if tr -d '\r' < "$CORS_HEADERS" | grep -Eiq '^access-control-allow-origin:'; then
  fail "kötücül origin CORS yanıtı aldı"
else
  pass "kötücül origin CORS allowlist dışında"
fi

if [[ "$REQUIRE_EDGE" == "1" ]]; then
  TRACE_HEADERS="$TMP_DIR/trace.headers"
  TRACE_BODY="$TMP_DIR/trace.body"
  trace_status=$(request TRACE / "$TRACE_HEADERS" "$TRACE_BODY")
  [[ "$trace_status" == "405" ]] && pass "TRACE kapalı" || fail "TRACE HTTP $trace_status"
fi

if [[ "$FAILURES" -ne 0 ]]; then
  echo "Güvenlik smoke başarısız: $FAILURES/$CHECKS" >&2
  exit 1
fi
echo "Güvenlik smoke başarılı: $CHECKS/$CHECKS"
