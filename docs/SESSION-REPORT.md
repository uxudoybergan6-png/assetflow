# SESSION REPORT — 2026-06-15 — Timeline SFX (B) — B1: work-area eksport ✅

Foydalanuvchi "B usuli" (to'liq AE timeline → SFX → auto-sync) tanladi. Bosqichma-bosqich.
Deps tasdiqlandi: ffmpeg 8.1 ✅, ffprobe ✅, aerender (AE 2026) ✅.

## B1 — work-area eksport (poydevor, eng katta xavf)
- **host.jsx exportWorkAreaForSfx(cfg)**: faol comp work-area'sini render (applyBestVideoTemplate=H.264
  afzal), frame-snap timeSpan, maxDur 30s. Qaytaradi {ok,path,workAreaStart,fps,duration}.
- **plugin aiSfxExportClip()**: JSX eksport → ffmpeg (1280px h264 crf30 + aac) → kichik mp4. ffmpeg
  yo'lini topadi (/opt/homebrew, /usr/local, /usr/bin). aiFindFfmpeg().
- **B1 TEST**: SFX rejimida ⏱ "Timeline eksport (B1 test)" tugmasi → mp4 hajm/davomiylik toast.

## Tekshirildi
- inline JS node --check (0 xato) ✅; host.jsx sintaksis OK ✅; install-cep (fayllar o'rnatildi) ✅
- DEPLOY SHART EMAS (faqat CEP/JSX/ffmpeg, backend tegilmadi).

## Keyingi bosqichlar
- B2: backend OpenRouter Gemini video tahlil → cue'lar JSON
- B3: har cue → ElevenLabs SFX (job/polling)
- B4: JSX auto-sync (cue → startTime, workAreaStart bilan)
- B5: UI (Timeline SFX tugma, cost-estimate, progress)

## Holat
AE'да B1 test: SFX rejimi → ⏱ → work-area mp4 chiqishini tekshiring (deploy kerak emas).
