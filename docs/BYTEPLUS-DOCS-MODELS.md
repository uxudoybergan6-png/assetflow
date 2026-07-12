# BYTEPLUS-DOCS-MODELS — ModelArk Seedance 2.0 aniq API sxemasi

> Manba: rasmiy quickstart paketi + **Seedance 2.0 series tutorial to'liq matni** (2026-07-11,
> docs.byteplus.com/en/docs/ModelArk/2291680 "Copy Page"). Bu fayl — BytePlus adapter (BATCH5)
> uchun YAGONA HAQIQAT MANBAI. API param sxemasi endi TO'LIQ tasdiqlangan.

## 1. API mexanikasi (TASDIQLANGAN)

- **Base URL:** `https://ark.ap-southeast.bytepluses.com/api/v3`
- **Auth:** `Authorization: Bearer <ARK_API_KEY>`
- **Task yaratish:** `POST /contents/generations/tasks` → `{ id }`
- **Poll:** `GET /contents/generations/tasks/{id}` → `status: queued|running|succeeded|failed`
- **Natija:** `content.video_url` (⚠️ **24 soat amal qiladi** — darhol GCS'ga ko'chirish SHART) +
  `usage.completion_tokens` (ProviderSpend uchun real token sarfi!)
- **Xato:** `error.code` + `error.message`
- Rasmiy SDK: `byteplus-python-sdk-v2[ark]` / Java / Go — biz TS'da raw REST

## 2. Model ID'lar (TASDIQLANGAN)

| Bizniki | ModelArk model ID | Resolutions |
|---------|-------------------|-------------|
| 3102 Seedance 2.0 R2V | `dreamina-seedance-2-0-260128` | 480p·720p·1080p·**4k** (10-bit HEVC) |
| 3101 Seedance 2.0 Fast | `dreamina-seedance-2-0-fast-260128` | 480p·720p (1080p YO'Q!) |
| (yangi imkon) Mini | `dreamina-seedance-2-0-mini-260615` | 480p·720p — eng arzon tier |

Uchchala model bir xil imkoniyatlar: t2v, i2v (first frame), i2v (first+last frame),
multimodal reference, edit video, extend video, generate_audio, return_last_frame.
Draft mode va offline inference (`service_tier:"flex"`) — Seedance 2.0 seriyasida ❌ (jadval ikonkasi).

## 3. Request sxemasi (TASDIQLANGAN)

```jsonc
{
  "model": "dreamina-seedance-2-0-260128",
  "content": [
    { "type": "text", "text": "<prompt>" },
    { "type": "image_url", "image_url": {"url": "https://..."}, "role": "reference_image" },
    { "type": "video_url", "video_url": {"url": "https://..."}, "role": "reference_video" },
    { "type": "audio_url", "audio_url": {"url": "https://..."}, "role": "reference_audio" }
  ],
  "generate_audio": true,
  "resolution": "720p",      // 480p | 720p | 1080p | 4k (model qo'llasa)
  "ratio": "16:9",           // 21:9 | 16:9 | 4:3 | 1:1 | 3:4 | 9:16 | adaptive
  "duration": 5,             // 4–15 (integer, barcha modellar)
  "watermark": false,        // ⚠️ BIZDA HAR DOIM false (demo default true!)
  "return_last_frame": true  // ixtiyoriy — oxirgi kadr rasmi ham qaytadi (extend uchun foydali)
}
```

- **Rollar:** `reference_image`/`reference_video`/`reference_audio` — erkin referens;
  **qat'iy birinchi/oxirgi kadr uchun `first_frame`/`last_frame`** (i2v start-end rejimimiz shunga).
- **Bizning "auto" aspect → BytePlus `adaptive`.**
- **Ref limitlar (fal bilan BIR XIL):** image 0–9 · video 0–3 · audio 0–3.
  "text+audio" va "faqat audio" input QO'LLANMAYDI (kamida bitta rasm/video bo'lsin yoki faqat text).
