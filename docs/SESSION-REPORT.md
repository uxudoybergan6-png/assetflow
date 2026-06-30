# SESSION REPORT — 2026-06-30 — Enhance META blok bug tuzatildi

Muammo: "Yaxshilash" (prompt enhance) prompt matniga META blok qo'shardi — "**Video Prompt:**" sarlavha + "**Target Model / Duration / Aspect Ratio / Resolution/Quality / Native Audio**" qatorlari. Bu fal modelga matn bo'lib ketardi (shovqin) va qiymatlari UI sozlamalariga zid edi (LLM 8s/4k dedi, UI 5s/480p).

Sabab: `studio-gen.ts` enhance `ctx` LLM'ga "target model / duration options / aspect ratios / resolution / native audio" ro'yxatini berib "tailor the prompt to it" derdi → LLM uni labeled blok qilib qaytarardi.

2 qatlamli tuzatish:
- **Backend** (`apps/api/src/routes/studio-gen.ts`): sozlamalar-konteksti olib tashlandi; o'rniga aniq ko'rsatma — "FAQAT tavsifiy prompt qaytar; sarlavha/label/META (Video Prompt/Target Model/Duration/Aspect/Resolution/Quality/Native Audio) YOZMA — ular UI'da". tsc ✓.
- **Frontend** (`AssetFlow_Plugin.html`): xavfsizlik to'ri — `afCleanEnhancedPrompt()` boshidagi "Video Prompt:" sarlavhasi va oxiridagi META blokini olib tashlaydi; image+video enhance natijalariga qo'llandi. node ✓. Test: META ketdi, @Image1/@Image2 referenslar saqlandi.

Kutilmoqda: push (Render deploy — backend o'zgargani uchun MUHIM) + AE jonli test (Yaxshilash → faqat tavsif chiqishi).
