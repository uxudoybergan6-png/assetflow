#!/usr/bin/env bash
# Cloud SQL Auth Proxy — Unix socket'ni CI runner / Cloud Shell / lokal mashinada
# Cloud Run'dagi joylashuv bilan AYNAN bir xil qilib ko'taradi.
#
# NIMA UCHUN KERAK (2026-07-31, Neon → Google Cloud SQL ko'chishi):
#   Cloud Run konteynerida `/cloudsql/<INSTANCE>` socket'ini `--add-cloudsql-instances`
#   avtomatik mount qiladi. Boshqa HECH QAYERDA (GitHub Actions runner, Cloud Shell,
#   lokal mashina) bunday mount YO'Q — lekin migratsiya va zaxira qadamlari o'sha
#   jonli bazaga ulanishi shart. Bu skript o'sha socket'ni joyida yaratadi, natijada
#   `CLOUDRUN_ENV_YAML` dagi DATABASE_URL **o'zgarishsiz** ishlatiladi:
#     · URL qayta yozilmaydi → maxsus belgili parolni qayta kodlash xatosi YO'Q;
#     · migratsiya/zaxira AYNAN production connection string'ini sinaydi (TCP taxminini emas).
#
# Ishlatish:
#   bash scripts/cloudsql-proxy.sh "<database-url>"
#
# Xatti-harakat:
#   · URL Unix socket'ga qaramasa (`?host=/…` yo'q) yoki socket allaqachon tirik bo'lsa —
#     hech nima qilmaydi va 0 qaytaradi (TCP/lokal Postgres bilan ishlash buzilmaydi).
#   · Aks holda proxy'ni fonda ko'taradi, TAYYORLIGINI tekshiradi (aytmaydi) va PID'ni
#     `${CLOUDSQL_PROXY_PID_FILE:-cloud-sql-proxy.pid}` fayliga yozadi.
#
# Chaqiruvchi proxy'ni to'xtatishi kerak:
#   kill "$(cat cloud-sql-proxy.pid)"

set -euo pipefail

DB_URL="${1:-}"
if [ -z "$DB_URL" ]; then
  echo "❌ cloudsql-proxy.sh: database URL argument berilmadi" >&2
  exit 1
fi

# QADALGAN versiya + har platforma uchun SHA-256 (fail-closed). "latest" ATAYLAB
# ishlatilmaydi — deploy/zaxira zanjiriga tekshirilmagan ikkilik fayl tushmasin.
CSP_VERSION="${CSP_VERSION:-v2.23.0}"

