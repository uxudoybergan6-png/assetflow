# FrameFlow — TO'LIQ MUSTAQIL AUDIT

**Sana:** 2026-07-30 · **Branch:** main · **Metod:** 16 yo'nalish bo'yicha mustaqil kod-tekshiruv (11 yo'nalish ko'p-agentli, 5 yo'nalish qo'lda), har topilma real kodda tasdiqlangan + jonli prod tekshiruvi.
**Hajm:** 157 topilma (4×P0, 34×P1, 84×P2, 35×P3) + COWORK-AUDIT-2026-07-28 daʼvolarining tekshiruvi.
**Aniq raqamlangan ro'yxat (1–157):** `docs/MUAMMOLAR-2026-07-30.md`

---

## 0. 🔴 HOZIRGI HOLAT — PRODUCTION ISHLAMAYAPTI

Audit yakunida (2026-07-30, ~17:10) jonli tekshiruv:

```
GET https://api.getframeflow.app/health
→ 503 {"status":"degraded","checks":{"db":"down","storage":"ok"}}

GET /api/plugin/catalog        → 500 {"error":"Server error"}
GET /api/contributor/catalog   → 500 {"error":"Server error"}
```

3 marta 5 soniya oraliq bilan tekshirildi — tiklanmadi (yaʼni Neon cold-start emas, haqiqiy uzilish).
Shu sessiya boshida (~14:00) API **sog'lom** edi va katalogda 15 aset ko'rinardi. Yaʼni bugun DB tushib qolgan.

**Eng muhim jihati:** `SENTRY_DSN` production env'da **yo'q**, alerting yo'q, uptime-monitor yo'q.
Yaʼni: **mahsulot tushib qoldi va buni hech kim, hech qanday kanal orqali bilmaydi.** Bozorga chiqishdan
oldin tuzatilishi shart bo'lgan birinchi narsa aynan shu — kod emas, ko'rish qobiliyati.

---

## 1. Umumiy hukm

