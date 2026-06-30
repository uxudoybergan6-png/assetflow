# SESSION REPORT — 2026-06-30 — Render → Cloud Run ko'chirish (tayyorgarlik)

Backend API'ni Render'dan Google Cloud Run'ga ko'chirish uchun fayllar qo'shildi (DB=Neon, R2=Cloudflare — o'zgarmaydi).

- **Dockerfile** (root): node:20 + **tizim ffmpeg** (transcode-preview SHART) + openssl (Prisma) + render.yaml buildCommand'ning aynan nusxasi → `node apps/api/dist/index.js`. App `process.env.PORT` (Cloud Run 8080) ni o'qiydi.
- **.dockerignore**, **cloudrun-env.example.yaml** (env shablon), `.gitignore`ga `cloudrun-env.yaml` (maxfiy).
- **docs/CLOUD-RUN-DEPLOY.md** — qadam-baqadam: API yoqish, migratsiya (Neon'ga qo'lda), `gcloud run deploy --source .`, URL yangilash (plagin/studio/Stripe webhook), tekshirish.

⚠️ KRITIK: gen jobi javobdan keyin FONда ishlaydi (`processGenerationInBackground`). Cloud Run default'да fon CPU bermaydi → gen tugamaydi. Shuning uchun deploy'da **`--no-cpu-throttling` + `--min-instances=1` SHART** (cold-start ham yo'qoladi).

Render hozircha o'chirilmaydi (rollback uchun). $300 trial 2026-09-29 gacha.
