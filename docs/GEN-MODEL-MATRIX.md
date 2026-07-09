# GEN MODEL MATRIX — avtoritativ per-model imkoniyat jadvali (PROBLEM 8)

> Manba: `apps/api/src/lib/gen-models.ts` (katalog) + `gen-processor.ts` + `ai/*.ts`
> (adapterlar) + provider hujjatlari, kod-tasdiqlangan (2026-07-09). Bu hujjat
> UI (web + plagin) qaysi kontrollarni ko'rsatishi va har param qaysi provider
> maydoniga borishining YAGONA haqiqat manbai.

## 1. Yoqilgan modellar (12 ta)

`enabled !== false` (gen-models.ts:995-997). Boshqa hamma model (fal/openrouter
image 1001-1110, magnific 120x, 3004-3007) — `enabled:false`, UI ko'rsatmaydi.

### RASM — hammasi provider `vertex-image`, feature `text-to-image`

| id | label | ref | aspects | quality (resolutions) | count | eslatma |
|---|---|---|---|---|---|---|
| 1010 | Nano Banana 2 (default) | image-edit, maxRefs **10** | 1:1,2:3,3:2,3:4,4:3,16:9,9:16,21:9 | 1K/2K/4K (qualityCost bor) | 1-4 | imgModalities image+text |
| 1013 | Nano Banana 2 Lite | image-edit, maxRefs 10 | NANO to'plami | **faqat 1K** (imgSettings YO'Q) | 1-4 | flat cost |
| 1014 | Nano Banana Pro | image-edit, maxRefs 10 | NANO to'plami | 1K/2K/4K (qualityCost) | 1-4 | |
| 1011 | Imagen 4 | **referens YO'Q** (none) | 1:1,3:4,4:3,16:9,9:16 | 1K/2K | 1-4 | route ref yuborilsa RAD etadi |
| 1012 | Imagen 4 Ultra | referens YO'Q | IMAGEN to'plami | 1K/2K | 1-4 | |

Provider mapping (vertex-image.ts): aspect → Imagen `generateImages config.aspectRatio` /
Gemini `imageConfig.aspectRatio`; quality → `imageSize` (1K/2K/4K filtr); count → N ta
parallel chaqiruv (`numberOfImages:1`); referenslar → `contents[0].parts[]` inlineData
base64, TARTIB saqlanadi (gen-processor.ts:910-918).

### OVOZ / SFX

| id | label | mode | provider yo'li | kontrollar |
|---|---|---|---|---|
| 2001 | Kokoro TTS | voice | OpenRouter `/audio/speech` | `voices`: af_bella,af_nova,af_sarah,am_adam,am_onyx,bf_emma; languages ["English"]; `params.voice` → `voice`, prompt → `input`, format mp3 |
| 4001 | ElevenLabs SFX | sfx | elevenlabs.ts | `durations:[3,5,10]` → `params.duration` → `duration_seconds` (adapter 0.5-22s klamp); prompt → `text` |

### VIDEO

| id | label | provider/feature | ref | start/end | aspects | res | dur | audio | boshqa |
|---|---|---|---|---|---|---|---|---|---|
| 3001 | Veo 3.1 Lite (default) | vertex / t2v | ixtiyoriy rasm ref | start ✓ / **end ✓** | 16:9, 9:16 | 720p | 4,6,8 | **false** | |
| 3002 | Veo 3.1 Fast | vertex / t2v | ixtiyoriy | start ✓ / end ✓ | 16:9, 9:16 | 720p,1080p | 4,6,8 | **false** | |
| 3003 | Veo 3.1 | vertex / t2v | ixtiyoriy | start ✓ / end ✓ | 16:9, 9:16 | 720p,1080p | 4,6,8 | **true (default on)** | |
| 3010 | Gemini Omni Flash | vertex-omni / t2v | **media-refs** img≤3, vid≤2, audio 0, **total 3** | end YO'Q | 16:9, 9:16 | 720p (kosmetik) | [10] (kosmetik) | true, **audioLocked** | per-generation narx; video ref bo'lsa aspect YUBORILMAYDI (`aspectIgnoredWithVideoRef`) |
| 3101 | Seedance 2.0 Fast | fal / i2v | start **MAJBURIY** (frames) | start ✓ / end ✓ | auto,21:9,16:9,4:3,1:1,3:4,9:16 | 480p,720p | 4-12,15 + Auto(4) | true (def off) | |
| 3102 | Seedance 2.0 R2V (WEB only) | fal / reference-to-video | media-refs img≤9, vid≤3, aud≤3, total 12 | yo'q | auto+6 | 480p,720p,1080p,4k | 4-15 + Auto | true (def off) | `bitrate {standard,high}` → `bitrate_mode`; video ref → perSec ×0.6 |

