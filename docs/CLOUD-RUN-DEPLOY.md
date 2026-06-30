# Render → Google Cloud Run ko'chirish (AssetFlow API)

DB (Neon) va assetlar (R2) **o'zgarmaydi** — faqat Node API Render'dan Cloud Run'ga ko'chadi.

## ⚠️ ENG MUHIM
Gen jobi HTTP javobdan **keyin fonда** ishlaydi (`processGenerationInBackground` — fal'ni daqiqalab kuzatadi).
Cloud Run default'да so'rovdan tashqarida CPU bermaydi → fon jarayon o'ladi, gen **tugamaydi**.
SHU SABAB deploy'da **`--no-cpu-throttling` + `--min-instances=1` SHART.** (Bonus: cold-start ham yo'qoladi.)

---

## 0. Tayyorgarlik
- `cloudrun-env.example.yaml` ni `cloudrun-env.yaml` ga nusxalab, qiymatlarni Render dashboard
  (assetflow-api → Environment) dan ko'chiring. **JWT_SECRET Render'dagi bilan AYNAN bir xil bo'lsin.**
- `gcloud` CLI yoki **Cloud Shell** (brauzerda, console.cloud.google.com → terminal ikonkasi). Cloud Shell'да
  repo'ni `git clone` qiling yoki loyihani upload qiling.

## 1. Loyihani tanlash + API'larni yoqish
```bash
gcloud config set project project-289028d3-984c-4d84-bd4   # sizning project ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 2. Migratsiyani bir marta ishlatish (Neon'ga)
Cloud Run'да Render'dagi `preDeployCommand` yo'q — migratsiyani qo'lda ishlatamiz (idempotent):
```bash
DATABASE_URL="<Neon URL>" npm run migrate:deploy -w @creative-tools/database
```
(Har schema o'zgarganda qayta ishlating.)

## 3. Deploy (manbadан — Dockerfile ishlatiladi)
```bash
gcloud run deploy assetflow-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --min-instances 1 \
  --max-instances 2 \
  --memory 1Gi --cpu 1 \
  --timeout 600 \
  --env-vars-file cloudrun-env.yaml
```
- Birinchi deploy konteyner quradi (~3-5 daq). Oxirida **Service URL** beradi: `https://assetflow-api-xxxx.run.app`.
- OOM (xotira yetmasa) → `--memory 2Gi --cpu 2`.

## 4. URL'ni yangilash (1-deploy'dan keyin)
Yangi Cloud Run URL'ni quyidagilarga qo'ying:
1. `cloudrun-env.yaml` → `API_PUBLIC_URL` = yangi URL → **qayta deploy** (3-qadam).
2. Plagin: `plugins/after-effects-cep/assetflow-env.js` (default API) + login javobidagi `apiBaseUrl`.
   Studio: `packages/assetflow-studio/js/studio-config.js` (production API).
3. **CORS_ORIGIN** — studio domeni allaqachon ro'yxatda; o'zgartirish shart emas.
4. **Stripe webhook** (agar Stripe bo'lsa): Stripe dashboard → webhook endpoint URL'ni
   `https://<cloudrun>/api/stripe/webhook` ga yangilang; yangi `STRIPE_WEBHOOK_SECRET` ni env'ga qo'ying.

## 5. Tekshirish
```bash
curl https://<cloudrun-url>/health     # {"status":"ok"} qaytishi kerak
```
Plaginда login → katalog → bitta gen → tugashini kuting (fon ishlayotganini tasdiqlaydi).

## Eslatmalar
- Keyingi deploy'lar: faqat 3-qadam (`gcloud run deploy ... --source .`).
- $300 trial 2026-09-29'да tugaydi. `--min-instances 1` doimiy kredit yeydi (kichik). Trialdan keyin:
  yo to'lov, yo `--min-instances 0` (lekin unda cold-start + fon-jarayon riski qaytadi).
- Render'ni hozircha O'CHIRMANG — Cloud Run to'liq ishlaganini tasdiqlagach o'chiring (rollback oson).
- `--no-cpu-throttling`'ni OLIB TASHLAMANG — aks holda gen jobi tugamaydi.
