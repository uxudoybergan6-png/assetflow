# SESSION REPORT — 2026-06-30 — Video gen: ko'p gen + tezlik + Tozalash

Faqat `plugins/after-effects-cep/AssetFlow_Plugin.html` (frontend; node ✓).

- **Ko'p gen (avval faqat 1 edi):** `MAX_VG_JOBS=3` qo'shildi. `refreshVgBtn` (3 shox) `activeJobs.length<1` → `<MAX_VG_JOBS`; `genVgClick` guard `>=1` → `>=MAX_VG_JOBS` (aniq xabar). Endi bir vaqtda 3 ta video gen navbatga qo'yiladi (rasm tool'dagi MAX_JOBS=5 naqshi).
- **Tezlik:** `genVgClick` da `preflight-safety` + `cost-quote` + `session` endi PARALLEL (`Promise.all`) — avval ketma-ket edi (preflight alohida round-trip). Kredit faqat `/gen`'da yechilgani uchun xavfsiz (preflight bloklasa /gen'gача yetib bormaydi → kredit yechilmaydi). Cold-start Render'da sezilarli tejam.
  - Eslatma: video gen'ning ASOSIY sekinligi fal video render (daqiqalar) + Render cold-start — bu infra, kodда tezlatib bo'lmaydi. Poll cadence (3s) yetarli.
- **Tozalash:** video tool'ga `vgClearBtn` qo'shildi (Sozlamalar yorlig'ida, rasm tool'dagidek). Bosilganda: prompt bo'shaydi, media-refs (+@token) tozalanadi, Boshlang'ich/Yakuniy kadr o'chadi. NATIJA (So'nggi grid) tegmaydi. `.axvg .lbl .clearbtn` CSS qo'shildi.

Kutilmoqda: push + AE jonli test (3 ta gen birga, Tozalash, tezroq submit).
