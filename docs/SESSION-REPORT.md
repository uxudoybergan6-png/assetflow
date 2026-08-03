# Session report — 2026-08-03 (Premiere UXP: R4 vizual parity)

- **Port endi INLINE uslubni ham yoyadi**: `style="…"`, `cssText='…'` va
  `.style.background` (dinamik qiymat ham; gradient/`url()` ga TEGILMADI — UXP ularni
  baribir chizmaydi) → `qisqartma → longhand: 1491`. Sabab: Google bir martalik kod
  kartasi chegarasiz/fonsiz chiqardi — qutini JS shabloni inline yasaydi, qoida emas.
- `pill-radius.js` selektoriga `[style]` qo'shildi → JS shabloni ichidagi
  `border-radius:999px` ("Copy code") ham klamplanadi.
- **UXP `<input>` yarim shaffof fonni IKKI MARTA chizadi** (quti + ichki matn sohasi;
  o'tkir burchakli, padding'dan ichkarida). Jonli qizil zond bilan aniqlandi:
  NOSHAFFOF rangda nuqson yo'q, lekin tekislash yordam bermaydi — ustki qatlam
  MUALLIF rangini oladi. Yangi `js/ae-shim/uxp-input-chrome.js` (FAQAT UXP) bunday
  maydon fonini `transparent` qiladi + native widget bezagini o'chiradi.
  **Ma'lum chetlanish:** AE'dagi 5% oq to'ldirish yo'q; chegara/radius joyida.
- **Jonli tasdiqlandi** (Premiere Pro 2026): EMAIL/PASSWORD maydonlari toza va bir xil;
  kod kartasi accent chegara + fon bilan, "Copy code" to'g'ri pill.
  `.ccx` 55 fayl · 754.6 KB · toza (`bf22b993…`). README §2 ga tuzoq 7-8 yozildi.
- KUTILMOQDA: `catalog?app=pr` prod'da 0 element → FAZA 3 (import) va R2 Node I/O jonli
  sinovi bloklangan · migratsiya `20260803090000_plugin_release_host` PROD ga (deploy'dan OLDIN).
