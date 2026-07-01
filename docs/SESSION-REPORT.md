# SESSION REPORT — 2026-07-01 — Video UX + Omni referens/deskriptor tuzatildi

Video pane UX (progress karta grid ichida, 20 daqiqa, non-blocking) + video gen tugmasi + Omni referens/deskriptor.

## Video pane UX (rasm+video)
- Gen-progress YUQORIdan olib tashlandi → So'nggi grid tepasida pending karta (0-100% shkala); done → o'sha joyda natijaga aylanadi. Non-blocking. afRecent.pendingCard/updatePending.
- Timeout: rasm UI POLL_CAP 670 (~20 daq); backend stuckTimeout hammasi 20 daq.

## Video gen tugmasi (matndan-video)
- refKind='frames' boshlang'ich kadrni MAJBURIY qilardi → Veo/Omni (text-to-video) tugmasi bloklanardi. `vm.startRequired=(feature==='image-to-video')` — faqat Seedance (i2v) kadr talab qiladi; Veo/Omni ixtiyoriy.

## Omni referens + deskriptor (foydalanuvchi xatosini tuzatish)
- **Referens ishlamasdi**: adapter faqat start kadrni ishlatardi. Endi `omniGenerateVideo` KO'P referens-rasm oladi (Omni = subject reference/i2v); runVertexOmniVideo start+end+referenceUrls hammasini uzatadi.
- **480p/Auto xato ko'rsatuv**: Omni'da `videoSettings` yo'q edi → pane default ko'rsatardi. Qo'shildi: 720p/10s qat'iy, audio; pricing per-generation (80 FLAT, 800 emas); maxRefs 3.
- Jonli sinov (prod): 2 referens bilan Omni video YARATILDI, narx 80. ✅

## KEYINGI (birin-ketin)
- Veo Lite/Std/Fast uchun ham videoSettings deskriptor + to'g'ri referens/frame semantikasi — foydalanuvchi hujjatlari yoki jonli sinov bilan (Omni tugadi).
- Model integratsiya ma'lumoti manbai: ai.google.dev/gemini-api/docs (Gemini/Omni/Nano Banana), cloud.google.com/vertex-ai/generative-ai/docs/models (Veo/Imagen), Model Garden "View Code".
