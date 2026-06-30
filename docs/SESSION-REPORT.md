# SESSION REPORT — 2026-06-30 — Rasm "So'nggi" tezligi + video bilan teng

Muammo: rasm-gen "So'nggi" juda sekin ochilardi va bo'sh ko'rinardi. Faqat `AssetFlow_Plugin.html` (node ✓).

Sabablar + tuzatish:
1. **Bo'sh ko'rinish (sekin tuyulardi):** `renderRecentGrid` yuklanayotganda ham "Hozircha gen yo'q" ko'rsatardi (video "Yuklanmoqda…" ko'rsatadi). → `recentLoading`/`recentError` flaglari qo'shildi; endi "Yuklanmoqda…" / xato + "↻ Qayta urinish" (video naqshi 1:1). `loadRecent(force)` + `window.afIgRetryRecent`.
2. **Haqiqiy sekinlik (rasm baytlari):** umumiy `afRecent.card` rasm kartasini CSS `background-image` (to'liq o'lchamli PNG, darrov yuklanardi) bilan chizardi → **`<img loading="lazy" decoding="async">`** ga o'tkazildi (overlaylar absolute → ustida; `.rc` relative+overflow hidden). Ekrandan tashqari rasmlar kechiktirilib yuklanadi, dekod async → grid bloklanmaydi. Rasm VA video so'nggi gridlar foyda oladi.

Dizayn: ikkala tool allaqachon BIR XIL `afRecent.card` + `.recentgrid` ishlatadi — farq faqat yuklash-holati edi (endi teng).

Eslatma: rasmlar hali to'liq o'lcham (backend thumbnail yo'q) — lazy/async yumshatadi; haqiqiy thumbnail = backend ishi (keyingi). Kutilmoqda: push + AE qayta o'rnatildi + test.
