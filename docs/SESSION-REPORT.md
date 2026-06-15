# SESSION REPORT — 2026-06-15 — Model-asosli dinamik composer (UI) ✅

Reja: docs/STUDIO-GEN-composer-v2.md §3,§4 + composer-visual-reference.html. Faqat plugin UI.

## Plugin (AssetFlow_Plugin.html) — hech narsa hardcode emas, model.capabilities'dan render
- Media: Rasm + **Video** (yangi) + Ovoz + Qidiruv. aiStudioMode: rasm/video/ovoz → studio.
- Strukturali tanlov af_ai.sel[media]; aiCurrentModel()/aiInitSel() capabilities'dan default.
- Sozlamalar menyusi capabilities-asosli (aiBuildSettingsMenu): video → aspects/resolutions/
  durations/audio; rasm → aspects/quality/count; ovoz → voices. Chiplar (ai-chip) + audio toggle.
- aiGenParams() FAQAT model qo'llaydigan maydonni yig'adi (video {duration,resolution,
  aspectRatio,audio}; voice {voice}). Tanlov o'zgarsa → quote qayta imzolanadi (aiAfterSelChange).
- "+" input affordancelar model.inputs[] dan (aiRenderInputs). Settings yorlig'i tanlovdan.
- Natija: rasm grid / <video controls> / <audio> + AE'ga import. Video polling ~8.6 daq.
- CSS: ai-chip/ai-set-sec/ai-tg/ai-inputs/ai-res-vid (dark, tokens.css, o'zbekcha).

## MUHIM: duration modelga xos (jonli tasdiq, real prod modellari)
- Veo → 6s (5s YO'Q, faqat 4/6/8) · Kling → 5s (3–15) · Wan → 5s ([5,10]) · Seedance → 5s.
- Default'lar backend resolveVideoParams bilan BIR XIL → BAD_QUOTE yo'q.

## Tekshirildi
- Inline JS node --check (0 xato) ✅; install-cep ✅
- Headless sim (real prod modellari): har model to'g'ri sel/params ✅
- cost-quote round-trip: rasm=5, veo-lite 6s=60, kling 10s=120, imzo bor ✅
- AE vizual test (kontrollar o'zgarishi) — foydalanuvchi tasdiqlaydi.

## Holat
Commit + push (deploy shart emas — UI plugin lokal). studio:sync shart emas (plugin o'zgardi).