# Socket yo'li URL'ning O'ZIDAN olinadi — instance o'zgarsa skript qayta yozilmaydi.
SOCK_HOST="$(printf '%s' "$DB_URL" | sed -nE 's/.*[?&]host=([^&]*).*/\1/p')"
case "$SOCK_HOST" in
  /*) ;;
  *)
    echo "ℹ️  DATABASE_URL Unix socket'ga qaramaydi — Auth Proxy kerak emas."
    exit 0
    ;;
esac

SOCK_FILE="${SOCK_HOST}/.s.PGSQL.5432"
if [ -S "$SOCK_FILE" ]; then
  echo "ℹ️  Socket allaqachon mavjud ($SOCK_FILE) — Auth Proxy ishga tushirilmadi."
  exit 0
fi

CSP_DIR="$(dirname "$SOCK_HOST")"
CSP_INSTANCE="$(basename "$SOCK_HOST")"

case "$(uname -s)" in
  Linux) CSP_OS=linux ;;
  Darwin) CSP_OS=darwin ;;
  *) echo "❌ Qo'llab-quvvatlanmaydigan OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) CSP_ARCH=amd64 ;;
  arm64|aarch64) CSP_ARCH=arm64 ;;
  *) echo "❌ Qo'llab-quvvatlanmaydigan arxitektura: $(uname -m)" >&2; exit 1 ;;
esac

case "${CSP_OS}.${CSP_ARCH}" in
  linux.amd64)  CSP_SHA256=cd689d582b826fa5bc82c01ccc14e45a58200c3cefbf923ce96c422825e4e6f6 ;;
  linux.arm64)  CSP_SHA256=23f63b36d1eda329a0751a5185f3ddbbfda1a5996846fcd5b408601e0981c963 ;;
  darwin.amd64) CSP_SHA256=8089f6bab724a68c5e47b74759671db091df44b36e84cd273c1b899068f7a173 ;;
  darwin.arm64) CSP_SHA256=d5233967a8b5141bd1e95edcad2fb9930357d3ffbd9f433b82fc4a538d3fd68b ;;
  *) echo "❌ ${CSP_OS}.${CSP_ARCH} uchun qadalgan SHA-256 yo'q" >&2; exit 1 ;;
esac

CSP_BIN="$(mktemp -d)/cloud-sql-proxy"
echo "▶ Cloud SQL Auth Proxy yuklanmoqda (${CSP_VERSION}, ${CSP_OS}.${CSP_ARCH})…"
curl -fsSL -o "$CSP_BIN" \
  "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${CSP_VERSION}/cloud-sql-proxy.${CSP_OS}.${CSP_ARCH}"
if command -v sha256sum >/dev/null 2>&1; then
  echo "${CSP_SHA256}  ${CSP_BIN}" | sha256sum -c - >/dev/null
else
  echo "${CSP_SHA256}  ${CSP_BIN}" | shasum -a 256 -c - >/dev/null
fi
chmod +x "$CSP_BIN"

# Socket katalogi odatda root'niki (/cloudsql) — kerak bo'lsagina sudo ishlatiladi.
if [ ! -d "$CSP_DIR" ]; then
  mkdir -p "$CSP_DIR" 2>/dev/null || sudo mkdir -p "$CSP_DIR"
fi
[ -w "$CSP_DIR" ] || sudo chown "$(id -u):$(id -g)" "$CSP_DIR"

# Kredensial — ADC. CI'da google-github-actions/auth (WIF) GOOGLE_APPLICATION_CREDENTIALS
# o'rnatadi; Cloud Shell'da foydalanuvchi ADC'si. Rolga ehtiyoj: roles/cloudsql.client.
PROXY_LOG="${CLOUDSQL_PROXY_LOG:-cloud-sql-proxy.log}"
PID_FILE="${CLOUDSQL_PROXY_PID_FILE:-cloud-sql-proxy.pid}"
HEALTH_PORT="${CLOUDSQL_PROXY_HEALTH_PORT:-9090}"

nohup "$CSP_BIN" \
  --unix-socket "$CSP_DIR" \
  --health-check --http-address 127.0.0.1 --http-port "$HEALTH_PORT" \
  "$CSP_INSTANCE" > "$PROXY_LOG" 2>&1 &
echo $! > "$PID_FILE"

# Tayyorlik AYTILMAYDI, TEKSHIRILADI: /readiness 200 VA socket fayli haqiqatan mavjud.
# (Ikkinchisi socket joylashuvi taxminini o'z-o'zini tasdiqlovchi qiladi — noto'g'ri
# bo'lsa shu yerda ochiq yiqilamiz, keyingi qadamdagi qorong'i xato bilan emas.)
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${HEALTH_PORT}/readiness" >/dev/null 2>&1 && [ -S "$SOCK_FILE" ]; then
    echo "✅ Cloud SQL Auth Proxy tayyor — $SOCK_FILE"
    exit 0
  fi
  sleep 2
done

echo "❌ Cloud SQL Auth Proxy 120s ichida tayyor bo'lmadi." >&2
echo "--- ${PROXY_LOG} ---" >&2; cat "$PROXY_LOG" >&2 || true
ls -la "$CSP_DIR" "$SOCK_HOST" >&2 2>/dev/null || true
exit 1