Video provider mapping:
- **Veo (vertex.ts)**: ref → `image{imageBytes,mimeType}`; end → `config.lastFrame` (faqat start bor bo'lsa; route end-without-start 400); aspect → `config.aspectRatio`; duration → `durationSeconds` (raqam); audio → `generateAudio`; res → `config.resolution`.
- **Seedance Fast (fal, buildFalVideoInput)**: start → `image_url`, end → `end_image_url`, res → `resolution`, dur → `duration` (**string**), aspect → `aspect_ratio`, audio → `generate_audio`.
- **Seedance R2V (fal)**: `imageUrls/videoUrls/audioUrls` → `image_urls/video_urls/audio_urls` (limitlar server'da kesiladi, total tekshiriladi); `bitrateMode` → `bitrate_mode`; `end_user_id` qo'shiladi.
- **Omni (vertex-omni.ts)**: barcha rasm ref (referenceUrl+referenceEndUrl+imageUrls) → `input[]` base64; video → base64 (≤15MB) yoki gs:// URI; duration/resolution/audio API'ga YUBORILMAYDI (mavjud emas); video ref bo'lsa `response_format.aspect_ratio` tushiriladi.

## 2. Kod-tasdiqlangan MISMATCH'lar (backend)

| # | muammo | joy | holat |
|---|---|---|---|
| C1 | `params.audio` model `audio:false` bo'lsa ham klamplanmaydi → Veo Lite/Fast'da audio-on so'rash mumkin (narx audio-off) | gen-models.ts:1091-1096 | ✅ TUZATILDI (P8): resolveVideoParams endi videoSettings.audio yo'q modelda false'ga majburlaydi |
| C2 | Omni `mediaRefs.total:3` server'da tekshirilmaydi (img3+vid2=5 ketishi mumkin) | gen-processor.ts:716-719 | ✅ TUZATILDI (P8): total slice qo'shildi |
| C3 | `maxRefs` server'da hech qayerda enforce qilinmaydi (50 ref yuborsa hammasi ketadi) | gen-processor.ts:884-918 | ✅ TUZATILDI (P8): vertex/fal ref ro'yxatlari maxRefs bilan kesiladi |
| C5 | SFX `durations:[3,5,10]` enforce yo'q (0.5-22 har qanday qiymat) | gen-processor.ts:969-976 | qabul qilindi — narx flat, adapter klampi yetarli (UI faqat 3/5/10 taklif qiladi) |
| C6 | Kokoro `voices` ro'yxati validatsiya qilinmaydi | gen-processor.ts:959-961 | ✅ TUZATILDI (P8): katalog voices bilan tekshiriladi, noto'g'ri → default |
| C7 | Omni'ga `referenceEndUrl` yuborilsa oddiy rasm ref bo'lib ketadi (endFrame:false) | gen-processor.ts:709 | hujjatlashtirildi — ataylab (backwards-compat); UI Omni'da End quti ko'rsatmasligi SHART |
| C9 | Seedance aspects 'auto' (kichik) vs UI options 'Auto' (katta) — pickStr case-sensitive, prefer-fallback tasodifan qutqaradi | gen-models.ts:915,960 | KECHIKTIRILDI → PROBLEM 10 validatori (pickStr resolveVideoParams cost yo'liga yaqin — money-zone ehtiyoti; ikkala UI ham to'g'ri case yuboradi) |
| C10 | FAL-DOCS-MODELS.md Seedance v1'ni hujjatlaydi; joriy 2.0 maydonlari AI-API-AUDIT.md'da tasdiqlangan (PASS) | docs | eslatma — kod to'g'ri |
| C11 | feature='reference-to-video' dispatch provider'dan OLDIN → kelajak non-fal R2V fal'ga ketadi | gen-processor.ts:988-990 | PROBLEM 10 scope (validator + doc) |
| C4 | mediaRefMaxBytes/Formats faqat deklaratsiya (UI uchun) | — | UI ishlatadi; server fal xato remap qiladi |

## 3. Server o'qiydigan params (to'liq ro'yxat)

`aspectRatio, quality, count, referenceUrl, referenceUrls, referenceEndUrl,
imageUrls, videoUrls, audioUrls, resolution, duration, audio, bitrateMode, voice`
(+ ichki `__providerJob/__providerWebhook`, route'da `savedReferenceIds`).

## 4. Web UI holati (kod-tasdiqlangan, platform/index.html)

**Katalog-driven (yaxshi):** aspects/quality/count/resolutions/durations/voices chip'lari
model maydonlaridan (18099-18185); buildParams (17806-17836) klamp bilan; model-ID bo'yicha
if/else YO'Q. Narx preview estCost computeGenCost bilan mos (DB ModelPricing override'dan
tashqari — kosmetik, haqiqiy narx imzolangan quote'dan).

**Topilgan GAPlar (tuzatishdan oldin):**
| # | gap | dalil |
|---|---|---|
| W1 | End frame UI YO'Q (Veo×3 + Seedance Fast endFrame:true), referenceEndUrl hech qachon yuborilmaydi | 17826 |
| W2 | Audio toggle YO'Q — params.audio yuborilmaydi (Veo 3.1 doim ON, Seedance doim OFF, user o'zgartira olmaydi) | buildParams |
| W3 | media-refs (Omni 3010, R2V 3102) UI YO'Q — imageUrls/videoUrls/audioUrls yuborilmaydi; refModelOk faqat 'frames' | 17961-17963 |
| W4 | Seedance Fast refMode:'required' ko'rsatilmaydi — prompt-only Generate 400 REFERENCE_REQUIRED toast bilan yiqiladi | 17862+ |
| W5 | Rasm multi-ref yo'q (maxRefs 10, web 1 ta yuboradi) | 17819 |
| W6 | Diskdan referens yuklash = STUB ("coming soon" toast); /gen/ref-upload ishlatilmaydi | 18892 |
| W7 | Ref slot Imagen'da ham ko'rinadi (referenceMode none) | 18788 |
| W8 | videoSettings o'qilmaydi: duration 'Auto' yo'q, default durations[0] (4s, def 8s/Auto emas), bitrate (R2V) yo'q | 17821-17824 |

## 5. Plagin UI holati (kod-tasdiqlangan, AssetFlow_Plugin.html)

**Katalog-driven (yaxshi):** image setModel imgSettings deskriptoridan (10041-10081);
video applyModelSettings/vgCapsFor videoSettings+refKind+endFrame+audioLocked dan
(11332-11383); frames oqimi to'liq ishlaydi (start/end → referenceUrl/referenceEndUrl).

**Topilgan GAPlar (tuzatishdan oldin):**
| # | gap | dalil |
|---|---|---|
| P1 | VOICE (2001) va SFX (4001) tool'lari UMUMAN YO'Q — plaginda mode:'voice'/'sfx' POST yo'q; launcher Audio kartani yashiradi; Home esa "Image · Video · Voice & SFX" deb reklama qiladi | 9613-9655, 3867 |
| P2 | Audio toggle audio:false modellarda ham bosiladi (Veo Lite/Fast) — audioSupported gating yo'q | 11612-11617 |
| P3g | Video default modeli fal[0] (katalog tartibi), isDefault e'tiborsiz (image'da bor) | 11435 |
| P4 | Launcher Image karta matni eskirgan: "GPT Image 2 · Nano · Flux · Seedream" (real: Nano Banana + Imagen) | 9614-9616 |
| P5 | Quality label katalogdan "Sifat" (o'zbekcha) — English UI qoidasiga zid | gen-models label |
| P6 | Image meta pre-load defaults GPT-era (label 'GPT Image 2 Edit') | 9945-9947 |
| P7 | HTML boshlang'ich qiymatlar defaultlarga zid (vgResVal 720p vs 480p...) — birinchi load'da tuzatiladi, kosmetik | 4171 |

## 6. Gap/tuzatishlar jurnali (2026-07-09 P8 fix)

- Backend: C1 audio-klamp, C2 Omni total, C3 maxRefs kesish, C6 voice validatsiya (pastda).
- A (rasm): W5+W6 (web ko'p-ref + real yuklash), W7 (Imagen ref yashirish); plagin P4/P5/P6.
- B (video): W1 (end frame), W2 (audio toggle), W4 (required-start gate), W8 (Auto/def/bitrate),
  W3 (media-refs UI — Omni + R2V, web'da); plagin P2, P3g.
- C (audio): plagin P1 (Voice + SFX tool'lari quriladi); web voice/sfx allaqachon katalog-mos.
