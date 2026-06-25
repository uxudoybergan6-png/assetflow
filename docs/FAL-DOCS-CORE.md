# FAL.AI — Core API Mexanikasi (AssetFlow Faza 2 ma'lumotnomasi)

> Manba: fal.ai developer docs (public). Yig'ilgan sana: 2026-06-24.
> Maqsad: AssetFlow plagin backend uchun `apps/api/src/lib/ai/fal.ts` adapterini qurish.
> Hujjatdagi barcha texnik atamalar inglizcha, izohlar o'zbekcha. Har bo'limda manba URL bor.

---

## 0. Adapter uchun xulosa (fal.ts qanday qurilishi kerak)

**Tavsiya etilgan oqim (rasm/video/ovoz generatsiyasi uchun):**

1. **Auth:** server-side `FAL_KEY` env'da saqlanadi. Har so'rovda header:
   `Authorization: Key $FAL_KEY`. Kalit HECH QACHON pluginga (client) yuborilmaydi —
   AssetFlow API o'zi proxy bo'ladi (kredit tizimi shu yerda).

2. **Submit (async queue):** `POST https://queue.fal.run/<model_id>` JSON body bilan model
   argumentlari (`prompt`, `image_url` va h.k.). Javobda `request_id` + `status_url` +
   `response_url` qaytadi. Bu `consumeAiCredits` dan keyin chaqiriladi (mavjud oqim).

