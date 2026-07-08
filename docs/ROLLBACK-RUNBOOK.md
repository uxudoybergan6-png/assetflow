# ROLLBACK RUNBOOK — Cloud Run (assetflow-api)

*FAZA 3 (D) — 2026-07-08. Health-gated rollout bilan juft ishlaydi.*

Xizmat: `assetflow-api` · Region: `europe-west1` · Loyiha: `project-289028d3-984c-4d84-bd4`
Har deploy image'ni **ikkita teg** bilan push qiladi: `:latest` va `:<git SHA>` — shu SHA teglari
rollback'ning asosi (revision'lar ham saqlanadi, ikkala yo'l quyida).

## 0) Qachon rollback qilinadi

- Deploy'dan keyin `/health` 503 (degraded) yoki xatolik darajasi keskin oshdi (Sentry/loglar).
- Yangi revision trafik olyapti-yu, kritik oqim buzilgan (login, katalog, gen, to'lov webhook).
- **Startup probe tufayli** bog'liqligi buzilgan revision odatda o'zi trafik OLMAYDI —
  deploy yiqiladi, eski revision jonli qoladi. Bunday holatda rollback KERAK EMAS,
  faqat sababni tuzatib qayta deploy qilinadi.
- Rollback **kod regressiyasi** uchun; ma'lumot muammosi (DB) uchun `docs/DR-RUNBOOK.md`ga qarang.

## 1) Holatni ko'rish

```bash
# Revisionlar (qaysi jonli, qachon yaratilgan):
gcloud run revisions list --service assetflow-api --region europe-west1

# Joriy trafik taqsimoti:
gcloud run services describe assetflow-api --region europe-west1 \
  --format='value(status.traffic)'
```

## 2) Tez rollback — oldingi revision'ga trafikni qaytarish (SONIYALAR ichida)

```bash
# REVISION nomini 1-qadamdagi ro'yxatdan oling (masalan assetflow-api-00042-abc):
gcloud run services update-traffic assetflow-api --region europe-west1 \
  --to-revisions assetflow-api-00042-abc=100
```

Bu **image qayta build qilmaydi** — mavjud eski revision darhol 100% trafik oladi.
Tekshiruv:

```bash
curl -s https://<service-url>/health   # {"status":"ok",...} kutiladi
```

## 3) Muayyan image SHA'dan qayta deploy (revision o'chirilgan/eskirgan bo'lsa)

```bash
# GitHub'dan ishlagan commit SHA'sini toping (git log / Actions tarixi), so'ng:
IMG="europe-west1-docker.pkg.dev/project-289028d3-984c-4d84-bd4/assetflow/api:<GIT_SHA>"
gcloud run deploy assetflow-api --image "$IMG" \
  --region europe-west1 --allow-unauthenticated \
  --no-cpu-throttling --min-instances 1 --max-instances 2 \
  --memory 1Gi --cpu 1 --timeout 600 \
  --startup-probe "httpGet.path=/health,initialDelaySeconds=5,periodSeconds=10,timeoutSeconds=5,failureThreshold=17" \
  --liveness-probe "httpGet.path=/livez,periodSeconds=30,timeoutSeconds=5,failureThreshold=3" \
  --env-vars-file cloudrun-env.yaml
```

`cloudrun-env.yaml` yo'q bo'lsa — env'ni O'ZGARTIRMAY eski revision konfiguratsiyasini
saqlash uchun `--env-vars-file`siz ishlating (deploy mavjud env'ni meros qiladi).

## 4) Keyin trafikni yangi kodga qaytarish

Tuzatish merge bo'lib, CI deploy o'tgach:

```bash
gcloud run services update-traffic assetflow-api --region europe-west1 --to-latest
```

(Oddiy `gcloud run deploy` ham default holatda yangi revision'ga 100% beradi.)

## 5) Muhim ogohlantirishlar

- **Migratsiyalar**: CI deploy'dan OLDIN `migrate:deploy` ishlaydi va migratsiyalar
  faqat ADDITIVE — eski kod yangi sxemani toleratsiya qiladi, shuning uchun kod
  rollback'i DB rollback talab QILMAYDI. Hech qachon migratsiyani qo'lda orqaga qaytarmang.
- **Env o'zgargan deploy'ni rollback qilishda**: revision o'z env'ini saqlaydi (2-usul
  eski env bilan qaytadi). SHA'dan qayta deploy (3-usul) esa joriy `cloudrun-env.yaml`ni
  oladi — env regressiyasi bo'lsa avval secret/yaml'ni tuzating (`gh secret set CLOUDRUN_ENV_YAML`).
- **Webhooklar** (Stripe/LS/fal): rollback URL'ni o'zgartirmaydi, hech narsa qilish shart emas.
- Rollback'dan keyin ham `/health`ni va Sentry'da yangi xato oqimini 10-15 daqiqa kuzating.
