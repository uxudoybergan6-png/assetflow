#!/usr/bin/env bash
# AssetFlow API → Cloud Run (bitta buyruq). Cloud Shell'da: bash deploy-cloudrun.sh
# Cloud Build EMAS — image LOKAL quriladi (Cloud Build --source bo'sh-log bilan yiqilgani uchun),
# Artifact Registry'ga push qilinadi, so'ng tayyor image'dan deploy.
set -euo pipefail

PROJECT="${PROJECT:-project-289028d3-984c-4d84-bd4}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-assetflow-api}"
REPO="${REPO:-assetflow}"
IMG="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api:latest"

echo "▶ Project: $PROJECT · Region: $REGION"
echo "▶ Image:   $IMG"

if [ ! -f cloudrun-env.yaml ]; then
  echo "❌ cloudrun-env.yaml topilmadi. Avval: cp cloudrun-env.example.yaml cloudrun-env.yaml && nano cloudrun-env.yaml"
  exit 1
fi

gcloud config set project "$PROJECT" >/dev/null

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
docker buildx build --platform linux/amd64 --provenance=false -t "$IMG" --load .

echo "▶ Artifact Registry'ga push…"
docker push "$IMG"

echo "▶ Cloud Run deploy (no-cpu-throttling + min-instances=1 — fon gen ishlashi uchun SHART)…"
# FAZA 3 (D) — health-gated rollout: startup probe /health (DB+storage HAQIQIY tekshiruv,
# 503=degraded) — bog'liqligi buzilgan revision hech qachon trafik OLMAYDI (deploy yiqiladi,
# eski revision jonli qoladi). Liveness /livez (arzon protsess-tirikmi) — muzlagan
# konteyner restart qilinadi. Rollback: docs/ROLLBACK-RUNBOOK.md
gcloud run deploy "$SERVICE" --image "$IMG" \
  --region "$REGION" --allow-unauthenticated \
  --no-cpu-throttling --min-instances 1 --max-instances 2 \
  --memory 1Gi --cpu 1 --timeout 600 \
  --startup-probe "httpGet.path=/health,initialDelaySeconds=5,periodSeconds=10,timeoutSeconds=5,failureThreshold=17" \
  --liveness-probe "httpGet.path=/livez,periodSeconds=30,timeoutSeconds=5,failureThreshold=3" \
  --env-vars-file cloudrun-env.yaml

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo ""
echo "✅ DEPLOY TAYYOR"
echo "   URL:    $URL"
echo "   Health: $(curl -s "$URL/health" || echo '(health javob bermadi — loglarni tekshiring)')"
echo ""
echo "KEYINGI QADAM:"
echo "  1) cloudrun-env.yaml'da:  API_PUBLIC_URL: \"$URL\"  qilib qo'ying"
echo "  2) Shu skriptni QAYTA ishga tushiring (env yangilanadi)."
echo "  3) Plagin/Studio API manzilini $URL ga yangilang (Claude'ga URL'ni yuboring)."
