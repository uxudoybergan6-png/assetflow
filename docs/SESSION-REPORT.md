# SESSION REPORT — 2026-07-01 — Vertex Veo Fast YOQILDI + Gemini Omni Flash qo'shildi

Veo 3.1 Fast tuzatilib yoqildi (avvalgi qism), so'ng yangi Gemini Omni Flash (Interactions API) to'liq ulanib jonli qilindi.

## Veo 3.1 Fast (id 3002)
- Real smoke-test o'tdi (submit->poll->GCS->S3). Poll cast bug tuzatildi (`Object.assign(new GenerateVideosOperation(), {name})`). enabled:true, 8 kredit/s. Cloud Run revision assetflow-api-00012-49w.

## Gemini Omni Flash (id 3010) — YANGI, JONLI
- **Boshqa API:** Vertex Interactions API (`.../locations/global/interactions`), SINXRON (Veo submit/poll'дан farqli — bitta POST video qaytaradi), ADC token bilan (google-auth-library). Yangi adapter: `apps/api/src/lib/ai/vertex-omni.ts`.
- **Sxema jonli probe + rasmiy hujjat bilan tasdiqlandi:** `{model, input, response_format:{type:video,aspect_ratio}}`; input matn yoki `[{type:image,data,mime_type},{type:text,text}]` (image-to-video); javob `steps[]->model_output->content[]->video{data|uri}`.
- **Nazoratli sinov (~$1):** 1280x720, 10.005s, AAC audio bor, 2.46MB, 38s. Davomiylik QAT'IY ~10s (API tanlatmaydi) = 57920 token = ~$1.00.
- **Narx:** cost 80 kredit (~$1.00 break-even). audio:true. enabled:true.
- gen-processor: `runVertexOmniVideo` (sinxron, provider-job persist YO'Q), provider union `vertex-omni`, dispatcher + stuckTimeout yangilandi.
- Cloud Run deploy: revision **assetflow-api-00014-74q**, 100% traffic, health OK. Prod katalog (?mode=video) 3002 va 3010 ko'rsatadi.

## Ochiq / ehtiyot
- Omni Flash PREVIEW ("private API") — Google o'zgartirishi/o'chirishi mumkin. Har gen ~$1 (qimmat). Bir tool bir necha placeholder'ni qoplaydi (text/image/reference-to-video + video-edit) — kelajakda o'sha tool'larga ulash mumkin.
- Probe'lar ~$2 GCP kredit sarfladi (schema aniqlash + 1 sinov). AE plagindan real UI oqimida sinash tavsiya.
