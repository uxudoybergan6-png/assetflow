# 4-bosqich — Multi-app & konsolidatsiya (implementatsiya rejasi)

*Manba: Texnik strategiya §⑬ + modul 8 + KOD TAHLILIDA TOPILGAN, hisobotlarda yo'q ishlar.*
*Holat: REJA — kod yozilmaydi.*

Bu bosqich ikkala hisobot e'tibordan chetda qoldirgan ishlarni qamraydi: mavjud Premiere plagini, dual asset model qarzi, va scale infratuzilmasi.

---

## Kod tahlilidan tasdiqlangan holat (hisobotlarda YO'Q)

| Topilma | Kodda haqiqat |
|---|---|
| Premiere plagini mavjud | `plugins/premiere-uxp/` — React + webpack UXP plagin (`src/App.tsx`, `api.ts`). Hisobotlar faqat AE CEP'ni tahlil qilgan |
| Premiere bir xil API'ga ulanadi | `premiere-uxp/src/api.ts` → `API_URL` default `https://assetflow-rqbq.onrender.com`, `Bearer token` |
| **Dual asset model** | Premiere `AssetItem` (`slug, category, fileSize, type`) → **legacy `Asset` modeli**. AE CEP esa `ContributorTemplate` katalogini o'qiydi. Ikki plagin ikki xil ma'lumot modelini ko'radi |
| In-memory state | SSE upload-progress in-memory `Map` (`lib/upload-progress.ts`), rate-limit ham single-process — Render restart'da yo'qoladi |

---

## Ish 1 — Premiere UXP plagini auditi + qaror (BIRINCHI — diagnostika)

### Nega birinchi
4-bosqichning qolgan hammasi shunga bog'liq: Premiere faol qo'llab-quvvatlanadimi yoki tashlab qo'yilganmi?

### Qadamlar
1. **Holatni aniqlash**: `premiere-uxp` qaysi endpoint'larni chaqiradi (`api.ts` to'liq o'qib), qaysi auth (Bearer JWT? PluginToken?), oxirgi commit/faollik.
2. **Model mosligi**: u `GET /api/assets` (legacy) yoki `/api/plugin/catalog` (ContributorTemplate) ni chaqiradimi? — bu Ish 2'ni belgilaydi.
3. **Qaror (foydalanuvchi bilan)**:
   - (a) Premiere'ni faol qo'llab-quvvatlash → ContributorTemplate katalogiga ko'chirish, AE bilan teng,
   - (b) Muzlatish → hujjatlashtirib, e'tibordan chiqarish,
   - (c) Multi-app host-detection (MF `getHostEnvironment().appName switch` naqshi) bilan bitta kod-bazaga birlashtirish.

### Risk
Past (faqat o'qish/qaror). Kod o'zgarishi qarordan keyin.

---

## Ish 2 — Dual asset model birlashtirish (maintenance qarzi)

### Muammo
`Asset`/`Download` (legacy) **va** `ContributorTemplate` ikkalasi schema'da yashaydi. Premiere legacy'ni, AE yangi modelni o'qiydi → ikki manba haqiqat, sinxron emas.

### Qadamlar
1. **Manba haqiqatni tanlash**: `ContributorTemplate` (moderatsiya/contributor workflow shunga bog'langan) — asosiy bo'lishi mantiqiy.
2. **Migratsiya rejasi**: legacy `Asset` yozuvlarini `ContributorTemplate`ga ko'chirish yoki legacy'ni read-only adapter bilan o'rash.
3. **Premiere'ni** yangi katalog endpoint'iga ko'chirish (Ish 1 qaroriga bog'liq).
4. Eski `Asset`/`Download` route'larini (`routes/assets.ts`) deprecate qilish.

### Risk
O'rta–yuqori — ma'lumot migratsiyasi. Ehtiyot: avval backup, bosqichma-bosqich, ikki model parallel ishlagan davr.

---

## Ish 3 — Distributed state (Redis) — faqat scale kerak bo'lganda

### Muammo
SSE progress + rate-limit + cache in-memory single-process. Render restart'da yo'qoladi, horizontal-scale'da sinadi.

### Qadamlar (faqat ko'p-instansiyaga o'tilganda)
- Redis qo'shish: rate-limit store, SSE pub/sub, cache.
- **Hozir shart emas** — bitta instansiya ishlayotgan ekan, kechiktiriladi. Reja tayyor turadi.

### Risk
Past (kechiktirilgan). Erta qo'shilsa — keraksiz murakkablik.

---

## Ish 4 — Qolgan mayda qarorlar

- **Preview public R2 URL**: hozir thumb/preview ochiq URL. Qaror — signed qilish yoki ataylab ochiq qabul qilish (hujjatlash). Trivial, kod fazasida.
- **Search scale**: pg_trgm yetmay qolganda (10k+ shablon) → Meilisearch/Typesense yoki Algolia. 3a semantik qidiruv buni qisman yopadi; alohida shoshilinch emas.
- **Admin `--disable-web-security`**: imzolangan buildda olib tashlash (0/2-bosqichda ko'rilgan).

---

## Bog'liqliklar va ketma-ketlik
1. **Ish 1** (Premiere audit) — birinchi, qaror beradi.
2. **Ish 2** (model birlashtirish) — Ish 1 qaroriga bog'liq, eng katta ish.
3. **Ish 3/4** — scale yoki ehtiyojga qarab, kechiktirilgan.

> Bu bosqich eng ko'p **noaniqlik** saqlaydi — shuning uchun Ish 1 diagnostikasi muhim. Avval ma'lumot yig'amiz, keyin qaror, keyin kod.
