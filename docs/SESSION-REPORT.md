# SESSION REPORT — 2026-06-15 — Video gen tezlik tekshiruvi + poll tezlashtirish ✅

Foydalanuvchi: video juda sekin gen qilyapti.

## O'lchov (jonli prod)
- veo-3.1-lite 4s/720p → **46s** jami (6s'da running, 46s'da done).
- Ya'ni ~40s = **provayder (Veo) generatsiya vaqti** — AI video uchun normal, bizning kodda emas.
- Sekinlikning katta qismi provayder tomonida; uzun/1080p/10s video tabiiy uzoqroq.

## Bizning tomondan tezlashtirish (kod)
- **gen-processor runVideo**: poll granularligi 5s→3s, birinchi tekshiruv 2s'da (avval har doim
  5s kutardi). Tayyor bo'lishini ~2-3s tezroq aniqlaydi. Oyna ~5 daqiqa (3s×100).
- **plugin aiPollJob**: video poll 4s→3s (snappier progress).

## Tavsiya (foydalanuvchiga)
- Eng tez: **veo-3.1-lite**, qisqa duration (4-6s), past resolution (720p).
- 1080p/10s/Seedance — tabiiy sekinroq (provayder).

## Tekshirildi
- tsc EXIT 0 ✅; inline JS node --check (0 xato) ✅; install-cep ✅

## Holat
Commit + push → deploy (poll backend o'zgarishi). Funksiya/param oqimi tegilmadi.
