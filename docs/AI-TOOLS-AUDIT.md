# AI Tools "Rasm yaratish" — 100% chuqur audit (2026-06-26)

Metod: **ultracode/adversarial** — 7 o'lcham bo'yicha mustaqil reviewer'lar (24 agent) + kredit/refund, xavfsizlik, overlay invariantlari uchun mustaqil adversarial tasdiq. Topilgan har bloker/jiddiy xato kod-iqtibos (file:line) bilan, mustaqil verifier'lar bilan tasdiqlangan. Bloker/jiddiy/security xatolar TUZATILDI; test/log bilan tasdiqlandi.

## TUZATILGAN (bloker / jiddiy / security)

| # | Xato | Joy | Og'irlik | Tuzatish | Tasdiq |
|---|------|-----|----------|----------|--------|
| 1 | **Double-refund / bepul-gen race** — `processGeneration` `fail()` va `done` UNGUARDED (`update where id`), `reconcileStuckGenerations` esa atomik. 10 daq'dan oshган job'ni reconcile failed+refund qilsa, keyin `fail()` IKKINCHI refund yoki `done` failed→done (bepul gen). | `gen-processor.ts:199-205, 369` | **BLOKER** | `fail()` va `done` → atomik `updateMany where status IN [queued,running]` / `=running`, refund faqat `count>0` (reconcile naqshi). | Node race test 6/6 PASS (reconcile→fail/done → 1 refund; eski guardsiz → 2) |
| 2 | **Cancel YOLG'ON "kredit yechilmadi"** — /gen muvaffaqiyatli bo'lgach kredit serverda yechilgan va job davom etadi, lekin cancel "yechilmadi" deydi (DELETE/abort yo'q). | plagin `igCancel` ~9576 | jiddiy | `submitted` flag (jobId olinganда true) → cancel: "Orqa fonда davom etadi — natija Tarixда" (false-refund da'vosi yo'q). | Headless: 'running' poll → cancel → toast "Orqa fonда…", poll to'xtaydi |
| 3 | **Enhance kredit chip stale** — ✨ Yaxshilash kredit yechadi, lekin chip yangilanmaydi; endpoint `creditsLeft` qaytarmaydi. | plagin `igEnhance` ~9551 + `studio-gen.ts` enhance return | jiddiy | endpoint `creditsLeft: gate.remaining` qaytaradi (text+json), plagin `setCreditChip(e.creditsLeft)`. | Headless: enhance → chip ✦599 |
| 4 | **Timer/network leak (navigate-away)** — tooldan chiqsa (igBack/Barchasi/🕘) `pollTimer`/`progTimer` tozalanmaydi → yashirin DOM'ga yozadi + API'ni urib turadi (≤247s). | plagin poll/progress | **BLOKER** | `teardownGen()` (`window.axIGTeardown`) — `go()` boshida + `openHistory` da chaqiriladi (stopTimers + cancelled). | Headless: gen poll → Barchasi → progress yashirin, poll TO'XTAYDI |
| 5 | **JWT_SECRET zaif guard** — prod guard faqat bo'sh/`dev-secret-change-me` ni bloklaydi; commit qilingan example qiymatlar o'tib ketadi. Bir xil kalit auth + cost-quote imzolaydi → soxta ADMIN token (cheksiz kredit) + cost-quote bypass. | `index.ts:126` | jiddiy (security) | `WEAK_SECRETS` denylist + prod'да `<32 belgi` → `process.exit(1)`. | tsc TOZA |
| 6 | **genParamsHash `referenceUrls` strip qilmaydi** — latent BAD_QUOTE (quote-without-refs naqshida). Bugun ishlaydi (plagin bir xil params yuboradi), lekin mo'rt. | `gen-quote.ts:35` | past | `delete priced.referenceUrls` (no-op agar yo'q). | tsc TOZA |
| 7 | **falEnhancePrompt output shape taxmini** — faqat `data.output` o'qiydi (router javob shakli tasdiqlanmagan). | `fal.ts:221` | past | TOLERANT parse: `output|text|response|message|content` yoki data string. Refund yo'li bor → kredit yo'qolmaydi. | tsc TOZA |
| 8 | **Batch "Yuklab olish" toast-spam** — CEP'да har item uchun bitta toast (N spam). | plagin recent batch + afGallery batch | minor | CEP'да BITTA toast (loop o'tkazib yuboriladi). | grep tasdiq |

## ADVERSARIAL INVARIANT TASDIQ (mustaqil)

- **KREDIT/REFUND:** tuzatishdan KEYIN HOLDS. consume 1× ( `/gen` consumeAiCredits atomik, narx=base×count); refund faqat haqiqiy xatoда 1× (atomik guard); timeout→refund yo'q (reconcile); cancel→server davom etadi, double yo'q; reconcile atomik. count>1 qisman-xato → all-or-nothing DB asset. (Qoldiq: qisman-xatoда muvaffaqiyatli slot'lar R2'ga yuklanib orphan R2 obyekt qoldiradi — STORAGE muammosi, kredit-to'g'ri, history'да ko'rinmaydi.)
- **XAVFSIZLIK:** HOLDS. FAL_KEY faqat `Authorization` header'да; `errText` faqat provayder xabari/`fal HTTP <status>` (header/kalit emas); s3 loglari faqat set/MISSING bool. XSS: imggen/gallery innerHTML user/API matnини `textContent`/`esc`/`histEsc`/`aiEsc` bilan eskeyplaydi; eskeyplanmaganlar — server-imzolangan R2/data-URI.
- **OVERLAY LAYOUT:** HOLDS. Sheet'lar/lightbox `position:fixed` (ajdod transform yo'q → viewportга bog'lanadi), popover bosilgan chipга, @mention quti ichида pastга; backdrop/Esc yopadi; z-index lightbox 9992 > sheet 9990 > header ≤20. Header kesmaydi.

## TUZATILMAGAN (qamrovdan tashqari / dizayn / kelajak)

- **Parallel multi-gen navbat YO'Q** — UI bitta job (`if(polling)return`); backend GEN_CONCURRENCY bor, lekin tool fire-and-forget ko'p job kuzatmaydi. (Dizayn qarori; kerak bo'lsa per-job state refactor.)
- **DELETE /gen/:jobId refund qilmaydi** — done gen'ni o'chirish = kreditni saqlamaydi (natijani olgansiz) — to'g'ri. In-flight o'chirish UI'да ko'rsatilmaydi.
- **CEF88 `:has()`** (`AssetFlow_Plugin.html:563`, `.topbar:not(:has(.cat-hero))`) — Chrome 105, CEF88'да YO'Q → qoida tushib qoladi. **Katalog topbar, imggen EMAS** → qamrovdan tashqari, lekin belgilab qo'yildi. Imggen tool CEF88-toza (aspect-ratio/inset/gap/optional-chaining 88'да bor, ikonalar SVG).
- A11y (aria/role/focus-trap/alt — 0), backend testlar (0), i18n kiril/lotin aralash — kelajak.
- Natija/recent/lightbox rasmларида `onerror` fallback yo'q (polish).

## YANGI MODEL QO'SHISHGA TAYYORMI? — HUKM: **QISMAN** (backend katalog tayyor; live UI + fal adapter ish talab qiladi)

**Tayyor:** kredit/refund (atomik guard bilan), cost-quote imzo, `gen-models.ts` katalog GENERIC (model qo'shilsa cost-quote/gen orqali oqadi), UI model-aware maydonlari (`refMode/maxRefs/aspects/quals/count` /gen/models'дан).

**To'siq (yangi model uchun avval tuzatilsin):**
1. **Live imggen UI bitta modelга HARDCODE** — `AssetFlow_Plugin.html:~9300` `.filter(x=>x.key==='openai/gpt-image-2/edit')[0]` → yangi image modellar KO'RINMAYDI. Model sheet statik bitta variant. **Kerak:** model PICKER (`getModelsByMode('image')` ro'yxati + tanlash); qolgani allaqachon model-aware.
2. **fal.ts adapter image-edit'ga xos** — `falImageEdit` (refsiz text-to-image rad etadi: `imageUrls.length` shart); `falSubmit` eksport qilinmagan → generic kirish yo'q. **Kerak:** generic `falTextToImage`/`falGenerate` (yoki `falSubmit` eksport) refsiz/boshqa contract modellar uchun.
3. **gen-processor provider routing image blokiга qamalган** — `useFal` faqat `feature in [text-to-image,image-edit]` ichида. Yangi fal video/audio model bu yo'ldan o'tmaydi. **Kerak:** provider dispatch'ni model katalogидан (feature/provider) umumlashtirish.

**Yangi IMAGE model qadamlari (joriy fal image-edit naqshi):**
1. `gen-models.ts` katalogга entry (key/id/provider/feature/refMode/maxRefs/aspects/resolutions/qualityCost/count, fal bo'lsa `falModel`).
2. fal & image-edit → `falImageEdit` orqali ishlaydi (faqat `falModel` belgilang). fal & text-to-image (refsiz) → generic fal call kerak (1-band #2).
3. UI: `:9300` hardcode filter → model picker (1-band #1).
4. cost-quote/kredit/refund — o'zgarmaydi (generic + atomik guard).
- **VIDEO/AUDIO model** = kattaroq ish (imggen rasm-only; alohida tool pane yoki umumlashtirish; fal video adapter).

## TEKSHIRUV
- `npm run build -w apps/api` — **tsc TOZA**. Plagin **6 `<script>` blok `new Function` — 0 xato**.
- Double-refund: Node atomik-guard test **6/6 PASS**. Cancel/enhance-chip/teardown: **headless (preview brauzer) tasdiq**.
- O'zgargan: `gen-processor.ts`, `studio-gen.ts`, `gen-quote.ts`, `fal.ts`, `index.ts`, `AssetFlow_Plugin.html`.