- **Prompt'da referenslash:** "Image n"/"Video n"/"Audio n" — content massividagi TUR bo'yicha
  tartib raqami (1 dan). Bizning @Image/@Video UX'imizga mos. Asset ID bilan referenslash ISHLAMAYDI.
- Referens URL'lar public-accessible bo'lishi kerak (bizning GCS signed URL'lar mos; tashqi
  yuklab olish ishlashini birinchi testda tasdiqla).

## 4. ⚠️ KRITIK MAHSULOT CHEKLOVI — REAL YUZLAR

**Seedance 2.0 (BytePlus'da) real inson yuzi bor referens rasm/videoni QABUL QILMAYDI** — input
moderation bloklaydi. Istisnolar:

1. **Trusted outputs:** o'z hisobingizda oxirgi 30 kunda Seedance 2.0 / Seedream 5.0 Lite
   generatsiya qilgan yuzli natijalar — qayta input sifatida ishlaydi (faqat ASL fayl; siqish/
   qayta yuklash trustni buzishi mumkin).
2. **Preset digital characters:** ModelArk raqamli persona kutubxonasi — `asset://<asset-id>`.
3. **Authorized real-person assets:** real shaxs verifikatsiyasi + rozilik → asset registratsiya.

**Bizga ta'siri:** plagin foydalanuvchilari yuzli referens yuklasa BytePlus'da FAIL bo'ladi
(fal'da ishlagan). Yechim variantlari: (a) moderation-fail'da fal'ga auto-fallback (gibrid),
(b) UI'da ogohlantirish, (c) qabul qilish. → Direktor/USER qarori, BATCH5 Prompt #1 izohiga qara.

## 5. Rate limitlar (Individual account — bizning holat!)

| | RPM | Parallel (concurrency) |
|---|-----|------------------------|
| non-4k | 180 | **3** |
| 4k | 15 | **1** |

⚠️ Individual hisobda bir vaqtda faqat **3 ta video job** (4k: 1). Gen-processor semafori shunga
moslanishi kerak (429/limit xatosida queue'da kutish, refund EMAS). Enterprise verification
(yuridik shaxs) → 600 RPM / 10 concurrency.

## 6. Aktivatsiya / billing sharti

- Seedance 2.0 seriyasini yoqish uchun **oldindan prepaid resource pack sotib olish SHART**
  ("otherwise you cannot activate"). 500K bepul token banneri — TIL modellariga (Seed/DeepSeek),
  Seedance videoga EMAS.
- Narx (resource-pack, $/1M token): 2.0 → 720p $7 (video-input bilan $4.3) · 1080p $7.7/$4.7 ·
  fast → $5.6/$3.3. Token ≈ px·fps·s/1024. Birinchi invoice bilan tasdiqlansin.

## 7. Boshqa muhim faktlar

- **4k chiqish H.265/HEVC 10-bit** — brauzerda preview muammoli bo'lishi mumkin (Safari OK,
  Chrome conditional). Bizning transcode-preview quvuri baribir H.264 720p preview yasaydi — OK.
- **Kadr sakrashi fix:** i2v'da input rasm va output o'lchov nomuvofiq bo'lsa — `ratio:"adaptive"`
  yoki rasmni qo'llab-quvvatlanadigan o'lchamga crop (Create API hujjatidagi ratio jadvali).
- **Extend video:** 2–3 klip stitch qilish mumkin (`reference_video` bir nechta) — kelajakda
  "Extend" tool uchun tayyor imkon.
- **Prompt optimizatsiya SKILL.md** rasmiy berilgan (`/sd2-pe` uslubi) — bizning
  `/gen/prompt/enhance` uchun material sifatida ko'rib chiqilsin (keyingi faza).
- Poll namunalarda 10–30s interval; bizning ramp (600ms→2s) tez-tez so'raydi — video uchun
  intervalni kattalashtirish tavsiya (masalan 5–10s), MAX window 15s video uchun ≥10 daqiqa.

---

## 8. SEEDREAM (rasm) — KELAJAK faza uchun referens (BATCH5 SCOPE'IDA EMAS)

> Manba: Seedream 4.0–5.0 tutorial "Copy Page" (2026-07-11). Hozir rasm = Vertex (Imagen/Nano
> Banana). Seedream — narx/imkoniyat solishtirilib alohida faza sifatida qaraladi.

- **API SINXRON** (video kabi task/poll EMAS): `POST /images/generations` — OpenAI-mos
  (`client.images.generate`). Bir xil base URL + Bearer key.
- **Model ID'lar:** `dola-seedream-5-0-pro-260628` (interactive editing, 1K/2K, faqat 1 rasm) ·
  `seedream-5-0-260128` (lite; 2K/3K/4K, batch≤15, streaming) · `seedream-4-5-251128` ·
  `seedream-4-0-250828` (1K/2K/4K, fast prompt-mode).
- **Paramlar:** `prompt`, `image` (string yoki massiv — multi-ref), `size` ("2K" YOKI aniq
  "2048x2048"), `sequential_image_generation:"auto"` + `sequential_image_generation_options.
  max_images` (input ref + chiqish ≤15), `output_format` png/jpeg, `response_format` url/b64,
  `watermark` (bizda false), `stream`, `optimize_prompt_options.mode` (faqat 4-0'da "fast").
- **Input limitlar:** ref rasm ≤10 (5-0-pro) / ≤14 (qolganlar) · ≤30MB · ≤36MP · format keng
  (webp/heic ham). Chiqish URL 24h.
- **O'lcham berish 2 usul:** (1) aniq piksel `size:"2048x2048"` YOKI (2) tier `size:"2K"` +
  promptda tasvir. ASPECT NAZORATI uchun biz 1-usulni ishlatamiz — rasmiy nisbat→piksel jadvali:
  - **5.0 Pro 1K:** 1:1 1024x1024 · 4:3 1152x864 · 3:4 864x1152 · 16:9 1424x800 · 9:16 800x1424 ·
    3:2 1248x832 · 2:3 832x1248 · 21:9 1568x672
  - **5.0 Pro 2K:** 1:1 2048x2048 · 4:3 2368x1776 · 3:4 1776x2368 · 16:9 2816x1584 · 9:16 1584x2816 ·
    3:2 2496x1664 · 2:3 1664x2496 · 21:9 3136x1344
  - **5.0 Lite 2K:** 1:1 2048x2048 · 3:4 1728x2304 · 4:3 2304x1728 · 16:9 2848x1600 · 9:16 1600x2848 ·
    3:2 2496x1664 · 2:3 1664x2496 · 21:9 3136x1344
  - **5.0 Lite 4K:** 1:1 4096x4096 · 3:4 3520x4704 · 4:3 4704x3520 · 16:9 5504x3040 · 9:16 3040x5504 ·
    3:2 4992x3328 · 2:3 3328x4992 · 21:9 6240x2656
  (Pro piksel-diapazon: [1280x720, ~4.62MP]; Lite: [2560x1440, 16.7MP]; nisbat [1/16,16].)
- **NARX (konsolda TASDIQLANGAN, 2026-07-11, Dola-Seedream-5.0-Pro aktivlashdi — pack SHART EMAS,
  per-rasm postpaid):** output $0.045–0.090/rasm (1K–2K tier) · input rasm $0.0030/dona
  (birinchisi bepul) · IPM 500 · bepul kvota YO'Q. Taqqos: Vertex Nano Banana Pro 1K $0.10 —
  Seedream Pro 1K ($0.045) undan ~2× arzon; Imagen 4 ($0.04) bilan teng.
- **Diqqatga sazovor imkoniyatlar bizga:**
  - **Interactive editing (5-0-pro):** rasm ustiga chizilgan belgi/doodle bo'yicha aniq joyni
    tahrirlash — plagindagi "Draw" placeholder tool (faza-1) uchun TAYYOR backend nomzod!
  - **Batch/sequential** — storyboard/brand-set generatsiya (yangi mahsulot imkoniyati).
  - Seedream 5.0 Lite yuzli chiqishi Seedance'ga trusted-input bo'ladi (video hujjat §4).
