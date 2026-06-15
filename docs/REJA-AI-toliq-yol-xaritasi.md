# AI Tools — to'liq yo'l xaritasi (Higgsfield darajasi + ustun)

*Maqsad: Higgsfield darajasidagi to'liq AI suite + AssetFlow ustunligi (katalog-grounded).*
*Yondashuv: bosqichma-bosqich. Provayder: Cloudflare Workers AI (+ keyin boshqalar).*

## Realistik haqiqat — Workers AI nimani qamraydi
| Imkoniyat | Workers AI | Holat |
|---|---|---|
| Rasm (Flux) | ✅ bor | ishlaydi |
| Ovoz (TTS) | ✅ bor (MeloTTS...) | UI ulangan |
| Embeddings (qidiruv) | ✅ bor (bge-m3) | stub |
| Matn (prompt yordam, auto-tag) | ✅ bor (Llama) | keyin |
| SFX | 🟡 model tekshirish | tez orada |
| Video generatsiya | ❌ Workers AI'da kuchsiz | boshqa provayder (fal.ai/Kling) |
| Reframe / Upscale / Draw-to-Video | ❌ | boshqa provayder (fal.ai/Topaz) |

Ya'ni: **Rasm/Ovoz/Qidiruv/Matn = Workers AI (bepul, hozir).** Video/Reframe/Upscale = keyin, boshqa provayder (xarajat bilan).

---

## Bosqichlar (ustuvorlik)

### 0-bosqich — POYDEVOR: import mustahkamlash (HOZIR) 🔴
PNG fix (real format aniqlash + to'g'ri ext) + `canImportAs(FOOTAGE)` guard + undo +
structured natija (Higgsfield naqshi). Busiz hech narsa AE'ga to'g'ri tushmaydi.
*Holat: reja tasdiqlangan (docs/REJA-import-mustahkamlash.md 1-bosqich).*

### 1-bosqich — ASOSIY TOOLLAR to'liq ishlaydi (Workers AI)
- ✅ AI Rasm (Flux) — ishlaydi
- AI Ovoz (TTS) — to'liq test + AE import
- AI Qidiruv — embeddings (stub → real, pgvector yoki cosine)
- AI auto-tagging (contributor upload) — backend-only
- Kredit-gate, cost-estimate, xato-ishlovi — sayqal

### 2-bosqich — TIMELINE live-link (Higgsfield killer funksiyasi)
- `getActiveTimelineVideoReference` — tanlangan klipni AI input qilish
- `getActiveTimelineClipDetails` + `exportSourceRangeToTempFile` — trim eksport
- "Timeline'dan" tugmasi haqiqiy bo'ladi

### 3-bosqich — JOB + STATUS + ko'p-model
- Job-asosli async + SSE status (mavjud SSE ustiga)
- Model selektor — Workers AI'ning ko'p modeli (Flux variantlari, SDXL...)
- `image_auto` — avto model tanlash
- Reference rasm yuklash

### 4-bosqich — KENGAYTMA (boshqa provayderlar, xarajat bilan)
- Video generatsiya (fal.ai / Kling / Veo)
- Reframe (AI nisbat), Upscale (Topaz/fal), Draw-to-Video, Enhance
- Cinema Studio darajasi

### 5-bosqich — ASSETFLOW USTUNLIGI (Higgsfield qila olmaydi) ⭐
- **Template-grounded** — "shu shablon uchun" ovoz/rasm/matn (placeholder auto-fill)
- **Semantik katalog qidiruv** — "kosmik intro kerak" → mos shablonlar
- **Contributor AI** — auto-tag, auto-thumbnail, auto-preview

---

## Eslatmalar
- Workers AI bepul tier (~10k neuron/kun) — asosiy toollar arzon.
- Video/Reframe/Upscale — boshqa provayder + xarajat; daromad (kredit) bilan qoplanadi.
- Har bosqich: backend → UI ulash → AE test → commit. Bir bosqich tugamasdan keyingisiga o'tilmaydi.
- Import (0-bosqich) — hammasining poydevori, BIRINCHI.
