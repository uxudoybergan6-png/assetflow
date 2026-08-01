# Sessiya hisoboti — 2026-08-01 · "Featured models" kartalari CMS'ga ulandi

**Nima qilindi:** Ilova Home'dagi "Featured models" bloki (spotlight + 4 mini-karta + strip) endi
vizual muharrirdan to'liq tahrirlanadi. Yangi CMS tugun: `appHome.featured` —
`enabled`, `weekLabel`, `ctaLabel` (`{name}` = model nomi), `railTry`, `hero{…}`, `rail[4]`.
Har slotda: `modelId` (katalogdan tanlash yoki bo'sh = avto evristika), `title`, `desc` va MEDIA
sloti (rasm/GIF/MP4). Admin inspektoridagi "Model" ochiluvchi ro'yxati `/api/admin/pricing`
dan quriladi (`wsLoadModels`, faqat NOM/ID). Fayllar: `landing-config.ts` (sxema+default+merge),
`platform/index.html` (default/merge/hisoblash/`data-cms` belgilari/CSS), `js/admin-website.js`.

**Topildi (tuzatildi):** (1) Kartalar 100% model katalogi + narx dvigatelidan hosil bo'lardi va
bitta ham `data-cms` belgisi yo'q edi — shuning uchun muharrir ularni umuman ko'rmasdi (eski
`TODO(FF)` "haftaning modeli"). (2) `.va-fmhero>*{position:relative}` qoidasi yangi media
qatlamini kartadan tashqariga chiqarardi — `>.va-media` uchun `absolute; inset:0; z-index:0`.

**Qoida (saqlangan):** kartadagi narx CMS'da EMAS — doim `modelCostBits` / ModelPricing dan.
Sxemaga hech qanday kredit/narx maydoni qo'shilmadi.

**Isbot:** admin'da spotlight bosildi → `appHome.featured.hero` (Model ro'yxatida 25 model + avto),
mini-karta bosildi → `appHome.featured.rail.0` ✓. API build ✓ · public-copy 137/137 ✓ ·
panel-responsive ✓ · CF Pages build ✓ · `studio:sync` ✓.
**Kutilmoqda:** push + CF Pages/Cloud Run deploy (migratsiya shart emas — `data Json` ichida).