3. **Natijani olish — 2 variant:**
   - **(A) Webhook (tavsiya, video/uzoq jobs uchun):** submit'da
     `?fal_webhook=https://assetflow-rqbq.onrender.com/api/.../fal-webhook` ber.
     fal tugagach POST qiladi. Webhook'ni IMZO (ED25519 + JWKS) bilan tekshir (5-bo'lim).
     `gen-processor.ts` job statusini shu yerda yangilaydi.
   - **(B) Poll (oddiy, rasm/tez jobs uchun):** `GET <status_url>` ni `COMPLETED` bo'lguncha
     interval bilan so'ra, keyin `GET <response_url>` natija olib keladi.
   - SDK ishlatilsa: `fal.subscribe()` (B'ni avtomatik qiladi) yoki `fal.queue.submit()` + webhook.

4. **Output → R2:** fal natija media URL'lari (`https://v3.fal.media/files/...`) PUBLIC va
   VAQTINCHALIK (default account sozlamasi, agar `forever` qilinmagan bo'lsa). **Biz darhol
   bu URL'dan media'ni yuklab olib R2'ga ko'chiramiz** (mavjud `s3.ts` orqali), so'ng AssetFlow
   CDN URL'ni saqlaymiz. fal CDN'ga uzoq muddat tayanma.

5. **Input (image-edit, image-to-video):** model'lar input'ni URL sifatida kutadi. Bizning R2
   public/presigned URL'larni to'g'ridan-to'g'ri `image_url` ga uzatish mumkin (presigned ishlaydi,
   chunki auth URL ichida). Yoki `data:` URI (faqat kichik fayllar). Yoki fal CDN'ga upload qilish.

6. **Kredit + refund:** mavjud `computeGenCost` / `consumeAiCredits` / `refundAiCredits` oqimi
   saqlanadi. fal **faqat muvaffaqiyatli output uchun** to'lov oladi (queue kutish va 5xx tekin) —
   shuning uchun job ERROR bo'lsa refund qil. Haqiqiy fal narxini `X-Fal-Billable-Units` response
   header'idan log qilib audit qilish mumkin.

**Qisqasi:** rasm uchun `subscribe`/poll; video va uzoq jobs uchun `submit + webhook`. Auth server-side.
Output media darhol R2'ga. Error_type bo'yicha retry/refund qaror.

---

## 1. Authentication

**Manba:** https://fal.ai/docs/documentation/setting-up/authentication/index.md

- API key formatida `FAL_KEY` env-variable orqali uzatiladi. SDK uni avtomatik o'qiydi.
- **HTTP header:** `Authorization: Key $FAL_KEY` (e'tibor: `Bearer` EMAS, `Key`).
- Kalit **account'ga** bog'langan (shaxsga emas); team ichida barcha a'zolar bir kalitni baham ko'radi.
- **Key scopes:**
  - `API` — har qanday model chaqirish + API-scoped Platform APIs (bizga shu yetadi).
  - `ADMIN` — yuqoridagilar + CLI (`fal deploy`, `fal run`), app boshqaruvi (bizga kerak emas).
- Xavfsizlik: kalitni kodga hardcode qilma, env-variable ishlat. Client-side ilovada kalitni
  bevosita ko'rsatma — proxy ishlat (AssetFlow API aynan shu proxy rolini bajaradi).
- Test: `curl -X POST "https://fal.run/fal-ai/flux/schnell" -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" -d '{"prompt":"a cute cat"}'`

> AssetFlow uchun: `FAL_KEY` ni Render env'ga qo'sh. Plugin hech qachon kalitni ko'rmaydi.

---

## 2. Inference — Asynchronous (Queue)

**Manba:** https://fal.ai/docs/documentation/model-apis/inference/queue.md

**Tavsiya etilgan usul.** Base URL: `https://queue.fal.run/<model_id>`.

### Request lifecycle (status enum)
| Status | Ma'no |
|--------|-------|
| `IN_QUEUE` | Qabul qilindi, runner kutilmoqda (`queue_position` bor) |
| `IN_PROGRESS` | Runner ishlayapti (logs bor) |
| `COMPLETED` | Natija tayyor (`response_url`'dan olinadi yoki webhook'ga yuboriladi) |

### Submit
- `POST https://queue.fal.run/<model_id>` + JSON body (model argumentlari).
- Javob:
  ```json
  {
    "request_id": "764cabcf-...",
    "response_url": "https://queue.fal.run/.../requests/<id>/response",
    "status_url":   "https://queue.fal.run/.../requests/<id>/status",
    "cancel_url":   "https://queue.fal.run/.../requests/<id>/cancel",
    "queue_position": 0
  }
  ```
- `request_id` ni saqlab qo'y — boshqa process'dan ham status/natija olish mumkin.

### Status (poll)
- `GET <status_url>?logs=1` (`logs=1` runner loglarini qo'shadi).
- COMPLETED javobida `metrics.inference_time` bor; xato bo'lsa `error` (human) + `error_type` (machine).
- SSE stream variant: `GET <status_url>/stream?logs=1` → `text/event-stream`, COMPLETED'ga qadar ochiq.

### Result
- `GET https://queue.fal.run/<model_id>/requests/<request_id>` (yoki `<response_url>`).
- Natija strukturasi **model'ga xos.** Misol (rasm):
  ```json
  { "images": [{ "url": "https://v3.fal.media/files/.../abc.png",
                 "width":1024, "height":1024, "content_type":"image/png" }],
    "seed": 42, "has_nsfw_concepts":[false] }
  ```
- Video model → `video` obyekt; audio → `audio_url`/`audio`. Aniq schema model API sahifasida.

### Cancel
- `PUT <cancel_url>`. IN_QUEUE bo'lsa darhol o'chadi; IN_PROGRESS bo'lsa signal yuboriladi
  (app cancel'ni implement qilmasa, baribir tugashi mumkin).
- `202 CANCELLATION_REQUESTED` / `400 ALREADY_COMPLETED` / `404 NOT_FOUND`.

### Muhim kafolatlar
- Queue'da so'rovlar **yo'qolmaydi**, limit yo'q. Runner fail bo'lsa (503/504/connection)
  avtomatik **10 martagacha retry** qilinadi. Retry'ni o'chirish: `X-Fal-No-Retry: 1`.

### Muhim parametrlar (header sifatida ham)
- `start_timeout` (`X-Fal-Request-Timeout`, sekund): runner BOSHLANISHIGA qadar deadline
  (queue+retry'ni qamraydi). Inference vaqtini cheklamaydi. Oshsa `504` + `X-Fal-Request-Timeout-Type: user`.
- `client_timeout` (Python) / `timeout` ms (JS) — **faqat subscribe'da**: client umumiy kutish deadline'i.
- `priority`: `"normal"` (default) / `"low"`. Low — shared endpoint'da BOShqa barcha userlar ortida turadi.
- `hint` (`X-Fal-Runner-Hint`): session affinity (bir xil runner'ga yo'naltirish).
- `webhook_url`: natija sizning serveringizga POST qilinadi (4-bo'lim).

---

## 3. Inference — Synchronous (`run` vs `subscribe`)

**Manba:** https://fal.ai/docs/documentation/model-apis/inference/synchronous.md

Ikki bloking usul (oddiy, prototip/skript uchun):

- **`run` (direct):** `https://fal.run/<model_id>` ga to'g'ridan HTTP. **Queue yo'q**, status poll yo'q,
  natija o'sha connection'da qaytadi. Faqat SDK-darajadagi transient HTTP retry (502/503/504),
  **server-side queue retry YO'Q**. Eng tez yo'l, lekin reliability past.
- **`subscribe` (queue-backed):** ichida queue ishlatadi, poll'ni avtomatik qiladi → bloking
  interfeys + avtomatik retry + scaling. **Production-da `run`'dan ko'ra `subscribe` tavsiya etiladi.**

Foydali `subscribe` callback'lari:
- `on_enqueue` — queue'ga tushishi bilan `request_id` ni beradi (DB'ga saqlash uchun).
- `on_queue_update` — har poll'da status (Queued/InProgress/Completed) keladi (progress UI uchun).
- `with_logs`/`logs` — runner loglarini qo'shadi.

**Parallel ish / webhook / to'liq queue kuzatuv kerak bo'lsa → async queue (2-bo'lim) ishlat.**

> AssetFlow uchun: tez rasm jobs → `subscribe`; uzoq video/audio → `submit + webhook`.

---

## 4. Webhooks

**Manba:** https://fal.ai/docs/documentation/model-apis/inference/webhooks.md

- Queue bilan ishlaydi: poll o'rniga fal natijani sizning URL'ingizga POST qiladi.
- Berish: submit'da `webhook_url=...` (SDK) yoki cURL: `?fal_webhook=https://your-server/...`.
- Submit javobi: `{ "request_id": "...", "gateway_request_id": "..." }`.
  Odatda bir xil; retry bo'lsa `gateway_request_id` oxirgi urinishni, `request_id` queue API qiymatini bildiradi.

### Webhook payload (POST sizning serveringizga)
**Muvaffaqiyat:**
```json
{ "request_id":"...", "gateway_request_id":"...", "status":"OK",
  "payload": { "images":[{"url":"https://url.to/image.png","content_type":"image/png",
               "file_name":"image.png","file_size":1824075,"width":1024,"height":1024}],
               "seed": 196619188014358660 } }
```
**Xato:** `"status":"ERROR"` + `"error"` (xabar) + `"payload"` (detallar, masalan 422 validation).
**Payload serialize bo'lmasa:** `"payload": null` + `"payload_error": "..."`.

> Diqqat: webhook `status` faqat `"OK"` / `"ERROR"` (bu queue'ning `IN_QUEUE/IN_PROGRESS/COMPLETED`'idan FARQ qiladi).

### Retry policy
- Initial delivery timeout: **15 soniya.** Fail/timeout bo'lsa **2 soat ichida 10 marta** retry.
- **Handler IDEMPOTENT bo'lishi shart** — bir `request_id` bir necha marta kelishi mumkin.
- 200'ni TEZ qaytar (ack). Og'ir ishni keyinroq qil.

### Xavfsizlik — IMZO tekshiruvi (MAJBURIY)
**Algoritm: ED25519 + JWKS (public keys).**

1. **JWKS olish:** `GET https://rest.fal.ai/.well-known/jwks.json`. Har kalitda `x` (base64url ED25519
   public key). **24 soatgacha cache** qil (ortig'i mumkin emas — kalitlar o'zgarishi mumkin).
2. **Header'lar (hammasi bo'lishi shart):**
   - `X-Fal-Webhook-Request-Id`
   - `X-Fal-Webhook-User-Id`
   - `X-Fal-Webhook-Timestamp` (Unix epoch sekund)
   - `X-Fal-Webhook-Signature` (hex)
3. **Timestamp tekshiruvi:** hozirgi vaqtdan ±300 sekund (5 daqiqa) ichida bo'lsin (replay himoyasi).
4. **Message qurish:** quyidagilarni `\n` bilan birlashtir (qat'iy tartibda), UTF-8 bytes:
   `request_id` + `\n` + `user_id` + `\n` + `timestamp` + `\n` + `hex(SHA256(raw_body))`.
   (body — XOM bytes, JSON-parse qilinmagan!)
5. **Verify:** `X-Fal-Webhook-Signature` ni hex→bytes; JWKS'dagi HAR kalit uchun ED25519 verify
   (PyNaCl / libsodium). Birortasi to'g'ri kelsa — valid; hech biri kelmasa — invalid.

> Express'da `express.raw({ type: 'application/json' })` ni JSON parse'dan OLDIN ishlat (xom body kerak).
> AllowList kerak bo'lsa webhook IP'lar: `GET https://api.fal.ai/v1/meta` → `webhook_ip_ranges` (o'zgaradi, vaqti-vaqti yangilab tur).

---

## 5. Errors

### 5a. Request errors (infrastructure)
**Manba:** https://fal.ai/docs/documentation/model-apis/request-errors.md

Format: flat obyekt — `{ "detail": "Request timed out", "error_type": "request_timeout" }`.
Bir xil qiymat `X-Fal-Error-Type` response header'da ham bor (body parse qilmasdan o'qish uchun).

| error_type | Status | Retry? |
|------------|--------|--------|
| `request_timeout` | 504 | ha (transient) |
| `startup_timeout` | 504 | ha |
| `runner_scheduling_failure` | 503 | ha |
| `runner_connection_timeout` | 503 | ha |
| `runner_disconnected` | 503 | ha |
| `runner_connection_refused` | 503 | ha |
| `runner_connection_error` | 503 | ha |
| `runner_incomplete_response` | 502 | ha |
| `runner_server_error` | 500 | ha |
| `client_disconnected` | 499 | yo'q |
| `client_cancelled` | 499 | yo'q |
| `bad_request` | 400 | yo'q (malformed) |
| `internal_error` | 500 | ehtiyot |

> Retry qarori: runner/timeout xatolari transient — qayta urin. Client xatolari (`bad_request`,
> `client_disconnected`) — qayta urinma. Platforma o'zi 10 martagacha avtomatik retry qiladi.

### 5b. Model errors (validation / content)
**Manba:** https://fal.ai/docs/documentation/model-apis/errors.md

Format: `detail` — typed error obyektlar MASSIVI. Har biri: `loc`, `msg` (faqat ko'rsatish uchun,
parse qilma), `type` (machine-readable — shu bilan logic qil), `url`, ixtiyoriy `ctx`/`input`.
`X-Fal-Retryable` header retry qarorini beradi.

Asosiy `type` qiymatlari (ko'pi `422`, `retryable: false`):
- `content_policy_violation` (422) — NSFW/taqiqlangan kontent (fal yoki partner filtri). **Pluginda
  userga aniq xabar ko'rsat, refund qil.**
- `no_media_generated` (422) — model output bermadi → refund.
- `file_download_error` (422) — input URL yuklab bo'lmadi (private/auth wall). **R2 URL public/presigned bo'lsin!**
- `image_too_small` / `image_too_large` (`ctx`: min/max_height/width), `image_load_error`,
  `unsupported_image_format` / `unsupported_video_format` / `unsupported_audio_format` (`ctx.supported_formats`).
- `file_too_large` (`ctx.max_size` bytes), `video_duration_too_long/short`, `audio_duration_too_long/short`.
- Numeric: `greater_than`/`greater_than_equal`/`less_than`/`less_than_equal`/`multiple_of`/`one_of` (`ctx`'da limit).
- `generation_timeout` (504), `internal_server_error` (500), `downstream_service_error/unavailable`
  (partner API muammosi).

> Eslatma: ba'zi endpoint'lar hali bu formatga to'liq migratsiya qilinmagan.

---

## 6. Pricing & Billing

**Manba:** https://fal.ai/docs/documentation/model-apis/pricing.md

- **Output-based billing.** Har model o'z billing unit'iga ega:
  - **Rasm:** per-image yoki per-megapixel (yuqori resolution → proporsional qimmat).
  - **Video:** per-second yoki flat per-video.
  - **Boshqa (LLM/audio):** per-request yoki output unit'iga.
  - Fixed narxi yo'q model'lar → GPU machine-type bo'yicha **per-second** (fallback).
- **Prepaid credit model:** oldindan kredit sotib olasan, ishlatilgani yechiladi. Kredit hajmi
  **concurrency limit**'ga ham ta'sir qiladi (xarid tarixi bo'yicha o'sadi).
- **Nima uchun TO'LAMAYSAN:** server xatolari (HTTP ≥500) — tekin; queue kutish vaqti — tekin.
  **Faqat haqiqiy inference / muvaffaqiyatli output uchun to'laysan.**
- **Dasturiy narx so'rash:**
  `GET https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/flux/dev -H "Authorization: Key $FAL_KEY"`
  → `{ "prices":[{ "endpoint_id":"...", "unit_price":0.025, "unit":"image", "currency":"USD" }] }`.
- Response'da `X-Fal-Billable-Units` header haqiqiy charge qilingan unit'ni beradi (audit/sverka uchun).

> AssetFlow uchun: o'z kredit narxlarimizni (`gen-models.ts`) fal `unit_price` ustiga margin bilan
> qo'yamiz. Fal'dan ERROR kelsa userni charge qilmaymiz (refund) — fal ham bizni charge qilmaydi.

---

## 7. Platform Headers + Common Arguments

**Manba:** https://fal.ai/docs/documentation/model-apis/common-parameters.md

**Request header'lar (so'rovni boshqaradi):**
| Header | Ma'no |
|--------|-------|
| `X-Fal-Request-Timeout` | start_timeout (sek); runner boshlanishi deadline'i |
| `X-Fal-Runner-Hint` | routing hint (session affinity) |
| `X-Fal-Queue-Priority` | `normal`/`low` |
| `X-Fal-Object-Lifecycle-Preference` | media CDN saqlash muddati JSON: `{"expiration_duration_seconds": N}` (yoki null=forever) |
| `X-Fal-Store-IO` | `0` → JSON payload'larni saqlama (default `1`, 30 kun) |
| `X-Fal-No-Retry` | `1`/`true`/`yes` → avtomatik retry o'chir |
| `x-app-fal-disable-fallback` | model fallback'ni o'chir |
| `fal_max_queue_length` (QUERY param) | queue N'dan oshsa `429` qaytar (fail-fast) |

**Response header'lar (fal qaytaradi):**
| Header | Ma'no |
|--------|-------|
| `x-fal-request-id` | unique request ID (support/log korrelyatsiya) |
| `X-Fal-Billable-Units` | charge qilingan billing units |
| `X-Fal-Served-From` | runner identifikatori |
| `X-Fal-Request-Timeout-Type` | `user` → sizning start_timeout 504 chiqardi |
| `X-Fal-Error-Type` | fail'da error kategoriyasi |

> Diqqat: barcha response header'lar yig'indisi **16 KB** bilan cheklangan.
> Common model arguments (seed, image_size, safety checker) alohida sahifa:
> https://fal.ai/docs/documentation/model-apis/model-arguments (har model API sahifasida aniq schema).

---

## 8. fal CDN — Output & Input URL'lar

**Manba:** https://fal.ai/docs/documentation/model-apis/fal-cdn.md
**Bog'liq (retention):** https://fal.ai/docs/documentation/model-apis/media-expiration.md

- Model'lar fayl input'larini **URL** sifatida qabul qiladi; output'lar ham CDN URL bo'lib qaytadi.
- **CDN URL formati:** `https://v3.fal.media/files/{path}` (fallback host: `fal.media`).
- **Access:** CDN URL'lar **PUBLIC** — yuklab olish uchun auth kerak emas, URL bilgan har kim ochadi.
- **Muddat (MUHIM):** media retention **sozlanadi**. Default = account sozlamasi
  (agar konfiguratsiya qilinmagan bo'lsa "forever", lekin tayanma — per-request boshqarish mumkin).
  Per-request: `X-Fal-Object-Lifecycle-Preference: {"expiration_duration_seconds": N}`.
  **Muddati o'tgan fayl butunlay o'chiriladi, qaytarib bo'lmaydi.**
  → **AssetFlow QOIDASI: natija media'ni darhol yuklab olib R2'ga ko'chir, fal CDN'ga uzoq tayanma.**

### Input berish usullari (image-edit / image-to-video uchun)
1. **Tashqi URL (tavsiya):** R2/S3/GCS presigned yoki public URL'ni to'g'ridan `image_url` ga ber.
   Presigned ishlaydi (auth URL ichida). **Private (Authorization header talab qiladigan) URL ISHLAMAYDI**
   → `file_download_error`. R2 URL'ni public yoki short-expiry presigned qil.
2. **fal CDN upload:** `fal_client.upload_file(path)` / `fal.storage.upload(file)` →
   `https://v3.fal.media/files/...` URL qaytaradi. Bir marta upload, ko'p marta reuse.
   Katta fayllar: avtomatik multipart (10 MB chunk; threshold ~90-100 MB; 10 martagacha retry).
3. **Data URI:** `data:image/png;base64,...` — faqat KICHIK fayllar uchun (payload shishadi, tavsiya etilmaydi).

### Request payload retention
- JSON input/output **30 kun** saqlanadi (dashboard history uchun). O'chirish: `X-Fal-Store-IO: 0`.
- Request payload + output CDN fayllarini Platform API orqali o'chirish mumkin
  (input CDN fayllari o'chmaydi — boshqa request'lar ishlatishi mumkin).

| Data turi | Default retention | Boshqaruv |
|-----------|-------------------|-----------|
| Generated media (CDN) | Configurable | `X-Fal-Object-Lifecycle-Preference` |
| Request payloads (JSON) | 30 kun | `X-Fal-Store-IO: 0` yoki delete API |

---

## 9. File upload / Input formatlari (qisqa jadval)

**Manba:** fal-cdn.md (yuqorida, 8-bo'lim)

| Usul | Qachon | Eslatma |
|------|--------|---------|
| Tashqi public/presigned URL | R2'da fayl bor | Eng oson, AssetFlow uchun asosiy. Auth header'siz ochilsin. |
| fal CDN upload | Lokal fayl/bytes | `upload_file`/`upload`/`storage.upload`; multipart avtomatik |
| Data URI (base64) | Juda kichik fayl | Payload shishadi, katta fayllar uchun MAS |

Model-specific limitlar (size/format/duration) processing vaqtida tekshiriladi → 5b'dagi
`image_too_large`, `unsupported_*_format`, `*_duration_too_*` xatolari. Har model API sahifasida aniq.

---

## Yig'ilgan manba sahifalar (9 ta asosiy + indeks)

1. authentication/index.md
2. inference/queue.md
3. inference/synchronous.md
4. inference/webhooks.md
5. request-errors.md
6. errors.md
7. pricing.md
8. fal-cdn.md
9. common-parameters.md
10. media-expiration.md
(+ llms.txt indeks)

*Yangilangan: 2026-06-24 (Claude Code sessiyasi).*
