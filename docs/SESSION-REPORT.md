# SESSION REPORT — 2026-07-01 — Omni VIDEO referens + video editing OCHILDI (ultracode workflow)

Foydalanuvchi: Omni'ga video referens / video editing MUHIM. Ultracode ko'p-agentli workflow + jonli sinov bilan Vertex Omni video-input formati topildi va ulandi.

## VIDEO INPUT formati (workflow topdi, jonli tasdiq)
- Item: `{type:"video", data:<base64> | uri:"gs://...", mime_type:"video/mp4"}`.
- `mime_type` snake_case xom MIME (`mimeType`/enum `TYPE_MP4` RAD etiladi). data/uri oneof.
- **HTTPS/presigned QABUL QILINMAYDI** — faqat `gs://` (same-project) yoki inline base64.
- gs:// same-project SHART: Omni VIDEO_PROJECT=project2, bucket project1 → cross-loyiha gs:// 400.
  → **INLINE base64 (≤15MB)** ishlatamiz (videoRefToOmniInput yuklab base64 qiladi, loyihaga bog'liq emas).
- **ENG KRITIK: VIDEO input bo'lsa `response_format` YUBORILMAYDI** — aks holda 400. Model video input bilan baribir video chiqaradi. Video input'siz esa response_format aspect uchun qoladi.

## Kod
- `vertex-omni.ts` omniGenerateVideo: images + videos; video item quradi; hasVideoInput → response_format skip.
- `gen-processor.ts` runVertexOmniVideo: media-refs (imageUrls rasm + videoUrls video); videoRefToOmniInput (data-URI/bucket/tashqi → inline base64 ≤15MB).
- `s3.ts`: gcsKeyFromUrl / gcsUriFromUrl.
- `gen-models.ts` Omni: refKind='media-refs', mediaRefs{image:3,video:2}, videoSettings (720p/10s), pricing per-generation 80.

## Jonli tasdiq (prod, project2)
- Manba video (Veo Lite) → Omni'ga video referens (inline base64, 4.9MB) → **Omni video YARATILDI ✅** (reference-to-video). Log: rf=no, project2, video item qabul qilindi.

## Foydalanuvchiga
- AE'ni Cmd+Q qayta oching. Omni tanlanganda referens = ko'p-modal strip (rasm + VIDEO). Video referens yuklab, "shu videoni davom ettir/o'zgartir" prompt bilan → reference-to-video / editing ishlaydi.
- Cheklov: video referens ≤15MB (uzun/katta klip uchun kelajakda same-project GCS bucket kerak).
