#!/usr/bin/env bash
# AssetFlow API → Cloud Run (bitta buyruq). Cloud Shell'da: bash deploy-cloudrun.sh
# Cloud Build EMAS — image LOKAL quriladi (Cloud Build --source bo'sh-log bilan yiqilgani uchun),
# Artifact Registry'ga push qilinadi, so'ng tayyor image'dan deploy.
set -euo pipefail

PROJECT="${PROJECT:-project-289028d3-984c-4d84-bd4}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-assetflow-api}"
REPO="${REPO:-assetflow}"
IMG_BASE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api"
# #33 (I2) — o'zgarmas teg: `:latest` bilan deploy qilinsa Cloud Run revision AYNAN
# qaysi kodni ishlatayotgani noaniq bo'lib qoladi (keyingi push tegni bosib ketadi) va
# rollback "eski image'ga qayting" deyish imkonsiz. Endi CI kabi commit SHA teg ham
# push qilinadi va DEPLOY aynan shu tegdan bo'ladi.
SHA="$(git rev-parse --short=12 HEAD 2>/dev/null || echo manual-$(date +%Y%m%d%H%M%S))"
if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then SHA="${SHA}-dirty"; fi
IMG="${IMG_BASE}:${SHA}"

echo "▶ Project: $PROJECT · Region: $REGION"
echo "▶ Image:   $IMG"

# #33 (I2) — NORMAL yo'l: main'ga push → .github/workflows/deploy-cloudrun.yml
# (migratsiya gate + SHA teg + health-gated rollout). Bu skript — favqulodda/qo'lda
# zaxira yo'li. Ilgari u migratsiyalarni UMUMAN qo'llamasdi: yangi kod eski sxemaga
# deploy bo'lib, jonli API'ni buzish mumkin edi. Endi migratsiya SHU YERDA ham gate.
if [ "${SKIP_DEPLOY_WARNING:-0}" != "1" ] && [ -t 0 ]; then
  echo ""
  echo "⚠️  QO'LDA DEPLOY. Odatdagi yo'l — main'ga push (GitHub Actions)."
  echo "    Bu skript CI'ni chetlab o'tadi: test yo'q, konkurentlik qulfi yo'q."
  printf "    Davom etilsinmi? [y/N] "
  read -r ans
  case "$ans" in [yY]*) ;; *) echo "Bekor qilindi."; exit 1 ;; esac
fi

if [ ! -f cloudrun-env.yaml ]; then
  echo "❌ cloudrun-env.yaml topilmadi. Avval: cp cloudrun-env.example.yaml cloudrun-env.yaml && nano cloudrun-env.yaml"
  exit 1
fi

gcloud config set project "$PROJECT" >/dev/null

# #33 (I2) — MIGRATSIYA GATE (CI'dagi bilan bir xil tartib): yangi kod deploy
# bo'lishidan OLDIN sxema yangilanadi. Yiqilsa `set -e` bilan bu yerda to'xtaymiz →
# eski revision jonli qoladi. DIRECT_DATABASE_URL bo'lsa (pgbouncer DDL'ni
# qo'llab-quvvatlamaydi) o'sha ishlatiladi.
if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo "▶ Migratsiya O'TKAZIB YUBORILDI (SKIP_MIGRATIONS=1) — sxema mos ekaniga ishonch hosil qiling."
else
  echo "▶ DB migratsiyalari qo'llanmoqda (deploy'dan OLDIN)…"
  DB_URL="$(grep -E '^DATABASE_URL:' cloudrun-env.yaml | head -1 | sed -E 's/^DATABASE_URL:[[:space:]]*//; s/^"//; s/"[[:space:]]*$//')"
  if [ -z "$DB_URL" ]; then
    echo "❌ DATABASE_URL cloudrun-env.yaml'da topilmadi — deploy bekor qilindi."
    exit 1
  fi
  DIRECT_URL="$(grep -E '^DIRECT_DATABASE_URL:' cloudrun-env.yaml | head -1 | sed -E 's/^DIRECT_DATABASE_URL:[[:space:]]*//; s/^"//; s/"[[:space:]]*$//' || true)"
  DATABASE_URL="$DB_URL" DIRECT_DATABASE_URL="${DIRECT_URL:-$DB_URL}" \
    npm run migrate:deploy -w @creative-tools/database
fi

echo "▶ API'lar yoqilmoqda…"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com >/dev/null

echo "▶ Artifact Registry repo tekshiruvi…"
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker --location="$REGION" --description="AssetFlow API" 2>/dev/null \
  || echo "  (repo allaqachon bor)"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" -q >/dev/null

echo "▶ Image qurilmoqda (lokal docker, ~1-2 daq)…"
# --platform linux/amd64 SHART: Cloud Run amd64 kutadi, Apple Silicon (arm64) mac'da
# platform ko'rsatilmasa "exec format error" bilan konteyner ishga tushmaydi.
docker buildx build --platform linux/amd64 --provenance=false -t "$IMG" -t "${IMG_BASE}:latest" --load .

echo "▶ Artifact Registry'ga push…"
docker push "$IMG"
docker push "${IMG_BASE}:latest"

echo "▶ Cloud Run deploy (no-cpu-throttling + min-instances=1 — fon gen ishlashi uchun SHART)…"
# #65 (T5.4) — --concurrency 20 (default 80 emas): instans 1 CPU / 1Gi, ffmpeg transcode
# va ingest bir xil protsessda ishlaydi → 80 parallel so'rov OOM/CPU och qoldirardi.
# 20 × max-instances 10 = 200 parallel so'rov sig'imi (bugungi yukdan ancha yuqori).
# FAZA 3 (D) — health-gated rollout: startup probe /health (DB+storage HAQIQIY tekshiruv,
# 503=degraded) — bog'liqligi buzilgan revision hech qachon trafik OLMAYDI (deploy yiqiladi,
# eski revision jonli qoladi). Liveness /livez (arzon protsess-tirikmi) — muzlagan
# konteyner restart qilinadi. Rollback: docs/ROLLBACK-RUNBOOK.md
gcloud run deploy "$SERVICE" --image "$IMG" \
  --region "$REGION" --allow-unauthenticated \
  --no-cpu-throttling --min-instances 1 --max-instances 10 \
  --concurrency 20 \
  --memory 1Gi --cpu 1 --timeout 600 \
  --startup-probe "httpGet.path=/health,initialDelaySeconds=5,periodSeconds=10,timeoutSeconds=5,failureThreshold=17" \
  --liveness-probe "httpGet.path=/livez,periodSeconds=30,timeoutSeconds=5,failureThreshold=3" \
  --env-vars-file cloudrun-env.yaml

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo ""
echo "✅ DEPLOY TAYYOR"
echo "   URL:    $URL"
echo "   Image:  $IMG   (rollback: docs/ROLLBACK-RUNBOOK.md)"
echo "   Health: $(curl -s "$URL/health" || echo '(health javob bermadi — loglarni tekshiring)')"
echo ""
echo "KEYINGI QADAM:"
echo "  1) cloudrun-env.yaml'da:  API_PUBLIC_URL: \"$URL\"  qilib qo'ying"
echo "  2) Shu skriptni QAYTA ishga tushiring (env yangilanadi)."
echo "  3) Plagin/Studio API manzilini $URL ga yangilang (Claude'ga URL'ni yuboring)."
