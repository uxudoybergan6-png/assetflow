#!/usr/bin/env bash
# P1 #19 — Bulk-ingest ISHCHISI → Cloud Run JOB (API servisidan alohida).
# Ingest CPU foydalanuvchi trafigi bilan raqobatlashmasin (P7 §8). Xuddi API bilan
# BIR XIL image'dan foydalanadi (dist/scripts/ingest-worker.js), faqat command boshqa.
#
# Ishlatish:
#   1) Avval API'ni deploy qiling (image quriladi):  bash deploy-cloudrun.sh
#   2) So'ng bu job'ni yarating/yangilang:            bash deploy-ingest-worker.sh
#   3) API'da INGEST_WORKER_INLINE=0 qiling (cloudrun-env.yaml) va API'ni qayta deploy —
#      shunda navbatni FAQAT shu job ishlaydi (double-processing zararsiz, lekin toza).
#   4) Job'ni ishga tushirish:  gcloud run jobs execute assetflow-ingest-worker --region <REGION>
#      (yoki Cloud Scheduler bilan RUN_ONCE=1 rejimida davriy trigger — pastga qarang).
set -euo pipefail

PROJECT="${PROJECT:-project-289028d3-984c-4d84-bd4}"
REGION="${REGION:-europe-west1}"
JOB="${JOB:-assetflow-ingest-worker}"
REPO="${REPO:-assetflow}"
IMG="${IMG:-${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api:latest}"

echo "▶ Project: $PROJECT · Region: $REGION · Job: $JOB"
echo "▶ Image:   $IMG (API bilan bir xil — avval deploy-cloudrun.sh ishlatilgan bo'lsin)"

if [ ! -f cloudrun-env.yaml ]; then
  echo "❌ cloudrun-env.yaml topilmadi."
  exit 1
fi

gcloud config set project "$PROJECT" >/dev/null

# Doimiy poller rejimi (RUN_ONCE o'rnatilmagan). Uzun ish uchun --task-timeout katta,
# --max-retries 0 (worker o'zi retry qiladi, IngestJob.attempts). CPU=1, xotira 2Gi
# (yauzl streaming ingest 762MB zip ≈ 167MB RSS — zaxira bilan). Job navbatni ishlaydi.
echo "▶ Cloud Run JOB yaratilmoqda/yangilanmoqda…"
gcloud run jobs deploy "$JOB" \
  --image "$IMG" \
  --region "$REGION" \
  --command node \
  --args apps/api/dist/scripts/ingest-worker.js \
  --cpu 1 --memory 2Gi \
  --max-retries 0 \
  --task-timeout 3600 \
  --env-vars-file cloudrun-env.yaml \
  --set-env-vars INGEST_WORKER_INLINE=1

echo ""
echo "✅ JOB TAYYOR: $JOB"
echo ""
echo "ISHGA TUSHIRISH:"
echo "  gcloud run jobs execute $JOB --region $REGION"
echo ""
echo "DAVRIY (Cloud Scheduler, har 5 daqiqada navbatni bo'shatib chiqadi):"
echo "  # Job'ni RUN_ONCE=1 bilan qayta deploy qiling (navbat bo'shaganда chiqadi):"
echo "  gcloud run jobs update $JOB --region $REGION --set-env-vars RUN_ONCE=1"
echo "  gcloud scheduler jobs create http ingest-worker-tick \\"
echo "    --schedule '*/5 * * * *' --uri \\"
echo "    https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/${JOB}:run \\"
echo "    --http-method POST --oauth-service-account-email <SA>"
echo ""
echo "ESLATMA: API servisida cloudrun-env.yaml'ga INGEST_WORKER_INLINE: \"0\" qo'shib"
echo "         qayta deploy qiling — shunda navbatni faqat shu job ishlaydi."
