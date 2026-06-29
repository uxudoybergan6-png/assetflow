# SESSION REPORT — 2026-06-29 — Enhance pricing + audio-aware prompt improve

- `Yaxshilash` endi bitta tekis 1 kredit emas: backend ishlatilgan modalga qarab dinamik kredit oladi.
- Yangi hisob: `text=1`, `+image=+1`, `+video=+2`, `+audio=+1` → masalan `text+video=3`, `text+image+video+audio=5`.
- Video tool `Yaxshilash` endi `audio_urls` ham yuboradi; oldin faqat `image_urls` va `video_urls` bor edi.
- Backend `falEnhancePrompt` ichida audio referens bo‘lsa avval `nvidia/nemotron-3-nano-omni/audio` bilan audioni promptga foydali matnli tahlilga aylantiradi.
- Keyin shu audio tahlili mavjud promptga qo‘shilib, rasm/video bo‘lsa `openrouter/router/vision` yoki `openrouter/router/video` bilan yakuniy prompt boyitiladi.
- Audio referenssiz foydalanuvchi audio uchun kredit to‘lamaydi; audio ishlatilsa va tahlil bo‘lsa shundagina qo‘shimcha kredit olinadi.
- Frontend toast endi `Yaxshilash` qancha kredit olganini ko‘rsatadi (`✦N`).
- Tekshiruv: `npm run build -w apps/api` OK.
- Tekshiruv: plugin script parse `OK 15`.
