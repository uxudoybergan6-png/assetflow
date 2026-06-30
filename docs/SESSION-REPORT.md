# SESSION REPORT — 2026-06-30 — Video ⇄ Rasm tez almashtirgich

Faqat `AssetFlow_Plugin.html` (node ✓). Muammo: video gen ketayotganda rasm gen'ga o'tib-kelish qiyin edi (har safar AI Tools launcher orqali).

- Ikkala tool header'idagi statik sarlavha o'rniga **Video|Rasm segmented toggle** (`.tabsw`) qo'yildi. Faol tomon yoritilgan; ikkinchi tomon bosilsa `window.axGo('vidgen'|'imggen')` orqali darrov o'tadi (go() marshruti).
- CSS `.axroot .tabsw` (pill, ikkala tool'da). Ikonalar: video=kamera, rasm=surat.
- Eslatma: video gen ketayotganda boshqa tool'ga o'tilsa, server-tomonда davom etadi va natija "So'nggi"/Tarixда chiqadi (jonli progress bar mahalliy to'xtaydi — bu mavjud xulq). To'liq cross-tool jonli kuzatish — kattaroq ish (keyingi).

Avval (shu sessiya): rasm tool video bilan teng (vpanel kartalar, paste, project multi-select, model-switch confirm, limit/narx/neytral default, So'nggi loading+lazy); magnific disable; enhance META fix; video 3-concurrent + Tozalash.

Kutilmoqda: push + AE qayta o'rnatildi + jonli test (header'da toggle, almashtirish).
