# SESSION REPORT — 2026-06-19 — H1 video-to-prompt aniqligi + H2 generatsiya sodiqligi

## H1 — "Tasvirdan" HAQIQIY video yuboradi (commit 0b93189)
- Tasdiqlangan: OpenRouter video format `{"type":"video_url","video_url":{"url":...}}`. **Gemini Vertex to'g'ridan URL emas, base64 data-URL kutadi** → base64 yo'li.
- **Frontend** `aiVideoClipDataUri`: reference videoni ffmpeg bilan KICHIK clip (480p/12fps/qisqa, ovozsiz, crf32) → base64 data-URL; hajm >3.6MB → null (kadr fallback). `aiDescribeFrom` video model + video manba bo'lsa `videoUrl` yuboradi (kadrlar fallback sifatida qoladi).
- **Backend** `orImageToPrompt(...,videoUrl)`: video bo'lsa `video_url` content + "watch the video" grounding. `/gen/describe`: AVVAL video, xato/rad bo'lsa kadr (G5.2) FALLBACK. `express.json` limit 8→14mb.
- Natija: haqiqiy harakat/mazmundan (taxmin emas).

## H2 — Generatsiya prompti video-model'ga moslashdi (diagnostika + tuzatish)
- **Diagnostika:** `runVideo` → `orVideoCreate(opts.prompt=gen.prompt)` — foydalanuvchining TO'LIQ strukturali "Tasvirdan" matni (STYLE:/TIMELINE:/ENDING FRAME:/SOUND DESIGN:) video modelga ketardi. Bu META-tavsif, generatsiya ko'rsatmasi emas — Kling/Veo labellar + per-soniya TIMELINE + SOUND DESIGN'dan chalkashadi → natija promptga mos kelmaydi. Reference wiring (G3/G5) TO'G'RI; skrinshotda reference yo'q edi (referencesiz model erkin ishlaydi).
- **Tuzatish:** `flattenVideoPrompt(prompt)` — strukturali bo'lsa STYLE+SCENE+SUBJECT+MOTION+CAMERA qiymatlarini ixcham tabiiy tavsifga aylantiradi (TIMELINE/ENDING FRAME/SOUND DESIGN tashlanadi); oddiy prompt o'zgarmaydi. `runVideo` `opts.prompt`'ga qo'llanadi. "Tasvirdan" qolipi describe/tahrir uchun qoladi, GENERATSIYAGA ixcham prompt ketadi. Narx/hash ta'sirlanmaydi (prompt hashda yo'q).

## Tekshirildi
- Backend tsc toza. Plugin parse: 2 blok, 0 xato. flattenVideoPrompt test: strukturali→ixcham, oddiy→o'zgarmagan. Oqim buzilmadi.

## Deploy
- **Har ikkisi backend → Render deploy KERAK:** openrouter.ts, studio-gen.ts, index.ts (H1) + gen-processor.ts (H2). Plugin (H1 frontend) → CEP reload / install-cep.sh.
