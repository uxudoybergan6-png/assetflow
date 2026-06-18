# SESSION REPORT — 2026-06-19 — G5: Image/Video-to-Prompt (reverse)

## Vision model (tasdiqlangan /endpoints, 2026-06-18)
- `google/gemini-2.5-flash` — in=[file,image,text,audio,**video**] out=[text], jonli (status 0), arzon ($0.3/$2.5 per M). Image VA video qo'llaydi.
- Qaror: video uchun ham FRONTEND kadr ajratish (1-3 kadr) — transport ishonchli (data-URI), provayder video-URL talab qilmaydi. Gemini video-input qo'llasa-da, kadr yo'li barqaror.

## Bajarildi
- **openrouter.ts**: `orImageToPrompt(model, images[], instruction)` — vision chat (image_url content parts + system "describe as generation prompt"), `max_tokens:400` (uzunlik cheklovi).
- **studio-gen.ts**: `POST /gen/describe` — `{images[1..3], kind}` → gemini-2.5-flash → `{prompt}`. BEPUL (enhance kabi). Auth + rate-limit (40/min) router'dan meros; har rasm ≤1.4MB guard.
- **Plugin** (`AssetFlow_Plugin.html`):
  - "Yaxshilash"/JSON yonida yangi «Tasvirdan» tugmasi → manba menyusi (Timeline'dan / Project'dan, G4 oqimi `aiFetchRef` qayta ishlatildi).
  - `aiDescribeFrom(src)`: kadr(lar) ajratadi (rasm→1, video→3), `/gen/describe` chaqiradi, natijani prompt textarea'ga yozadi (tahrirlanadi) + cost-quote yangilanadi.
  - `aiExtractFrames(path,mediaType,maxFrames)` — `aiReferenceDataUri` (G1/G3) shundan foydalanadi; video → teng taqsimlangan kadrlar.
  - Loading: tugma `is-busy` puls + toast; xato → tushunarli toast. 3 tema mos (token CSS).

## Tekshirildi
- tsc toza. Plugin parse: 2 blok, 0 xato. CEP'ga ko'chirildi (AE qo'zg'atilmadi). Studio static UI tegmadi → studio:sync shart emas.

## Holat — G1–G5 TUGADI
- Reference oqimi: kiritish (Timeline/Project) → model-aware router (image-edit/video-ref) → orImageEdit / first_frame; + reverse (image/video → prompt). Deploy + AE jonli test qoldi (siz).
