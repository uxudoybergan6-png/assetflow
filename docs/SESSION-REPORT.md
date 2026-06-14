# SESSION REPORT — 2026-06-15 — AI Tools UI real backend'ga ulandi ✅

## AssetFlow_Plugin.html (#aiPage)
- `aiGenerate()` qayta yozildi — "tez orada" demo OLIB TASHLANDI. Tanlangan media'ga qarab
  real POST: `rasm→/image`, `ovoz→/voiceover`, `qidiruv→/search` (`pubFetch` base+60s timeout,
  `pubAuthHeaders` token). `sfx` hali backend'da yo'q → "tez orada" (faqat shu).
- Yangi `aiApiPost` — `code`/`status`ni saqlaydi (xato ishlovi uchun).
- Holatlar: bosilganda lime glow + "Generatsiya qilinmoqda…" → natija (rasm grid / audio
  pleyer). `creditsLeft` kelganda kredit-pill (#sbCredit) yangilanadi; cache user ham.
- "AE‘ga import" → `aiDownloadToTemp(url)` (data: dekod yoki `AssetFlowCatalog.downloadUrlToFile`)
  → `evalScript('importMediaFromPath(...)')` → toast.
- Xato matnlari: AI_NOT_CONFIGURED→"AI hali sozlanmagan"; AI_CREDITS_EXHAUSTED/INSUFFICIENT_CREDITS→
  "Kredit yetarli emas — Pro‘ga o‘ting"; 401→"Sessiya tugadi — qayta kiring".
- `aiEsc()` — prompt/URL HTML-inyeksiyadan himoya. AI_CFG cost'lari server narxiga (5/3/4/1).
- `refreshAccountUi` kredit-pill'ni `u.aiCredits`dan to'ldiradi; pill title "tez orada" olib tashlandi.

## jsx/host.jsx
- `importMediaFromPath(filePath)` qo'shildi — `importAssetToProject`ga delegatsiya (png/mp3 footage import).

## assetflow-catalog.js
- `downloadUrlToFile` public eksport qilindi (AI natija yuklab olish uchun).

## Tekshirildi
- HTML inline JS + catalog.js + host.jsx → `node --check` **TOZA** ✅
- `install-cep.sh` qayta o'rnatdi; o'rnatilgan CEP manba bilan bir xil (importMediaFromPath html+jsx) ✅

## Holat / kutilmoqda
Commit foydalanuvchi so'raganda. Render'da CF_* env bo'lsa to'liq ishlaydi (rasm/ovoz/qidiruv).
SFX route va semantik qidiruv pgvector indeksi — keyingi bosqich.
