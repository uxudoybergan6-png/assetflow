# GCS bucket CORS — contributor to'g'ridan-to'g'ri yuklash

## Nega kerak

Contributor Studio thumbnail/preview/pack fayllarni brauzerdan **to'g'ridan-to'g'ri**
`assetflow-assets-2026` GCS bucket'iga presigned S3-compatible PUT bilan yuklaydi
(`apps/api/src/lib/s3.ts` → `createUploadUrl`, `apps/api/src/routes/contributor.ts` →
`POST /templates/:id/upload-url` + `/pack-uploaded`).

Brauzer PUT so'rovi `getframeflow.app` / `studio.getframeflow.app` domenidan
`https://storage.googleapis.com/assetflow-assets-2026/...` ga **cross-origin** ketadi.
Bucket'da CORS siyosati bo'lmasa, brauzer preflight/PUT'ni bloklaydi va frontend
(`studio-api.js` → `xhrSend` `onerror`) foydalanuvchiga:

> "Yuklash uzilib qoldi — internetni tekshirib qayta urinib ko'ring"

xabarini ko'rsatadi — bu tarmoq xatosi emas, **bucket CORS yo'qligi** sabab.

## Qanday qo'llash (manual — bitta buyruq yetarli)

```bash
gcloud storage buckets update gs://assetflow-assets-2026 --cors-file=infra/gcs-cors.json
```

yoki (eski `gsutil` yo'li):

```bash
gsutil cors set infra/gcs-cors.json gs://assetflow-assets-2026
```

## Tekshirish

```bash
gcloud storage buckets describe gs://assetflow-assets-2026 --format="default(cors_config)"
```

Natija `infra/gcs-cors.json` tarkibiga mos kelishi kerak.

## Muhim eslatmalar

- Bu **qo'lda bajariladigan infra qadam** — repo ichida hech narsa uni avtomatik
  qo'llamaydi. FrameFlow GCP loyihasiga `gcloud auth`'i bor maintainer bajarishi kerak.
- CORS o'zgarishi **darhol** kuchga kiradi (deploy yoki restart shart emas).
- Faqat **production** origin'lar ro'yxatda: `getframeflow.app`, `studio.getframeflow.app`,
  `admin.getframeflow.app`. Localhost origin **qo'shilmagan** va qo'shilmasligi kerak.
- Kelajakda yangi production frontend domen qo'shilsa: `infra/gcs-cors.json` dagi
  `origin` ro'yxatiga qo'sh, so'ng yuqoridagi `gcloud storage buckets update` buyrug'ini
  qayta bajar.
