# SESSION REPORT — P1 #3 (CDN, Block E) · Plan B: Cloudflare Worker proksi

**Sabab:** GCP org-policy (`storage.uniformBucketLevelAccess` + `publicAccessPrevention`) loyiha
darajasida MAJBURIY — per-obyekt public IMKONSIZ. Bucket YOPIQ qoladi; ko'rsatish assetlari
`cdn.getframeflow.app` Worker-proksi orqali beriladi. PUSH QILINMADI.

- `apps/api/src/lib/public-keys.ts` (YANGI) — `isPublicReadKey()` SOF (bog'liqliksiz) modul =
  YAGONA manba. `s3.ts` undan import qiladi + re-export; `getPublicOrSignedUrl()` private kalitni
  CDN'da ham SIGNED beradi (provayder gen asl/refs'ni oladi). `aclFor` + ACL wiring O'CHIRILDI
  (bucket yopiq — obyekt ACL kerak emas). `backfill-public-acl.ts` O'CHIRILDI.
- `workers/cdn-proxy/` (YANGI) — Worker AYNAN o'sha `isPublicReadKey`ni import qiladi (relativ,
  takror EMAS). GET /<key>: ruxsatsiz→403 (GCS'ga bormaydi); ruxsatli→GCS SigV4 (aws4fetch) +
  immutable kesh + Range. wrangler.toml + README (owner deploy qadamlari).
- `cloudrun-env.yaml`: `CDN_BASE_URL=https://cdn.getframeflow.app` (gitignored → `gh secret`).
- CSP `_headers`: `cdn.getframeflow.app` img-src/media-src'ga qo'shildi (prepare-cf-pages.mjs).

**Isbot (deploysiz):** API build ✅; worker `tsc --noEmit` ✅; gate-simulyatsiya 17/17 ✅
(thumb/preview/scene/gen-derivativ→200; pack/pack.dl/mogrt/gen-asl/gen-refs/gen-ref-src/avatars/
incoming→403). WEB/PLUGIN kod O'ZGARMAYDI (thumbUrl kontrakti bir xil).

**Kutilmoqda (owner):** Worker deploy (secretlar + cdn.getframeflow.app domen) → `gh secret set
CLOUDRUN_ENV_YAML` → API deploy → jonli isbot: CDN thumb/preview 200 · pack/gen-refs 403 · GCS
to'g'ridan 403 · Pro pack 302→signed. So'ng men push+deploy qilaman.