| Zona | Tayyorlik | Izoh |
|---|---|---|
| **Pul zonasi (kredit dvigateli)** | 🟡 70% | Atomik naqsh yaxshi qurilgan, lekin 4 ta real teshik pul chiqaradi |
| **Pul zonasi (billing / obuna)** | 🔴 40% | Lemon Squeezy DB'da **umuman yozilmaydi**; o'z-o'zini tuzatish yo'q |
| **Contributor → Admin zanjiri** | 🟡 65% | Ishlaydi, lekin tasdiqlangandan keyin kontent almashtirish mumkin |
| **Katalog → Web → Plagin zanjiri** | 🟢 80% | Eng puxta qism; kvota/staleness nuqsonlari bor |
| **Miqyos (ko'p shablon)** | 🔴 35% | ~2000 shablondan keyin sinadi; 1 ta endpoint OOM qiladi |
| **Web platforma (muhandislik)** | 🟢 80% | SPA kutilganidan mustahkam |
| **Web UI/UX** | 🟡 55% | 19 ichki mockup prod'da, bekor qilish yo'q, klaviatura yo'q |
| **Plagin (muhandislik)** | 🟡 70% | Windows'da zip import **sinadi** |
| **Plagin UI/UX** | 🟢 75% | Yadro oqimi halol; jarayon xotirasi yo'q |
| **Plagin bozorga chiqish** | 🔴 **35%** | Kod tayyor, biznes hujjatlari 0% |
| **Xavfsizlik** | 🟡 70% | IDOR gigiyenasi yaxshi; device-code phishing ochiq |
| **Infra / operatsiya** | 🔴 40% | Monitoring yo'q, graceful shutdown yo'q, `demo:clear` bomba |
| **Ommaviy daʼvolar / huquq** | 🔴 45% | Mavjud bo'lmagan mahsulot daʼvo qilinadi, narxlar mos emas |

**Bir jumlada:** muhandislik sifati kutilganidan ancha yuqori (atomik kredit naqshlari, fail-closed gate'lar,
CI'da real Windows E2E) — lekin mahsulot **operatsion jihatdan ko'r**, **billing yarim ulangan**, va
**miqyosga chidamaydi**. Bugungi holatda pullik mijozga ochib bo'lmaydi.

---

## 2. COWORK-AUDIT-2026-07-28 tahlili

| Daʼvo | Hukm | Dalil |
|---|---|---|
| P0-1 oy-reset race | ✅ **TASDIQ** | `plugin-profile.ts:595` — shartsiz absolyut yozuv; 450-qatorda to'g'ri guard naqshi bor |
| P0-2 refund atomik emas | ✅ **TASDIQ** | `plugin-profile.ts:688` — eski o'qishdan absolyut `newBalance` |
| P0-3 unzip injection + Windows | ✅ **TASDIQ** | `assetflow-local-store.js:546`, `assetflow-catalog.js:1313` |
| P0-4 openExternal injection | ✅ **TASDIQ** | `assetflow-account.js:391` — faqat `"` qochiriladi |
| P0-5 LS ikki marta kredit | ✅ **TASDIQ** | `grantAiCreditsTopup` order-id idempotentligi yo'q + catch dedup-claim'ni o'chiradi |
| P0-6 kredit yo'qolishi | ✅ **TASDIQ** | `studio-gen.ts:1557` — faqat `P2002` refund qiladi |
| P0-7 `.dockerignore` yo'q → `.env` image'da | ❌ **NOTO'G'RI** | `.dockerignore` bor va `.env*`, `cloudrun-env.yaml` ni chiqarib tashlaydi |
| P26 to'lov busy-state qilinmagan | ❌ **NOTO'G'RI** | `index.html:22443` `payBusy` guard jonli |
| Studio/js artefakt drift keng tarqalgan | 🟡 **QISMAN** | Faqat `admin-releases.js` (80 qator); CF Pages manbadan build qiladi → o'lik kod |
| Sirlar git'da | 🟡 **QISMAN** | Diskda bor, **git'da kuzatilmaydi** — lekin `cloudrun-env.yaml` da jonli kalitlar ochiq turibdi |

**Xulosa:** COWORK auditining 6/7 P0 daʼvosi haqiqat. Lekin u topa olmagan **eng katta 3 muammo** bor:
(1) LS obunasi DB'ga umuman yozilmaydi, (2) `/api/contributor/catalog` autentifikatsiyasiz cheksiz,
(3) tasdiqlangandan keyin kontent almashtirish mumkin.

---

## 3. 🔴 P0 — bloklovchi

### P0-A · `npm run demo:clear` — filtrsiz jadval o'chirish
`scripts/clear-assetflow-demo.mjs:37` — `ContributorTemplate`, `StudioAuditLog`, `StudioMessage`
jadvallarini **to'liq** o'chiradi. Filtr yo'q, `--dry-run` yo'q, tasdiqlash yo'q, prod-guard yo'q.
CLAUDE.md'da oddiy buyruq sifatida hujjatlashtirilgan. `DATABASE_URL` prod'ga qaragan holatda
bir marta ishga tushirish = butun marketpleys yo'qoladi.

### P0-B · Windows'da zip import ishlamaydi
`assetflow-catalog.js:1313` + `assetflow-local-store.js:546` — `execSync("unzip ...")`.
Windows'da `unzip` yo'q. **Aynan shu tuzatish AssetFlow_Admin panelida allaqachon yozilgan, lekin
mijoz plaginiga ko'chirilmagan.** Windows AE foydalanuvchisi uchun har bir zip-pack importi sinadi.
Qo'shimcha: sanitizer `` ` `` va `$()` ni o'tkazadi → shell injection (fayl nomi orqali).

### P0-C · Marketplace submission 16/19 maydon to'ldirilmagan
`plugins/after-effects-cep/marketplace-submission.json` — 16 ta maydon so'zma-so'z
`"OWNER-INPUT-REQUIRED"`. Imzolangan `.zxp` yo'q, Adobe Developer Distribution sertifikati
hech qayerda ko'rsatilmagan. **Adobe Marketplace'ga bugun topshirib bo'lmaydi.**

### P0-D · Production DB tushgan + monitoring yo'q
Yuqoridagi §0. Kod muammosi emas, lekin bozorga chiqishning birinchi to'sig'i.

---

## 4. 💰 PUL ZONASI

### 4.1 Kredit dvigateli (`plugin-profile.ts`, `studio-gen.ts`, `gen-models.ts`)

**Yaxshi:** `consumeAiCredits` / `consumeDownload` / `consumeImport` dekrementi **atomik**
(`updateMany` + `gte` guard) — bu to'g'ri naqsh. `clawbackTopupCredits` 3 marta retry bilan guard'langan.
Spend-guard uch qatlamli (kill-switch, global USD ceiling, kunlik per-user cap) — puxta o'ylangan.
`cost-quote` HMAC bilan imzolanadi.

| # | Muammo | Fayl | Dar. |
|---|---|---|---|
| M1 | Oylik reset **shartsiz absolyut yozuv** — oy boshida N ta parallel so'rov har biri balansni to'liq ulushga qaytaradi (bepul kredit zarb qilinadi) | `plugin-profile.ts:595` | P1 |
| M2 | `refundAiCredits` eski o'qishdan absolyut yozadi — parallel sarfni **o'chirib yuboradi** | `plugin-profile.ts:688` | P1 |
| M3 | **Seedance 3102 @4K + video-ref taannosi provayder narxidan past sotiladi.** 4K = 60 kredit/s, video-ref `0.6×` chegirmasi → 36 kr/s = $0.684/s; BytePlus $0.836/s oladi. 15s klipda **−$2.28 zarar**. `Apply target margin` buni TUZATMAYDI — chegirma quote paytida qo'shimcha qo'llanadi | `gen-models.ts:1775` | P1 |
| M4 | `DELETE /gen/:jobId` status guard'i yo'q — `running` job o'chiriladi → (a) konkurentlik cheklovi chetlab o'tiladi, (b) job keyin fail bo'lsa `updateMany` 0 qator topadi → **refund hech qachon bo'lmaydi, backfill ham topa olmaydi** | `studio-gen.ts:2019` | P1 |
| M5 | `generation.create` P2002'dan boshqa xato bersa → kredit yechilgan, Generation qatori yo'q, refund yo'q | `studio-gen.ts:1557` | P2 |
| M6 | `MAX_ACTIVE_GENERATIONS` check-then-act (atomik emas) | `studio-gen.ts:1521` | P2 |
| M7 | `ModelPricing.enabled` bayrog'i saqlanadi, ko'rsatiladi, PATCH qilinadi — lekin generatsiya paytida **hech qachon tekshirilmaydi** | `gen-models.ts:1548` | P2 |
| M8 | SFX (ElevenLabs 4001, standart model) maksimal davomiylikda provayder narxidan past | `gen-models.ts:977` | P2 |
| M9 | Oylararo refund ceiling tufayli haqiqiy refund jimgina 0 ga tushishi mumkin | `plugin-profile.ts:687` | P2 |
| M10 | Quote imzolangan, lekin `/gen` da narx **server tomonda qayta hisoblanmaydi** | `studio-gen.ts:1485` | P3 |

### 4.2 Billing / obuna / daromad

**Bu bo'lim eng zaif.**

| # | Muammo | Dar. |
|---|---|---|
| B1 | **Lemon Squeezy obunasi DB'ga UMUMAN yozilmaydi.** `prisma.subscription` faqat `stripe.ts` va `google-auth.ts` tomonidan yoziladi. LS webhook faqat `PluginProfile.plan` ni o'zgartiradi. Natija: `subscriptionIsPro()` har bir LS mijozi uchun **false** | P1 |
| B2 | **Pullik LS mijozi plaginda "Free" tugmasini bossa — abadiy qamalib qoladi.** `setPluginPlan(FREE)` shartsiz ruxsat etilgan; qaytish uchun `setPluginPlan(PRO)` → `subscriptionIsPro()=false` + `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE="false"` → **"PRO requires a Stripe subscription"**. LS esa pul olishda davom etadi. Yagona chiqish — yangi xarid (ikki marta to'lov) | P1 |
| B3 | LS webhook qisman xato bersa `catch` dedup-yozuvini **o'chiradi** → LS retry butun handler'ni qayta ishga tushiradi → kredit **ikki marta** beriladi | P1 |
| B4 | Pause/resume sikli yangi to'lovsiz AI kreditlarini to'liq tiklaydi | P1 |
| B5 | `npm run reconcile:plans` faqat Stripe'ni biladi → ishga tushirilsa **har bir LS pullik mijozini FREE ga tushiradi** | P2 |
| B6 | Ikkinchi (dublikat) LS obunasini sotib olishga to'siq yo'q | P2 |
| B7 | LS test-mode webhook'lari jonli to'lovdan farqlanmaydi | P2 |
| B8 | Qisman refund yo'q — har qanday refund 100% deb hisoblanadi | P2 |
| B9 | Payout hold oynasi pul harakatlanadigan nuqtada **majburlanmaydi** (faqat maslahat) | P2 |
| B10 | `recordContributorPayout` da qulf yo'q — parallel ikki to'lov mumkin | P3 |
| B11 | Admin "LS variant (monthly/yearly)" maydonlari — yozma-faqat o'lik konfiguratsiya | P3 |

### 4.3 🆕 Contributor daromadi — hovuzni ifloslantirish (yangi topilma)

Bu **hech bir oldingi auditda yo'q** va bevosita pulga tegadi:

1. Oddiy USER `POST /api/studio/gen/:jobId/explore` chaqira oladi — **rol tekshiruvi yo'q**
   (`studio-gen.ts:1940`).
2. `explore-submit.ts:201` `ContributorTemplate` yaratadi, `contributorId = o'sha USER`.
3. Fayl sarlavhasida yozilgan: *"Payout YO'Q (earnings yaratilmaydi)"* — **bu amalda bajarilmagan**.
4. `download-events.ts:152` shablon turini (`templateType` / `aiSource`) **umuman filtrlamaydi** →
   har yuklab olishda `kind:"download"` earning qatori yoziladi.
5. `earnings.ts:133` hovuz taqsimoti aynan `kind:"download"` qatorlarini oladi.

**Natija:** platforma o'zi pul to'lab generatsiya qilgan kontent uchun ikkinchi marta to'laydi, va
CONTRIBUTOR bo'lmagan hisoblar payout balansi to'playdi — 30% hovuzni suyultiradi. Admin panelida
bunday qatorni ajratib ko'rsatadigan bayroq yo'q. **Har qanday payout ishga tushirishdan oldin tuzatilishi shart.**

### 4.4 🆕 Fire-and-forget pul yozuvlari

`plugin.ts:586`, `:620`, `:1123` — uchalasi ham `void recordTemplateDownloadEvent(...)`.
Cloud Run javobdan keyin CPU'ni throttle qiladi (bu tuzoq loyihada boshqa joyda tan olingan va
`pack-uploaded` da `await` bilan tuzatilgan) → **yuklab olish hodisasi va u bilan birga contributor
earning'i jimgina yo'qolishi mumkin.**

### 4.5 Kvota noto'g'ri sarflanishi
`guardDownloadable` da `consumeDownload` **baytlardan oldin** ishlaydi, `serveTemplateAsset` esa keyin
404 qaytarishi mumkin (pack S3'da yo'q). Free foydalanuvchining 15 ta oylik yuklab olishidan biri
hech narsa olmasdan yonadi; klientdagi fallback retry buni 2 ga ko'paytiradi.

---

## 5. 🔗 ZANJIR: Contributor → Admin → Web → Plagin

### 5.1 Holat mashinasi (haqiqiy)

```
DRAFT ──submit──> PENDING_REVIEW ──approve──> APPROVED + published=true ──> katalog
   │                    │                            │
   │                    └──reject──> REJECTED        ├── takedownAt → 451 (hammaga)
   │                                  (soft/hard)    └── packScanStatus: pending|null → 409 (fail-closed ✅)
   └── /ingest (zip) ──> IngestJob(queued→processing→done|failed) ──> PENDING_REVIEW
```

**To'g'ri ishlaydigan qismlar:** moderatsiya navbati real bulk endpoint bilan; rad etish sababi majburiy
va tiplangan; xavfsizlik skani gate qiladi; `packScanStatus` null/pending bo'lsa **hech kimga** (admin ham)
serve qilinmaydi — fail-closed; ingest worker `SKIP LOCKED` bilan atomik claim qiladi; zip-slip va
zip-bomb himoyasi bor; `externalId` unique → ingest idempotent.

### 5.2 🔴 Zanjirdagi eng jiddiy uzilish — tasdiqlangandan keyin kontent almashtirish

**Yo'l A — `/sync` (eng o'tkir):** `contributor.ts:3637` — mavjud shablonni `externalId` bo'yicha topib
`name, description, cat, tags, metaJson, fileName, fileSize` ni **qayta yozadi**. `reviewStatus` va
`published` **reset qilinmaydi**, `packScanStatus` ham **"clean" bo'lib qoladi**. `fileName` bu yerda
klientdan keladi va `HeadObject` bilan tekshirilmaydi. Contributor presigned PUT bilan
`templates/<id>/` ostiga yangi fayl qo'yib, `/sync` orqali `fileName` ni unga qaratsa —
**skanlanmagan, moderatsiya ko'rmagan kontent jonli listing ostida tarqatiladi.**

**Yo'l B — `/pack-uploaded`:** `contributor.ts:1600` — pack almashtiriladi, `packScanStatus="pending"` ga
tushadi (yaxshi), lekin `reviewStatus`/`published` **tegilmaydi**. Skan toza chiqishi bilan yangi
kontent avtomatik jonli bo'ladi — **inson moderatsiyasisiz**. Bu klassik bait-and-switch: toza pack bilan
tasdiqlanib, keyin mualliflik huquqi buzilgan/boshqa kontentga almashtirish.

**Tavsiya:** har ikkala yo'lda ham APPROVED shablon uchun `reviewStatus → PENDING_REVIEW`,
`published → false` qilish (yoki hech bo'lmasa admin'ga "re-review required" bayrog'i).

### 5.3 Zanjirdagi boshqa uzilishlar

| # | Muammo | Dar. |
|---|---|---|
| Z1 | Ingest job retry'lari tugagach `incoming/` dagi zip **abadiy yetim qoladi** — tozalovchi yo'q | P2 |
| Z2 | `reclaimStuck` 15 daqiqadan keyin qayta navbatga qo'yadi, lekin fencing yo'q — birinchi worker hali ishlayotgan bo'lishi mumkin; birinchisi zipni o'chirsa, ikkinchisi "File not found" bilan **permanent fail** bo'ladi (aslida template yaratilgan) | P2 |
| Z3 | Contributor **o'z shablonini o'chira olmaydi** — delete faqat admin | P2 |
| Z4 | Admin review endpoint joriy statusni tekshirmaydi — allaqachon rad etilgan/DRAFT shablonni ham approve qilish mumkin | P3 |
| Z5 | `restore` (takedown'dan qaytarish) qayta `published` qilmaydi — admin buni sezmasligi mumkin | P3 |
| Z6 | Katalog standart tartibi `updatedAt desc`, `bumpTemplateCounter` esa har yuklab olishda `updatedAt` ni ko'taradi → **paginatsiya beqaror** (elementlar sahifalar orasida sakraydi/yo'qoladi) va thumbnail CDN keshi har yuklab olishda buziladi | P2 |
| Z7 | Thumb qayta yuklanganda `assets-uploaded` xom SQL bilan yozadi va `updatedAt` ni **ko'tarmaydi** → `?v=` cache-buster o'zgarmaydi → CDN `immutable, 1 yil` eski rasmni abadiy beradi (preview yo'li esa to'g'ri ishlaydi — nomuvofiqlik) | P2 |
| Z8 | Pack kengaytmasi almashsa (`.zip`→`.aep`) eski `.zip` **o'chirilmaydi**, `resolveS3AssetKey` esa `.zip` ni birinchi qaytaradi → DB `.aep` deydi, foydalanuvchi eski `.zip` baytlarini oladi, AE import xatosi. Contributor qayta yuklash bilan tuzata olmaydi | P1 |
| Z9 | Katalog `Cache-Control: public, s-maxage=300` — `CDN_BASE_URL` yo'q bo'lsa javobda signed URL'lar bo'ladi va **umumiy keshga tushadi**; bundan tashqari ETag har so'rovda o'zgaradi (signed URL ichidagi `X-Amz-Date`) → kesh umuman ishlamaydi | P2 |
| Z10 | Plagin versiya tekshiruvi: klient joriy versiyani yubormasa `updateAvailable=false` → **majburiy yangilanish eski klientlarga hech qachon yetmaydi** | P2 |

**Zanjir javobi:** contributor → admin → web → plagin zanjiri **uchidan uchiga ishlaydi** (jonli prod'da
15 aset shu yo'l bilan katalogga chiqqan, pack gate 401/409 to'g'ri qaytaradi). Lekin zanjir
**tasdiqlangandan keyin muhrlanmagan** va **kesh/kalit hal qilinishi qatlamida jim nosozliklar bor**.

---

## 6. 📈 KO'P SHABLON YUKLANGANDA NIMA BO'LADI?

Egasining aniq savoli. Javob: **~2000 shablondan boshlab sezilarli, ~10 000 da sinadi.**

### 6.1 Birinchi sinadigan nuqta — OOM

`GET /api/contributor/catalog` (`contributor.ts:3575`):
- **`requireAuth` YO'Q** — internetdagi har kim chaqira oladi
- **`take` / paginatsiya YO'Q** — barcha APPROVED shablonlar
- **`metaJson` to'liq tanlanadi** — sahna maʼlumotlari, shablon boshiga ~5KB

10 000 shablonda: ~50MB JSON, 1Gi Cloud Run instansida Prisma qatorlari + serializatsiya →
**OOM kill**. Global rate-limit 600 req/min/IP himoya bo'la olmaydi. Bu bir vaqtning o'zida
**DoS vektori** va **ommaviy maʼlumot eksfiltratsiyasi**.

### 6.2 N+1: har katalog sahifasida S3 LIST + DB yozuv

`assetKeysJson` null bo'lgan qator uchun `resolveCatalogAssets` → `syncTemplateAssetKeys` →
**jonli S3 ListObjectsV2 + DB UPDATE**. 100 qatorli sahifada = **100 ta S3 LIST + 100 ta UPDATE**,
DB pooli esa instansiga 10 ta ulanish. Ikkilamchi N+1: kalitlar topilmasa `resolveS3AssetKey`
shablon boshiga **27 tagacha ketma-ket HEAD** so'rovi yuboradi.

⚠️ Bundan ham muhimi: **perf harness noto'g'ri kod yo'lini o'lchagan.** `scripts/perf-seed-assets.mjs`
`assetKeysJson` ni **obyekt** sifatida yozadi, ishlab chiqarish esa **massiv** sifatida yozadi
(`persistTemplateAssetKeys`). `assetKeySetFromStored` `Array.isArray()` tekshiruvida yiqiladi →
lokal testda S3 sozlanmagani uchun `null` qaytadi va tez ko'rinadi. **50/500/5000 perf baseline'i
production xatti-harakatini o'lchamagan.**

### 6.3 Boshqa miqyos to'siqlari

| # | Muammo | Chegara |
|---|---|---|
| S1 | Har `GET /templates` so'rovida `previewTranscodeStatus` bo'yicha `updateMany` supurish — **indeks yo'q** → to'liq jadval skani + yozuv | 500k qatorda har dashboard yuklanishi |
| S2 | Qidiruv `ILIKE %q%` (name/description/catLabel/tags) — **trigram/GIN indeks yo'q** | 10k=~50ms, 100k=sekin |
| S3 | `ORDER BY name` uchun indeks yo'q | filtrlangan to'plamni to'liq saralaydi |
| S4 | `multer.diskStorage` 3300MB, lekin Cloud Run FS **RAM** (1Gi instansida) | 32MB HTTP/1 limiti oldin uradi → yo'l amalda buzilgan |
| S5 | Rate-limit **in-memory `Map`** (`rate-limit.ts:76`) | max-instances=10 → real limit 10× eʼlon qilingan qiymat |
| S6 | Upload-progress SSE in-memory pub/sub | SSE boshqa instansga tushsa **progress hech qachon kelmaydi** |
| S7 | Inline ingest worker **har instansda** yoqilgan (default) + har ~4s DB polling × 10 instans | doimiy Neon compute sarfi, scale-to-zero bo'lmaydi |
| S8 | Cloud Run `--concurrency` belgilanmagan → default **80** ta so'rov 1 vCPU instansda; ffmpeg bilan band instans baribir 80 ta so'rov qabul qiladi | katalog so'rovlari ochlikda qoladi |
| S9 | Broadcast xabar: har contributor uchun ketma-ket thread yaratish | 10k contributor'da timeout |
| S10 | `/api/admin/plugin-subscribers` — paginatsiyasiz `findMany` + join | mingdan ortiq obunachi |
| S11 | Admin "All templates" ko'rinishi — server paginatsiyasi ham, DOM virtualizatsiyasi ham yo'q; "Filter" tugmasi **placeholder** | ~1000 shablonda brauzer qotadi |
| S12 | Bulk upload **ketma-ket** ishlaydi (100×200MB = soatlar), **abort yo'q**, presigned URL'lar oldindan olinadi (muddati tugaydi), 30-daqiqalik poll deadline'idan keyin qatorlar **abadiy "Processing…"** da qoladi va o'chirilmaydi | 20+ fayl |

### 6.4 Konkret ssenariy: 50 contributor bir vaqtda 200MB pack yuklaydi

1. Presigned PUT to'g'ridan GCS'ga ketadi — **bu qism yaxshi**, API'ni bosmaydi.
2. `pack-uploaded` esa **sinxron** ishlaydi: GCS'dan yuklab olish + SHA256 + unzip + ffmpeg —
   `withIngestSlot` semafori bilan (instansiga 2 ta, jami ~20).
3. 50 ta so'rovning 30 tasi navbatda kutadi → Cloud Run 300s timeout → **504 kaskadi**.
4. Ayni paytda o'sha instanslar 80 tagacha katalog so'rovini ham qabul qiladi → hamma sekinlashadi.

**Birinchi to'siq: `pack-uploaded` ning sinxron og'ir quvuri + semafor navbati.**

---

## 7. 👤 USER YUKLASA — CONTRIBUTOR YUKLASHI SANALADIMI?

Egasining eng aniq savoli. **Javob: qisman HA — va bu bug.**

### 7.1 Shablon yuklash yo'li — rol bilan qulflangan ✅

`requireContributorOrAdmin` (`middleware/contributor.ts:12`) USER rolini **403 `CONTRIBUTOR_REQUIRED`**
bilan rad etadi. Barcha `/api/contributor/templates*`, `/upload-url`, `/pack-uploaded`, `/ingest`,
`/sync` shu bilan himoyalangan. O'z-o'zini contributor qilish yo'li **yo'q**: `users.ts:61`
`contributorRequestedAt` yozadi, admin `PATCH /admin/users/:id/role` bilan tasdiqlaydi
(oxirgi-admin himoyasi bilan). **Bu qism to'g'ri.**

### 7.2 Lekin "Add to Explore" teshigi — HA, sanaladi ❌

| Bosqich | Kod | Holat |
|---|---|---|
| USER AI generatsiya qiladi | `/api/studio/gen` | normal |
| USER "Add to Explore" bosadi | `studio-gen.ts:1940` | **rol tekshiruvi YO'Q** |
| Tizim `ContributorTemplate` yaratadi | `explore-submit.ts:201` | `contributorId = USER.id` |
| Admin moderatsiya qiladi | `PENDING_REVIEW → APPROVED` | admin buni oddiy shablondan **ajrata olmaydi** |
| Yuklab olinganda earning yoziladi | `download-events.ts:152` | ⚠️ filtr yo'q |
| Hovuz taqsimoti oladi | `earnings.ts:133` | ⚠️ 30% hovuz suyultiriladi |

Yaʼni: **oddiy foydalanuvchi rasmiy contributor bo'lmasdan turib marketpleysga kontent qo'shadi
va payout balansi to'playdi.** Kodning o'z izohi (`explore-submit.ts:29`) buning aksini daʼvo qiladi.

Kunlik cheklov bor (`EXPLORE_DAILY_CAP=20`) va `RIGHTS_TERMS_VERSION` yozib qo'yiladi — lekin
earning filtri yo'q.

### 7.3 USER yuklashida boshqa muammolar

| # | Muammo | Dar. |
|---|---|---|
| U1 | `promptPublic:false` saqlanadi lekin **server tomonda majburlanmaydi** — to'liq promptlar (4000 belgigacha) autentifikatsiyalangan katalogda VA `/api/public/asset/:id` orqali **anonim internetga** oqadi | P1 |
| U2 | USER o'zining Explore submissionini **hech qachon tahrirlay/o'chira olmaydi** — endpoint rol bilan gate'langan, egalik bilan emas | P2 |
| U3 | Explore muallif nomi ochiqlanmasdan **email'ning local-part'iga** tushib ketadi (`ali.valiyev@…` → "ali.valiyev") | P2 |
| U4 | Presigned reference-upload URL'ida **server tomonda hajm chegarasi yo'q** — kvota klient eʼlon qilgan hajmga qarshi tekshiriladi | P2 |
| U5 | GDPR hisob o'chirish `GenAsset`/`SavedReference` obyektlarini **storage'dan tozalamaydi** | P2 |
| U6 | Hisob o'chirilganda anonimlashtirilgan foydalanuvchining **ochiq email'i audit logga qayta yoziladi** | P2 |
| U7 | Admin "block contributor" endpointi oddiy USER hisobini **blokdan bosh tortadi** — Explore spam qiluvchi USER'ni to'xtatish yo'li yo'q | P3 |

**Yaxshi tomoni:** IDOR gigiyenasi mustahkam — o'z-shabloniga scoping, saqlangan referens egaligi,
obyekt-storage public/private allow-list — bularning hammasi tekshirildi va to'g'ri.

---

## 8. 🌐 WEB — katta va kichik muammolar

### 8.1 Muhandislik (kutilganidan yaxshi)

Idempotency kalitlari, poll tozalash, 401 ishlov berish, templating runtime'ining escaping'i —
hammasi to'g'ri qurilgan. Oldingi auditning bir necha shubhasi (idemKey/session-404 retry,
toast-retry kalit sizishi) **haqiqiy server kodiga qarshi tekshirilganda tasdiqlanmadi**.

| # | Muammo | Dar. |
|---|---|---|
| W1 | **17 ta ichki dizayn mockup (~992KB) + "Which panel?" ops sahifasi + dizayn-tizim referensi** production domenda ochiq turibdi (`prepare-cf-pages.mjs:87` `_*` ni istisno qilmaydi). Yo'l xaritasini oshkor qiluvchi sarlavhalar | P1 |
| W2 | O'z-hostli shriftlar (Hanken Grotesk / IBM Plex Mono) **2+ segmentli har qanday marshrutda 404** → SPA fallback → shrift jimgina umumiy shriftga tushadi. Aynan ulashiladigan katalog URL'lari shunday | P2 |
| W3 | "Sign out" faqat klient tomonda — **30 kunlik JWT server tomonda bekor qilinmaydi** | P2 |
| W4 | Checkout busy-lock (`_payBusy`) redirect amalga oshmasa **hech qachon tiklanmaydi** | P3 |

### 8.2 UI / UX

| # | Muammo | Dar. |
|---|---|---|
| X1 | **Obunani bekor qilish/boshqarish yo'li ilovada umuman yo'q**, FAQ esa "cancel anytime" deb vaʼda beradi | P1 |
| X2 | Checkout xato ishlov berish ilovaning **o'z sanitizatorini chetlab o'tadi** — xom backend satrlari (jumladan so'zma-so'z `NETWORK`) to'lov toast'ida mijozga ko'rinadi | P1 |
| X3 | Account sahifasi to'lov **"Paddle orqali"** deydi — haqiqiy protsessor **Lemon Squeezy** | P2 |
| X4 | LS variant sozlanmagan bo'lsa billing **xom dasturchi xatosini** qaytaradi | P2 |
| X5 | Klaviatura kirish imkoniyati: **0 ta `focus-visible` qoidasi**, `<label for=>` amalda yo'q, **107 ta** semantik bo'lmagan bosiladigan `div`/`span` | P2 |
| X6 | Bir domenda **3 xil tema tizimi**, 3 xil `localStorage` kaliti, mos kelmaydigan qiymatlar | P2 |
| X7 | Chindan bo'sh katalog natijasi — boshi berk ko'cha: umumiy matn + hech narsa tozalamaydigan "Clear filters" | P2 |
| X8 | Free plan "1 active project" deb eʼlon qiladi — server **hech qanday limit majburlamaydi** (`projects.ts:142`) | P2 |
| X9 | `<html lang>` atributi umuman yo'q | P3 |
| X10 | Mahsulot spetsifikatsiyasi o'zbekcha UI talab qiladi — butun ommaviy web **100% inglizcha** | P3 |
| X11 | Studio ($59/oy) kartasida 2 ta bullet, Pro ($19/oy) da 6 ta — qimmatroq tarif arzonroq ko'rinadi | P3 |
| X12 | "Jump back in" sarlavhasi tarixi bo'lmagan yangi foydalanuvchiga ham ko'rinadi | P3 |

### 8.3 Contributor Studio (taʼminot tomoni)

| # | Muammo | Dar. |
|---|---|---|
| C1 | **"Edit" tugmasi buzilgan** — `openTplDrawer` `UP_EDIT_ID` ni o'rnatmasdan upload'ga yo'naltiradi → contributor tahrirlash o'rniga **bulk yuklovchiga** tushadi | P1 |
| C2 | Bulk upload: ketma-ket, **abort yo'q**, 30-daqiqa poll deadline'idan keyin qatorlar abadiy "Processing…" da qotadi (`BULK_SUMMARY` o'rnatilmaydi, remove tugmasi yashirin) → **sahifani qayta yuklashdan boshqa chora yo'q** | P1 |
| C3 | Sessiya yuklash o'rtasida tugasa `request()` 401 da **darhol login'ga otadi** — ogohlantirish yo'q, qoralama saqlanmaydi, butun bulk yo'qoladi | P1 |
| C4 | Nav'da **Earnings/Payout bo'limi yo'q** — Settings ichida ko'milgan | P2 |
| C5 | "My Templates" gridi **soxta gradient** placeholder'lar ko'rsatadi (`thumbArt`), haqiqiy thumbnail esa faqat drawer'da — contributor o'z shablonlarini vizual ajrata olmaydi | P2 |
| C6 | `statusTimeline` **soxta** — haqiqiy statusdan qatʼi nazar doim "Submitted" + yaratilish sanasi | P2 |
| C7 | Bio textarea'ning `id` yo'q va **hech qachon saqlanmaydi** | P2 |
| C8 | Fayl "pill" havolalari `target=_blank` bilan auth header'siz asset endpoint'ga boradi → **401, buzilgan havolalar** | P2 |
| C9 | Overview'dagi topbar qidiruvi **o'lik** (faqat templates ko'rinishida qayta render qiladi) | P2 |
| C10 | Hard/soft rejectni aniqlash review izohidagi `[hard]` markeriga qarab — admin markerni unutsa cheksiz qayta topshirish ochiladi | P2 |
| C11 | `login.html:193` production foydalanuvchisiga **"In a separate terminal: npm run dev:api"** deb yozadi (`admin-login.html:171` ham) | P2 |
| C12 | Register/Login tugmalarida **loading/disabled holati yo'q** — sovuq API'da bir necha marta yuborish mumkin | P3 |
| C13 | Notifications kartasi — placeholder | P3 |
| C14 | Sessiya `sessionStorage` da → yangi tabda qayta login talab qilinadi | P3 |

### 8.4 Admin panel (operator yuzasi)

| # | Muammo | Dar. |
|---|---|---|
| A1 | Bulk moderatsiya tanlovi **filtr/kategoriya almashganda saqlanib qoladi**, bulk-approve'da esa **hech qanday tasdiqlash dialogi yo'q** → ko'rinmayotgan shablonlarni tasdiqlab yuborish | P1 |
| A2 | **DMCA/takedown tizimining backend'i to'liq va audit qilingan — lekin admin UI umuman yo'q.** Kelgan shikoyatni operator ko'ra olmaydi (huquqiy xavf) | P1 |
| A3 | Marketplace Settings "Save" **hech narsa saqlamaydi**, lekin muvaffaqiyat deb ko'rsatadi | P2 |
| A4 | Plan chegirma/promo bo'limi **100% localStorage** — obunachilarga hech qachon yetmaydi | P2 |
| A5 | "Clear logs" autentifikatsiyasiz so'rov yuboradi, **doim jimgina yiqiladi**, lekin muvaffaqiyat deb ko'rsatadi | P2 |
| A6 | "System logs" bitta **efemer JSON faylga** tayanadi — Cloud Run'da ishonchsiz | P2 |
| A7 | Users&Roles "Status" ustuni faqat contributor-block holatini ko'rsatadi; **umumiy hisob to'xtatish yo'q** | P2 |
| A8 | Subscriber Generations paneli faqat o'qish, **qattiq 40 element**, per-item refund yo'q (server paginatsiyani qo'llab-quvvatlasa ham) | P3 |

---

## 9. 🔌 PLAGIN

### 9.1 Bozorga tayyorlik: **~35%**

**Muhandislik tayyorligi juda yuqori:** fail-closed preflight/build/test asboblari, 700+ lokal
assertion, CI'da **haqiqiy Windows E2E install/uninstall isboti**, xavfsiz self-updater,
tashqi brauzerda LS checkout.

**Biznes tayyorligi ~0%:** imzolangan `.zxp` yo'q, Adobe Developer Distribution akkaunti/sertifikati
hech qayerda yo'q, submission metadata'ning **16/19 maydoni** `"OWNER-INPUT-REQUIRED"`.
Kod bir necha soat ichida topshiriladigan `.zxp` yasashi mumkin — yetishmayotgani sertifikat va listing kontenti.

### 9.2 Yadro muhandisligi

**Yaxshi:** atomik `.part`+rename yozuvlar, redirectda cross-origin `Authorization` header'ini olib
tashlash, host.jsx'da undo-group intizomi va xatoda rollback, nozik 401/403 sessiya-bekor qilish
modeli, CI `.debug` profilini paketdan chiqarishni majburlaydi.

| # | Muammo | Dar. |
|---|---|---|
| P1a | **Windows'da zip import ishlamaydi** (`unzip` shell) — tuzatish Admin panelida bor, mijoz plaginiga ko'chirilmagan | P0 |
| P1b | "Clear download cache" va "Remove from project" **P9-formatdagi ekstraktsiya papkalarini hech qachon o'chirmaydi** — kesh cheksiz o'sadi, UI esa muvaffaqiyat deydi | P1 |
| P1c | Yuklab olingan shablonni o'chirish **comp/papka nomi mos kelgan HAR QANDAY loyiha elementini** o'chiradi | P1 |
| P1d | `expectedSha256` yaxlitlik tekshiruvi **abadiy no-op** — hech bir chaqiruvchi hash bermaydi | P2 |
| P1e | AE `evalScript` import chaqiruvlarida **timeout/hang-guard yo'q** — qotib qolgan host.jsx progress overlay'ni abadiy muzlatadi | P2 |
| P1f | Server tomonga log yuborish **jimgina o'lik** — har POST'da `Authorization` header yo'q → 401 va yutiladi | P2 |
| P1g | Yetishmayotgan shriftlarni hal qiluvchi **rozilik so'ramasdan** Google'dan shrift yuklab, OS shrift papkasiga / Windows registriga yozadi | P2 |
| P1h | Token va prefs **ochiq JSON** sifatida diskda (keychain/DPAPI yo'q) | P3 |
| P1i | `settingsFilePath()` har platformada **macOS yo'lini** qattiq kodlaydi | P3 |
| P1j | Lokal meta-store read-modify-write'da qulf yo'q | P3 |

### 9.3 Plagin UI/UX

**Yaxshi:** generate → cost-quote → charge → poll sikli mustahkam va halol so'zlangan
(`friendlyError`, sarfdan oldin narx ko'rsatiladi, model katalogi to'liq serverdan → web bilan
hech qachon farq qilmaydi).

| # | Muammo | Dar. |
|---|---|---|
| PU1 | **Uchayotgan generatsiya jobi panel yopilsa yoki AE chiqsa abadiy ko'rinmas bo'ladi.** Klient xotirasi — oddiy JS massiv, persistence yo'q; server `history`/`recent` esa `status="done"` ni qattiq kodlagan. Aynan "10 daqiqalik video" ssenariysi. Yagona iz — Settings > Credit History'dagi refund qatori (agar refund bo'lgan bo'lsa) | P1 |
| PU2 | Uchayotgan generatsiyani **bekor qilish imkoniyati umuman yo'q** (plaginda ham, API'da ham) — "Cancel" faqat lokal kartani yashiradi | P2 |
| PU3 | "Auto-load (Project selection)" sozlamasi **butunlay dekorativ** — hech narsa qilmaydi | P2 |
| PU4 | Video-gen "≈ 1–2 min" maslahati real kutish vaqtini jiddiy kamaytirib ko'rsatadi | P3 |
| PU5 | "AI describe" — **butunlay o'lik kod**, hech bir DOM elementi chaqirmaydi | P3 |
| PU6 | To'liq AE demo-mockup (va o'lik prototip holati) **production panel bundle'i ichida** jo'natiladi | P3 |
| PU7 | AI natija kartalari faqat bosish bilan import, katalog kartalari esa drag qilinadi — nomuvofiq | P3 |
| PU8 | Oflayn/ulanish aniqlash **umuman yo'q** | P3 |
| PU9 | Panel HTML'da **CSP yo'q** (Node kirishi + keng `innerHTML` bilan) — hozir faqat qo'lda escaping bilan yumshatilgan | P3 |
| PU10 | macOS `.pkg` da **uninstaller yo'q** (Windows MSI'da bor) | P3 |
| PU11 | CSXS manifestida `<Icons>` elementi yo'q | P3 |
| PU12 | In-panel self-updater OS darajasidagi `.pkg/.msi/.exe` ni Creative Cloud Desktop'dan tashqarida ishga tushiradi — **Adobe siyosatiga muvofiqligi repo'ning o'zida hal qilinmagan savol** | P2 |

---

## 10. 🔒 XAVFSIZLIK

**Yaxshi:** IDOR gigiyenasi keng ko'lamda tekshirildi va **mustahkam** — egalik filtrlari haqiqiy;
JWT_SECRET production'da majburlanadi; reset-token va verify-token maydonlari ajratilgan
(verify tokenini reset uchun ishlatib bo'lmaydi); `proSwitchAllowed` **fail-closed** va
production'da `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE="false"` (yaʼni o'z-o'zini PRO qilish **mumkin emas** —
COWORK shubhasi bu yerda tasdiqlanmadi); pack gate 401/402/403/409/451 to'g'ri ishlaydi.

| # | Muammo | Dar. |
|---|---|---|
| S1 | **Device-code phishing:** `/device/start` autentifikatsiyasiz va cheksiz, kod `crypto.randomBytes(4)` = **32 bit entropiya**; `device.html?code=<hujumchi kodi>` havolasi bilan qurbon Google orqali kirsa — **hujumchining plagini qurbonning tokenini oladi**. Foydalanuvchi tomonida "bu kodni siz kiritdingizmi?" tasdig'i yo'q | P1 |
| S2 | `/api/logs` — istalgan autentifikatsiyalangan foydalanuvchi **chegarasiz `meta`** JSON yozadi (boshqa maydonlar `clip()` qilinadi, `meta` **qilinmaydi**); har POST 500-qatorli faylni **sinxron qayta yozadi** → disk/xotira tugatish + event loop bloklash | P2 |
| S3 | Google hisob **avtomatik bog'lanishi**: tasdiqlanmagan parolli hisob mavjud bo'lsa, o'sha email bilan Google kirishi unga bog'lanadi → **pre-hijacking** (hujumchi avval ro'yxatdan o'tadi, qurbon Google bilan kiradi, hujumchining paroli ishlaydi) | P2 |
| S4 | `/api/plugin/catalog` **autentifikatsiyasiz** o'qiladi va `externalId` orqali `incoming/<contributorUserId>/<fayl nomi>` ni oshkor qiladi | P2 |
| S5 | Avatar endpointi autentifikatsiyasiz → foydalanuvchi ID enumeratsiyasi; tashqi rasm URL'i bo'lsa ochiq redirect | P2 |
| S6 | Scene-preview asseti autentifikatsiyasiz **har qanday** shablon uchun (nashr etilmaganlar ham) beriladi; `sceneKey()` sanitizatsiyasi mogrt uchun qo'llanadi, scene-preview uchun **yo'q** | P2 |
| S7 | Login `contributorBlockedAt` ni **token imzolangandan keyin** tekshiradi | P3 |
| S8 | `/2fa/disable` backup kodni isteʼmol qiladi, lekin qolganlarini **saqlamaydi** | P3 |
| S9 | DMCA `/report` faqat global 600/min limit bilan — spam mumkin | P3 |

---

## 11. ⚙️ INFRA / OPERATSIYA

**Yaxshi:** GitHub Actions Cloud Run quvuri chindan puxta — migratsiya bilan gate'langan,
SHA-tagged, health-gated rollout. `gen-processor` claim/refund va ingest-worker `SKIP LOCKED`
mantiqida real race intizomi bor.

| # | Muammo | Dar. |
|---|---|---|
| I1 | `demo:clear` — filtrsiz jadval o'chirish (yuqorida P0-A) | P0 |
| I2 | `deploy-cloudrun.sh` (qo'lda deploy) **migratsiyalarni ishga tushirmaydi** va faqat o'zgaruvchan `:latest` tegini pushlaydi — CI yo'lidagi gate'ni chetlab o'tadi | P1 |
| I3 | Asosiy API jarayonida **graceful shutdown umuman yo'q** — SIGTERM/SIGINT ushlanmaydi | P1 |
| I4 | `verify-pipeline.mjs` (prod'ga qarshi ishlatish hujjatlashtirilgan) **haqiqiy katalogga soxta shablon nashr qiladi** va tozalamaydi | P1 |
| I5 | 8 ta `test:*` skriptdan **7 tasi CI'da hech qachon ishlamaydi** — jumladan 2 ta xavfsizlik testi va 700+ assertionli plagin to'plami | P1 |
| I6 | `SENTRY_DSN` production env'da **yo'q** va yo'qligi hatto ogohlantirilmaydi | P2 |
| I7 | Resumable "running" generatsiyalar "queued" uchun ishlatiladigan atomik claim'ni **chetlab o'tadi** → instanslararo dublikat asset yozuvi | P2 |
| I8 | Template reconciler'lar find-then-touch ishlatadi → dublikat transcode/embedding ishi | P2 |
| I9 | `/health` autentifikatsiyasiz, keshlanmaydi va global rate limiter'dan **oldin** ro'yxatdan o'tadi | P2 |
| I10 | CDN edge Worker API'ning allow-list manbasini import qiladi, lekin o'zgarishga bog'langan **avtomatik redeploy yo'q** | P2 |
| I11 | Production Docker `npm install --include=dev` ishlatadi (`npm ci` emas) — CI tasdiqlagan narsadan farq qiladi | P2 |
| I12 | Production runtime va CI **Node 20** (rasmiy EOL o'tgan) | P2 |
| I13 | Repo ildizidagi eski `render.yaml` hali ham migratsiyagacha bo'lgan domenlarni ko'rsatadi | P2 |
| I14 | `cloudrun-env.yaml` **jonli maxfiy kalitlar bilan** repo ildizida ochiq turibdi (git'da kuzatilmaydi, lekin diskda va build kontekstidan faqat `.dockerignore` chiqaradi) | P1 |
| I15 | `migration_lock.toml` yo'q | P3 |
| I16 | `deploy-ingest-worker.sh` bir-birini istisno qiluvchi gcloud bayroqlarini uzatadi — **skript yozilganidek ishlay olmaydi** | P3 |
| I17 | Oylik narx-rekonsiliatsiya rejalashtiruvchisida boot-time drift bug'i → **hech qachon ishlamaydi** | P3 |
| I18 | `_to_delete/` katalogi Docker build kontekstidan chiqarilmagan | P3 |

---

## 12. 📣 OMMAVIY DAʼVOLAR / HUQUQ / NARX HAQIQATI

| # | Muammo | Dar. |
|---|---|---|
| L1 | `terms.html:80` **mavjud bo'lmagan Premiere Pro plaginini** daʼvo qiladi — `plugins/premiere-uxp` bo'sh katalog | P1 |
| L2 | `verify-public-copy.mjs` ~9 ta ommaviy fayldan faqat **2 tasini** skanerlaydi — barcha huquqiy sahifalar (`terms`, `privacy`, `refund`, `dmca`, `help`) **ko'r nuqtada**, eng yomon buzilish aynan o'sha yerda | P2 |
| L3 | Landing'dagi **4 ta AI kredit narxining hammasi** haqiqiy standart model narxiga mos kelmaydi; SFX kam ko'rsatilgan (mijozdan eʼlon qilinganidan **ko'proq** olinadi) | P2 |
| L4 | Studio tarifi DB'da **6 000 kredit/oy** beradi (migratsiya `ON CONFLICT DO NOTHING` bilan eski qiymatni qo'ygan), har bir ommaviy sahifa esa **3 000** deb eʼlon qiladi — hujjatlashtirilgan qo'lda tuzatish bajarilmagan | P2 |
| L5 | To'rtala huquqiy sahifaning **ommaviy HTML manbasida** "needs lawyer review" / LEGAL-TODO izohlari jonli turibdi | P2 |
| L6 | `help.html:91` hali ham 4K importni Pro imtiyozi deb eʼlon qiladi — bu gate mahsulotdan **olib tashlangan** | P2 |
| L7 | "30+ til" ovoz daʼvosi **yolg'on** — jonli provayder konfiguratsiyasida **10 ta** til bor | P2 |
| L8 | Free tarifning "1 active project" limiti (va Pro'ning "Unlimited projects" imtiyozi) **hech qayerda majburlanmaydi** | P2 |
| L9 | Huquqiy sahifalarda kompaniya yuridik nomi, yurisdiksiya/amaldagi qonun bandi, minimal yosh yo'q | P3 |
| L10 | **Hech qanday SEO/OG/meta tavsif tegi, `robots.txt`, `sitemap.xml` yo'q** | P3 |

---

## 13. ✅ NIMA CHINDAN YAXSHI

Buni ham aytish adolatli — loyihada bir necha joyda sifat kutilganidan yuqori:

1. **Atomik kredit naqshi** — `updateMany` + `gte` guard, refund'da `refunded:false` claim.
2. **Fail-closed gate'lar** — `packScanStatus` null/pending bo'lsa **hech kimga** serve qilinmaydi
   (admin ham); `proSwitchAllowed` flagsiz PRO bermaydi; takedown 451 hammaga.
3. **Ingest xavfsizligi** — zip-slip, zip-bomb, streaming (762MB zip = 167MB RSS), `SKIP LOCKED` claim.
4. **CI Cloud Run quvuri** — migratsiya-gated, SHA-tagged, health-gated rollout.
5. **Plagin yuklab olish quvuri** — atomik `.part`+rename, redirectda `Authorization` olib tashlash,
   undo-group rollback, CI'da haqiqiy Windows E2E.
6. **Model katalogi to'liq serverdan** — plagin va web hech qachon farq qila olmaydi.
7. **Moderatsiya navbati** — real bulk endpoint, per-item xato ishlovi, majburiy tiplangan rad sababi.
8. **Web SPA** — idempotency kalitlari, poll tozalash, templating escaping to'g'ri.
9. **RevenueEvent ledger** va `webhookEvent` dedup claim naqshi (Stripe tomonida to'g'ri ishlaydi).
10. **`verify-public-copy.mjs`** — soxta statistika/testimonial regressiyasini haqiqatan bloklaydi
    (qamrovi tor bo'lsa ham, mavjudligi kam uchraydigan intizom).

---

## 14. 🎯 TUZATISH TARTIBI

### Bugun (bozorga chiqishdan oldin, muzokara qilinmaydi)
1. **Prod DB'ni tiklash** + `SENTRY_DSN` qo'shish + uptime monitor (§0).
2. `demo:clear` ga prod-guard + `--yes` + filtr (P0-A).
3. Windows zip import tuzatishini Admin paneldan mijoz plaginiga ko'chirish + shell'ni butunlay
   olib tashlash (P0-B).
4. `/api/contributor/catalog` ga `requireAuth` + `take` + `metaJson` ni olib tashlash (§6.1).
5. Explore earning filtri: `templateType`/`aiSource` bo'yicha earning yozmaslik (§4.3).
6. LS mijozi uchun "Free" tugmasini bloklash yoki `Subscription` qatorini LS webhook'da yozish (B1/B2).

### Shu hafta
7. M1 + M2 atomik increment'ga o'tkazish; M4 status guard; M5 refund yo'li.
8. `/sync` va `/pack-uploaded` da APPROVED shablonni `PENDING_REVIEW` ga qaytarish (§5.2).
9. `grantAiCreditsTopup` ga order-id idempotentligi (B3).
10. M3 (Seedance 4K video-ref) va M8 (SFX) narxini tuzatish — hozir har chaqiruvda pul yo'qotiladi.
11. `prepare-cf-pages.mjs` da `_*` istisnosi (W1).
12. `promptPublic` ni server tomonda majburlash (U1).
13. Marketplace metadata + `.zxp` sertifikati (P0-C) — bu egadan kiritish talab qiladi.

### Shu oy
14. Miqyos: `assetKeysJson` backfill + N+1 yo'q qilish, `previewTranscodeStatus` indeksi,
    trigram indeks, katalog tartibini `updatedAt`dan ajratish, `pack-uploaded` ni asinxron qilish.
15. Contributor Studio: Edit tugmasi, bulk abort/qayta tiklash, sessiya tugashini boshqarish.
16. Admin: DMCA UI, bulk-select tasdiqlash, "Save" tugmalarining yolg'on muvaffaqiyatini tuzatish.
17. Huquqiy sahifalar (L1–L7) + `verify-public-copy.mjs` qamrovini kengaytirish.
18. Device-code oqimiga foydalanuvchi tasdig'i (S1); graceful shutdown (I3); CI'ga test:* ulash (I5).

---

*Audit yakunlandi: 2026-07-30. Har bir topilma real kodda tekshirilgan; jonli prod holati
yuqorida ko'rsatilgan vaqtdagi holatdir.*
