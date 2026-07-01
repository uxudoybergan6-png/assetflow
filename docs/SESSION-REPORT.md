# SESSION REPORT — 2026-07-01 — Video → alohida GCP loyiha (2-$300) + 4 video model

Foydalanuvchining 2-Google-hisobidagi 2-$300 kreditli loyiha (project-62cb1324-b958-4bc1-b50) videoga ulandi. 4 video model yoqildi.

## Cross-loyiha routing (video → 2-loyiha)
- **Kod:** `GOOGLE_CLOUD_PROJECT_VIDEO` env. `vertex.ts` (Veo) + `vertex-omni.ts` (Omni) shu loyihani ishlatadi (client project + x-goog-user-project). Fallback → asosiy loyiha. Rasm asosiy loyihada qoladi.
- **Env:** cloudrun-env.yaml + GitHub secret (CLOUDRUN_ENV_YAML) yangilandi.
- **Foydalanuvchi (2-hisob konsolida):** Vertex AI API yoqdi + Cloud Run SA (331762958776-compute@...) ga "Agent Platform User" (=aiplatform.user) berdi.
- **Bir martalik infra (men, 1-loyiha bucket'ida):** 2-loyiha video service-agent (service-918943206370@gcp-sa-aiplatform...) ga GCS bucket assetflow-assets-2026 da roles/storage.objectAdmin berildi — Veo natijani bucket'ga yozishi uchun (avval "storage.objects.create access yo'q" xatosi bergan edi).

## 4 video model (provider vertex/vertex-omni, TO'G'RI ID)
| Model | key | res | dur | narx |
|---|---|---|---|---|
| Veo 3.1 Lite (default) | veo-3.1-lite-generate-001 | 720p | 4/6/8 | 3/s |
| Veo 3.1 Fast | veo-3.1-fast-generate-001 | 720p/1080p | 4/6/8 | 8/s |
| Veo 3.1 | veo-3.1-generate-001 | 720p/1080p | 4/6/8 | 30/s |
| Gemini Omni Flash | gemini-omni-flash-preview | 720p | 10 | 80 |

## Tekshiruv
- **Veo 3.1 Lite production sinov: VIDEO YARATILDI (2-loyihada)** ✅ — submit→poll→GCS→S3, SA+bucket ruxsatidan keyin. Routing tasdiqlandi.
- Provisioning: 2-loyihada Vertex yangi yoqilgani uchun dastlab "service agents provisioning" + "bucket access yo'q" xatolari — normal, ruxsat berilgach o'tdi.

## OCHIQ MUAMMO (alohida)
- **OpenRouter krediti TUGAGAN** → "Yaxshilash" (enhance) ishlamaydi ("Insufficient credits openrouter.ai"). Video/rasm gen (Google) buga bog'liq EMAS. Yechim: OpenRouter top-up YOKI enhance'ni fal/Gemini'ga o'tkazish (keyingi vazifa).
- Narxlar (Veo Std/Omni) taxminiy — Google aniq narxi bilan moslash mumkin.
