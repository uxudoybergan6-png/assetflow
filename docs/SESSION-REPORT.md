# Sessiya hisoboti — 2026-07-11 (BATCH4 post-launch: 4/4 money-zone, 10 commit)

- **#1 Imagen Upscale** (79190f2 · 72947ac · 9993def): katalog 1015 `imagegeneration@002`,
  x2→2K=✦4 / x4→4K=✦8 (provider $0.003 → 25–50× marja); web Upscale MODE + Use ▾/lightbox
  jonli; plagin launcher tool + karta/lightbox ⤢ amali. computeGenCost tekshirildi: 4/8 aynan.
- **#4 Chirp 3 HD** (7b597c8 · aa541ac): google-tts.ts ADC adapter — JONLI sinov mp3 qaytardi
  (Cloud TTS API loyihada ALLAQACHON yoqilgan); 2002 voice default ✦4 flat + 1000-belgi qat'iy
  cap (worst-case $0.03 → 2.53×); Kokoro 2001 o'chdi — endi 0 ta enabled OpenRouter model.
- **#2 Video Upscale Topaz** (3cd0d4b · 4f31570 · 235de5b): MAVJUD fal adapter qayta ishlatildi
  (prompt taxmini eskirgan edi); tier ✦/s: 720p=2 · 1080p=3 · 4k=9; tier/soniyani SERVER ffprobe
  bilan aniqlab imzoga kiritadi (60fps ×2, 300s cap, egalik guard); web tool video-kind + plagin
  afChoose narx dialogi. Hash tamper-testi o'tdi.
- **#3 Narx dvigateli** (14a3838 · 0e048cb): provider narxlar tasdiqlangan qiymatlarga; auto-marja
  ceil(usd×margin÷$0.019) har tier — admin "Apply target margin" (default 2.0) + per-row auto;
  Enabled-only default ko'rinish; PINNED=1015. Money-zone butun batch bo'yicha DIFF'SIZ (tekshirildi).
- **Kutilmoqda:** USER push → API deploy (GitHub Actions); migratsiya YO'Q; install-cep bajarildi
  (AE jonli test kerak); deploy'dan keyin admin'da Apply 2.0×; spend ceiling default $250/kun aktiv.
