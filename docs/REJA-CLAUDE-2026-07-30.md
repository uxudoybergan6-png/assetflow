# REJA — CLAUDE BAJARADIGAN ISHLAR

> **Bu fayl o'zi-yetarli.** Yangi sessiyada (`/clear` dan keyin) shu faylni o'qib ishni boshlash mumkin.
> Suhbat konteksti kerak emas.

**Repo:** `/Users/usmonov/Projects/creative-tools-saas` · **Branch:** `main`
**Manba hujjatlar (repoda, o'qing):**
- `docs/MUAMMOLAR-2026-07-30.md` — 157 muammoning raqamlangan ro'yxati (bu rejadagi `#N` shunga ishora)
- `docs/FULL-AUDIT-2026-07-30.md` — har muammoning batafsil tushuntirishi, dalili, tavsiyasi

---

## 0. ISHLASH QOIDALARI (buzmang)

1. **Commit:** vazifa tugagach `main` ga o'zing commit qil. **Branch YO'Q, push YO'Q.**
2. **`Co-Authored-By` qatorini commit'ga YOZMA** — Vercel deploy'ni bloklaydi.
3. **Studio manba fayllari:** faqat `packages/assetflow-studio/js/` va `packages/assetflow-studio/styles/`
   ga edit qil. `studio/js/`, `admin/js/`, `studio/styles/` — **build artefakti**, qayta yoziladi.
   Edit'dan keyin: `npm run studio:sync`.
4. **UI matnlari o'zbekcha** (ommaviy web hozircha inglizcha — uni o'zgartirma, #131 alohida task).
5. **Minimal diff**, mavjud konventsiyaga mos.
6. Har batch tugagach `docs/SESSION-REPORT.md` ni yangila (maks 15 qator, almashtirib).
7. **Migratsiya kerak bo'lsa** — migratsiya faylini yoz, lekin **prod'ga o'zing qo'llama**;
   `docs/SESSION-REPORT.md` da "migratsiya kutilmoqda" deb yoz.
8. Har batch oxirida build tekshir: `npm run build -w apps/api`.

---

## 1. TEGMASLIK KERAK (allaqachon to'g'ri — auditda tasdiqlangan)

Bu joylarni "tuzatish"ga urinma, ular ataylab shunday:

- `proSwitchAllowed` (`apps/api/src/lib/plugin-profile.ts:206`) — **fail-closed**, to'g'ri.
- `packScanStatus` null/pending → 409 (`plugin.ts:508` `guardDownloadable`) — **hech kimga**
  (admin ham) serve qilmaslik ataylab.
- `requireContributorOrAdmin` (`apps/api/src/middleware/contributor.ts:12`) — USER'ni to'g'ri rad etadi.
- `consumeAiCredits` / `consumeDownload` / `consumeImport` — atomik `updateMany`+`gte` naqshi to'g'ri.
- Zip-slip / zip-bomb himoyasi, `SKIP LOCKED` ingest claim — to'g'ri.
- IDOR egalik filtrlari — keng tekshirilgan, to'g'ri.
- `.dockerignore` — mavjud va `.env*`, `cloudrun-env.yaml` ni chiqaradi.
- Stripe webhook dedup claim naqshi — to'g'ri (faqat LS tomoni buzuq).

---

## 2. EGASIDAN JAVOB KUTILADIGAN TASKLAR

Quyidagilarni **egasi qaror aytmaguncha boshlama**. Agar javob berilmagan bo'lsa — so'ra, keyin qil.
(To'liq ro'yxat: `docs/REJA-SIZ-2026-07-30.md` §7)

| # | Task | Kerakli qaror |
|---|---|---|
| #7 | Seedance 4K narxi | (a) kombinatsiyani o'chirish / (b) yangi kredit/s / (c) chegirmani olib tashlash |
| #118 | Studio tarifi | 6 000 yoki 3 000 kredit/oy |
| #13 | Payout siyosati | AI kontent earning beradimi |
| #38 | Premiere daʼvosi | olib tashlash yoki qoldirish |
| #121 | "30+ til" | "10+" ga tuzatish yoki til qo'shish |
| #102 | Self-updater | saqlash yoki xabarga aylantirish |
| #78 | LS variant ID | monthly / yearly raqamlari |
| #22 | Cancel URL | LS customer portal havolasi |
| #156 | Huquqiy maʼlumot | yuridik nom, yurisdiksiya, yosh, DMCA agent |
| #3 | Marketplace 16 maydon | listing matnlari |
| #108 | Sentry | DSN qo'shildimi (kod ishini baribir qil) |

**Qolgan hamma taskni javob kutmasdan boshla.**

---

## BATCH 0 — XAVFSIZLIK TO'SIQLARI (birinchi, deploy'siz)

Bu batch hech narsani buzmaydi, lekin keyingi ishlarni xavfsiz qiladi.

### T0.1 — `demo:clear` prod-guard *(#1, P0)*
**Fayl:** `scripts/clear-assetflow-demo.mjs:37`
**Muammo:** `ContributorTemplate`, `StudioAuditLog`, `StudioMessage` jadvallarini filtrsiz
`deleteMany({})` bilan o'chiradi. `DATABASE_URL` prod'ga qaragan holda bir marta ishga tushirish =
butun marketpleys yo'qoladi. CLAUDE.md'da oddiy buyruq sifatida hujjatlashtirilgan.
**Tuzatish:**
1. `DATABASE_URL` ichida `neon.tech`, `prod`, `getframeflow` bo'lsa → darhol `process.exit(1)`
   va aniq xato matni.
2. `--yes` bayrog'i bo'lmasa → nima o'chirilishini sanab, tasdiq so'ra.
3. `--dry-run` qo'sh — faqat sanaydi.
4. Faqat demo maʼlumotni o'chir: `where` bilan (seed marker yoki `createdAt` oralig'i),
   `deleteMany({})` ni butunlay olib tashla.
5. `CLAUDE.md` dagi "Foydali buyruqlar" bo'limiga ⚠️ ogohlantirish qo'sh.
**Tekshirish:** `DATABASE_URL=postgres://…neon.tech… node scripts/clear-assetflow-demo.mjs` → exit 1.

### T0.2 — `_to_delete/` Docker kontekstidan chiqarish *(#155)*
**Fayl:** `.dockerignore` — `_to_delete/` qatorini qo'sh.

### T0.3 — `render.yaml` o'chirish *(#115)*
Repo ildizidagi eski `render.yaml` migratsiyagacha bo'lgan domenlarni ko'rsatadi. O'chir.

---

## BATCH 1 — PUL OQIB KETISHI (eng yuqori ustuvorlik)

### T1.1 — Oylik reset race *(#5 / M1, P1)*
**Fayl:** `apps/api/src/lib/plugin-profile.ts:595`
**Muammo:** oylik kredit reseti **shartsiz absolyut yozuv** — oy boshida N ta parallel so'rov
har biri balansni to'liq ulushga qaytaradi → bepul kredit zarb qilinadi.
**Tuzatish:** shu faylning **450-qatorida to'g'ri guard naqshi bor** — o'shani nusxa ol:
`updateMany` + `where: { aiCreditsResetAt: { lt: periodStart } }` bilan atomik qil, natijada
0 qator o'zgarsa reset boshqa so'rov tomonidan bajarilgan deb hisobla.
**Tekshirish:** bir userga 10 ta parallel `ensurePluginProfile` → balans faqat 1 marta tiklanadi.

### T1.2 — `refundAiCredits` atomik emas *(#6 / M2, P1)*
**Fayl:** `apps/api/src/lib/plugin-profile.ts:688`
**Muammo:** eski o'qilgan balansdan `newBalance` absolyut yoziladi → refund paytida ketgan
parallel sarfni **o'chirib yuboradi**.
**Tuzatish:** `update({ data: { aiCredits: { increment: amount } } })` — absolyut yozuvni
increment'ga almashtir. `refunded: false` claim guard'ini saqlab qol.
**Tekshirish:** refund + parallel `consumeAiCredits` → ikkalasi ham hisobga olinadi.

### T1.3 — Refund ceiling jimgina 0 ga tushadi *(#43 / M9, P2)*
**Fayl:** `apps/api/src/lib/plugin-profile.ts:687` — oylararo ceiling hisobini qayta ko'r;
refund 0 ga tushsa **log yoz** (jimgina yutma).

### T1.4 — `DELETE /gen/:jobId` status guard *(#8 / M4, P1)*
**Fayl:** `apps/api/src/routes/studio-gen.ts:2019`
**Muammo:** `running` job o'chiriladi → (a) konkurentlik cheklovi chetlab o'tiladi,
(b) job keyin fail bo'lsa refund `updateMany` 0 qator topadi → **refund hech qachon bo'lmaydi**.
**Tuzatish:** faqat `status in ("done","failed","cancelled")` bo'lsa o'chirishga ruxsat ber;
`running`/`queued` uchun 409 + "avval bekor qiling" xabari.

### T1.5 — `generation.create` xatosida refund *(#39 / M5, P2)*
**Fayl:** `apps/api/src/routes/studio-gen.ts:1557` — hozir faqat `P2002` refund qiladi.
**Tuzatish:** `try/catch` ni **har qanday** xatoga kengaytir → kredit refund qil, keyin xatoni qайta ot.

### T1.6 — `MAX_ACTIVE_GENERATIONS` atomik emas *(#40 / M6, P2)*
**Fayl:** `apps/api/src/routes/studio-gen.ts:1521` — check-then-act.
**Tuzatish:** DB darajasida hisobla (`count` + `create` bitta tranzaksiyada) yoki
`PluginProfile` da `activeGenerations` hisoblagichini atomik increment/decrement qil.

### T1.7 — `ModelPricing.enabled` tekshirilmaydi *(#41 / M7, P2)*
**Fayl:** `apps/api/src/lib/gen-models.ts:1548`
**Muammo:** bayroq saqlanadi, ko'rsatiladi, PATCH qilinadi — lekin generatsiyada **hech qachon**
tekshirilmaydi. Admin modelni "o'chirsa" ham u ishlayveradi.
**Tuzatish:** `/gen` va `/gen/cost-quote` da model `enabled === false` bo'lsa 400 qaytar.

### T1.8 — Cost-floor guard *(#7 / M3 + #42 / M8)*
**Fayl:** `apps/api/src/lib/gen-models.ts`
**Muammo:** Seedance 3102 @4K + video-ref chegirmasi bilan provayder narxidan past sotiladi
(15s = −$2.28). SFX 4001 ham maksimal davomiylikda zararga.
**Tuzatish (egasining qaroridan qatʼi nazar qilinadi):** `computeGenCost` natijasini
`estimateProviderUsd` bilan solishtiruvchi **umumiy floor guard** qo'sh — sotuv narxi provayder
narxidan past bo'lsa (a) log/Sentry ogohlantirish, (b) narxni floor'ga ko'tar.
Bu kelajakdagi har qanday model uchun ham himoya bo'ladi.
**Egasi qaror aytgach:** #7 uchun tanlangan variantni ham qo'lla.

### T1.9 — Quote server tomonda qayta hisoblanmaydi *(#123 / M10, P3)*
**Fayl:** `apps/api/src/routes/studio-gen.ts:1485` — imzo tekshiriladi, lekin narx qayta
hisoblanmaydi. Imzo bilan birga narxni ham qayta hisoblab, farq bo'lsa rad et.

### T1.10 — Kvota baytlardan oldin yonadi *(#44, P2)*
**Fayl:** `apps/api/src/routes/plugin.ts:508` (`guardDownloadable`) va `:615`
**Muammo:** `consumeDownload` **`serveTemplateAsset` dan oldin** ishlaydi; asset S3'da yo'q bo'lsa
404 qaytadi va Free userning oylik 15 ta yuklab olishidan biri bekorga yonadi (klient retry bilan 2×).
**Tuzatish:** asset mavjudligini (HEAD / `assetKeysJson`) **avval** tekshir, keyin `consumeDownload`.
Yoki serve muvaffaqiyatsiz bo'lsa kvotani qaytar.

### T1.11 — Fire-and-forget pul yozuvlari *(#14, P1)*
**Fayl:** `apps/api/src/routes/plugin.ts:586`, `:620`, `:1123`
**Muammo:** `void recordTemplateDownloadEvent(...)` — Cloud Run javobdan keyin CPU'ni throttle
qiladi → yuklab olish hodisasi va contributor earning'i **jimgina yo'qoladi**.
(Bu tuzoq loyihada tan olingan: `pack-uploaded` da `await` bilan tuzatilgan — o'sha naqsh.)
**Tuzatish:** uchalasini ham `await` qil.

### T1.12 — Explore earning hovuzni ifloslantiradi *(#13, P1 — egasi qarori kerak)*
**Fayllar:** `apps/api/src/lib/download-events.ts:152`, `apps/api/src/lib/earnings.ts:133`,
`apps/api/src/lib/explore-submit.ts:29,201`, `apps/api/src/routes/studio-gen.ts:1940`
**Muammo:** oddiy USER `POST /gen/:jobId/explore` chaqiradi (rol tekshiruvi yo'q) →
`ContributorTemplate` yaratiladi (`contributorId = USER.id`) → yuklab olinganda
`kind:"download"` earning yoziladi (tur filtrlanmaydi) → 30% payout hovuzi suyuladi.
`explore-submit.ts:29` dagi izoh "Payout YO'Q" deydi — **amalda bajarilmagan**.
**Tuzatish (variant (a) tanlansa):**
1. `download-events.ts:152` da `templateType`/`aiSource` bo'yicha filtr — AI kontent uchun
   earning qatori yozilmasin.
2. Admin moderatsiya ro'yxatida AI-Explore shablonini ajratuvchi badge qo'sh.
3. `explore-submit.ts` izohini kod bilan moslashtir.

---

## BATCH 2 — BILLING / OBUNA

### T2.1 — LS `Subscription` qatorini yozish *(#9 / B1, P1)*
**Muammo:** `prisma.subscription` faqat `stripe.ts:36,135` va `google-auth.ts:59` tomonidan
yoziladi. Lemon Squeezy webhook **faqat** `PluginProfile.plan` ni o'zgartiradi →
`subscriptionIsPro()` (`plugin-profile.ts:198`) har LS mijozi uchun `false`.
**Tuzatish:** LS webhook handler'ida Stripe'dagi kabi `Subscription` upsert qil
(`userId`, `status`, `currentPeriodEnd`, provider = `lemonsqueezy`).

### T2.2 — LS mijozi "Free" bossa qamaladi *(#10 / B2, P1)*
**Fayl:** `apps/api/src/lib/plugin-profile.ts:215` (`setPluginPlan`), `routes/plugin.ts:1063` (`PATCH /plan`)
**Muammo:** FREE ga tushirishda hech qanday obuna tekshiruvi yo'q; qaytish uchun
`subscriptionIsPro()` kerak → LS mijozi uchun doim `false` → "PRO requires a Stripe subscription".
LS esa pul olishda davom etadi. Yagona chiqish — ikkinchi marta sotib olish.
**Tuzatish:** T2.1 bajarilgach bu o'z-o'zidan hal bo'ladi, lekin **qo'shimcha**:
faol obunasi bor foydalanuvchi FREE ni bosganda ogohlantirish ko'rsat
("Obunangiz faol — bekor qilish uchun ___ ga o'ting") va plan'ni o'zgartirma.

### T2.3 — LS webhook dedup *(#11 / B3, P1)*
**Muammo:** qisman xatoda `catch` dedup-yozuvini o'chiradi → LS retry butun handler'ni qayta
ishga tushiradi → kredit **2×** beriladi.
**Tuzatish:** `grantAiCreditsTopup` ga **order-id idempotentligi** qo'sh (unique constraint +
`P2002` da jimgina o'tkazib yubor). `catch` da dedup-yozuvni **o'chirma**.

### T2.4 — Pause/resume kredit tiklash *(#12 / B4, P1)*
Pause → resume sikli **yangi to'lovsiz** oylik AI kreditlarini to'liq tiklaydi.
Reset'ni faqat haqiqiy billing davri boshlanganda (`currentPeriodStart` o'zgarganda) bajar.

### T2.5 — `reconcile:plans` LS'ni bilmaydi *(#45 / B5, P2)*
**⚠️ Hozir ishga tushirilsa har LS pullik mijozini FREE ga tushiradi.**
**Tuzatish:** LS obunalarini ham hisobga ol; hozircha skriptga fail-safe qo'sh —
`Subscription` provider'i noma'lum bo'lsa **tegmasin**.

### T2.6 — Boshqa billing tuzatishlari
- `#46 / B6` — dublikat LS obunasiga to'siq (mavjud faol obuna bo'lsa checkout'ni bloklash)
- `#47 / B7` — LS test-mode webhook'ini jonli to'lovdan ajratish (`test_mode` maydoni)
- `#48 / B8` — qisman refund qo'llab-quvvatlash (hozir har refund 100% deb hisoblanadi)
- `#49 / B9` — payout hold oynasini pul harakatlanadigan nuqtada **majburla** (hozir maslahat)
- `#124 / B10` — `recordContributorPayout` ga qulf/idempotency (parallel ikki to'lov mumkin)
- `#125 / B11` — admin "LS variant" maydonlari yozma-faqat: yo real ulash, yo UI'dan olib tashlash
- `#77 / X3` — Account sahifasida "Paddle orqali" → **"Lemon Squeezy orqali"**
- `#78 / X4` — LS variant sozlanmagan bo'lsa xom dasturchi xatosi o'rniga tushunarli xabar

---

## BATCH 3 — ZANJIR YAXLITLIGI (moderatsiya muhri)

### T3.1 — `/sync` post-approval swap *(#15, P1 — eng o'tkir)*
**Fayl:** `apps/api/src/routes/contributor.ts:3637`
**Muammo:** mavjud shablonni `contributorId_externalId` bo'yicha topib `name, description, nav,
cat, catLabel, orient, res, tags, metaJson, fileName, fileSize` ni qayta yozadi.
`reviewStatus` va `published` **reset qilinmaydi**, `packScanStatus` **"clean" bo'lib qoladi**.
`fileName` klientdan keladi va `HeadObject` bilan tekshirilmaydi → contributor presigned PUT bilan
yangi fayl qo'yib `fileName` ni unga qaratsa, **skanlanmagan kontent jonli listing ostida tarqaladi**.
**Tuzatish:**
1. Mavjud qator `reviewStatus === "APPROVED"` bo'lsa → `reviewStatus: "PENDING_REVIEW"`, `published: false`.
2. `fileName` o'zgargan bo'lsa → `packScanStatus: "pending"`, `packHash: null`.
3. `fileName` ni `HeadObject` bilan tasdiqla (`pack-uploaded` dagi kabi).
4. Admin ro'yxatida "re-review required" bayrog'i ko'rsat.

### T3.2 — `/pack-uploaded` post-approval swap *(#16, P1)*
**Fayl:** `apps/api/src/routes/contributor.ts:1550-1610`
**Muammo:** pack almashtiriladi, `packScanStatus="pending"` ga tushadi (yaxshi), lekin
`reviewStatus`/`published` **tegilmaydi** → skan toza chiqishi bilan yangi kontent **inson
moderatsiyasisiz** jonli bo'ladi (bait-and-switch).
**Tuzatish:** APPROVED shablon uchun `reviewStatus: "PENDING_REVIEW"`, `published: false`.

### T3.3 — Eski pack fayli serve qilinadi *(#17 / Z8, P1)*
**Muammo:** kengaytma almashsa (`.zip`→`.aep`) eski `.zip` o'chirilmaydi, `resolveS3AssetKey`
`.zip` ni **birinchi** qaytaradi → DB `.aep` deydi, foydalanuvchi eski baytlarni oladi.
Contributor qayta yuklash bilan tuzata olmaydi.
**Tuzatish:** yangi pack yuklanganda **boshqa kengaytmali eski pack obyektlarini o'chir**;
`resolveS3AssetKey` DB'dagi `fileName` ni ustun qo'ysin.
**Qo'shimcha:** mavjud yozuvlar uchun tozalash skripti yoz (egasi prod'da ishga tushiradi).

### T3.4 — Zanjirning qolgan tuzatishlari
- `#50 / Z1` — ingest retry tugagach `incoming/` zip'i yetim qoladi → tozalovchi (cron yoki
  job yakunida) + mavjudlar uchun bir martalik skript
- `#51 / Z2` — `reclaimStuck` ga **fencing token** qo'sh (birinchi worker hali ishlayotgan bo'lishi mumkin)
- `#52 / Z3` — contributor o'z shablonini o'chira olsin (faqat `DRAFT`/`REJECTED` holatda)
- `#53 / Z6` — katalog tartibini `updatedAt` dan **ajrat** (`publishedAt` yoki `createdAt` ishlat) —
  `bumpTemplateCounter` har yuklab olishda `updatedAt` ni ko'tarib paginatsiyani buzadi
- `#54 / Z7` — thumb qayta yuklanganda `updatedAt` ni ko'tar (`assets-uploaded` xom SQL'ida) →
  `?v=` cache-buster ishlasin (preview yo'li to'g'ri, thumb yo'li noto'g'ri — moslashtir)
- `#55 / Z9` — `CDN_BASE_URL` yo'q bo'lsa signed URL'li javobga `Cache-Control: private` qo'y;
  ETag'ni signed URL'siz kontentdan hisobla
- `#56 / Z10` — klient versiya yubormasa `updateAvailable` ni **`true`** deb hisobla (fail-safe)
- `#126 / Z4` — admin review endpointi joriy statusni tekshirsin (REJECTED/DRAFT ni approve qilmasin)
- `#127 / Z5` — `restore` (takedown'dan qaytarish) `published` holatini aniq ko'rsatsin/tiklasin

---

## BATCH 4 — XAVFSIZLIK

### T4.1 — `/api/contributor/catalog` ochiq va cheksiz *(#18, P1 — eng katta teshik)*
**Fayl:** `apps/api/src/routes/contributor.ts:3575`
**Muammo:** `requireAuth` **yo'q** (router ham `index.ts:225` da auth'siz mount qilingan),
`take`/paginatsiya **yo'q**, `metaJson` **to'liq** tanlanadi (~5KB/shablon).
10k shablonda ~50MB JSON → 1Gi instansda **OOM**. Bir vaqtda DoS vektori va maʼlumot eksfiltratsiyasi.
**Tuzatish:** `requireAuth` qo'sh · `take` (maks 100) + cursor paginatsiya · `metaJson` ni
`select` dan olib tashla (kerak bo'lsa alohida detail endpoint).

### T4.2 — Device-code phishing *(#32 / SEC1, P1)*
**Muammo:** `/device/start` autentifikatsiyasiz va cheksiz; kod `crypto.randomBytes(4)` = **32 bit**;
`device.html?code=<hujumchi kodi>` havolasi bilan qurbon Google orqali kirsa —
**hujumchining plagini qurbonning tokenini oladi**.
**Tuzatish:** kod entropiyasini oshir (kamida 8 bayt) · `/device/start` ga rate-limit ·
`device.html` da **URL'dan kelgan kodni avtomatik to'ldirma** — foydalanuvchi qo'lda kiritsin ·
tasdiqlash ekranida "bu kodni siz kiritdingizmi?" so'rovi · kod muddatini qisqartir (5 daq).

### T4.3 — `/api/logs` cheksiz `meta` *(#103 / SEC2, P2)*
**Fayl:** `apps/api/src/routes/logs.ts:98,101`
**Muammo:** `message` `clip(…, 500)` qilinadi, `meta` **qilinmaydi** — istalgan foydalanuvchi
chegarasiz JSON yozadi; har POST 500-qatorli faylni **sinxron qayta yozadi** → disk tugatish +
event loop bloklash.
**Tuzatish:** `meta` ni `clip`/`JSON.stringify` hajmi bilan chegarala (masalan 2KB) ·
yozuvni asinxron qil yoki butunlay Sentry/stdout'ga ko'chir · per-user rate-limit.

### T4.4 — Qolgan xavfsizlik
- `#20 / U1` — `promptPublic:false` ni **server tomonda majburla**: `/api/public/asset/:id`
  va katalog javoblarida `promptPublic===false` bo'lsa `prompt` maydonini chiqarma (P1)
- `#104 / SEC3` — Google avtomatik hisob bog'lanishi → pre-hijacking. Tasdiqlanmagan parolli
  hisobga Google'ni **avtomatik bog'lama**; email tasdiqlashni talab qil
- `#105 / SEC4` — `/api/plugin/catalog` `externalId` orqali `incoming/<userId>/<fayl>` ni oshkor
  qiladi → tashqi ID'ni opaque qil yoki javobdan olib tashla
- `#106 / SEC5` — avatar endpointiga auth yoki opaque ID; tashqi rasm URL'i uchun ochiq redirect'ni yop
- `#107 / SEC6` — scene-preview asseti auth'siz va nashr etilmagan shablon uchun ham beriladi;
  `sceneKey()` sanitizatsiyasini scene-preview yo'liga ham qo'lla
- `#149 / SEC7` — login `contributorBlockedAt` ni **token imzolashdan oldin** tekshirsin
- `#150 / SEC8` — `/2fa/disable` qolgan backup kodlarni saqlasin
- `#151 / SEC9` — DMCA `/report` ga alohida rate-limit

---

## BATCH 5 — MIQYOS (ko'p shablon)

⚠️ **Bu batch migratsiya talab qiladi** (indekslar). Migratsiyani yoz, prod'ga qo'llama.

### T5.1 — N+1: S3 LIST + DB UPDATE har sahifada *(#19, P1)*
**Muammo:** `assetKeysJson` null qator uchun `resolveCatalogAssets` → `syncTemplateAssetKeys` →
**jonli S3 ListObjectsV2 + DB UPDATE**. 100 qatorli sahifada = 100 LIST + 100 UPDATE
(DB pooli instansiga 10 ulanish). Kalit topilmasa `resolveS3AssetKey` shablon boshiga
**27 tagacha ketma-ket HEAD**.
**Tuzatish:**
1. **Backfill skripti** yoz — barcha `assetKeysJson: null` qatorlarni bir marta to'ldiradi
   (egasi prod'da ishga tushiradi).
2. Katalog o'qish yo'lida **hech qachon** S3 LIST qilma — kalit yo'q bo'lsa `null` qaytar va
   fon jobiga qo'y.
3. HEAD fallback'ini olib tashla yoki 1-2 taga cheklab qo'y.

### T5.2 — Perf harness noto'g'ri yo'lni o'lchagan *(#57, P2)*
**Fayl:** `scripts/perf-seed-assets.mjs`
**Muammo:** seed `assetKeysJson` ni **obyekt** yozadi, production `persistTemplateAssetKeys`
**massiv** yozadi → `assetKeySetFromStored` `Array.isArray()` da yiqiladi → lokal test `null`
qaytaradi va tez ko'rinadi. **50/500/5000 baseline'i production xatti-harakatini o'lchamagan.**
**Tuzatish:** seed'ni massiv formatiga o'tkaz, perf o'lchovni qayta ishga tushir.

### T5.3 — Indekslar *(migratsiya)*
- `#58 / S1` — `previewTranscodeStatus` uchun indeks (hozir har `GET /templates` da `updateMany`
  supurish → to'liq jadval skani + yozuv). Supurishni ham cron'ga ko'chir.
- `#59 / S2` — qidiruv `ILIKE %q%` uchun **pg_trgm GIN** indeks (name, description, catLabel, tags)
- `#60 / S3` — `ORDER BY name` uchun indeks

### T5.4 — Qolgan miqyos tuzatishlari
- `#61 / S4` — `multer.diskStorage` 3300MB (`apps/api/src/lib/upload-limits.ts:61`) vs Cloud Run
  32MB HTTP/1 limiti va 1Gi RAM → limitni realga tushir yoki yo'lni butunlay presigned'ga o'tkaz
- `#62 / S5` — rate-limit in-memory `Map` (`apps/api/src/middleware/rate-limit.ts:76`) →
  max-instances=10 da real limit **10×**. Umumiy store (DB yoki Redis) yoki limitni 1/10 ga bo'l
- `#63 / S6` — upload-progress SSE in-memory pub/sub → boshqa instansga tushsa progress kelmaydi;
  DB polling'ga yoki sticky routing'ga o'tkaz
- `#64 / S7` — inline ingest worker har instansda + har ~4s DB polling × 10 → scale-to-zero
  bo'lmaydi. `INGEST_WORKER_INLINE` ni default `false` qil, alohida worker service'ga tayan
- `#65 / S8` — Cloud Run `--concurrency` belgilanmagan (default **80**) → deploy skriptida
  `--concurrency=20` (ffmpeg og'irligini hisobga olib)
- `#66 / S9` — broadcast xabar ketma-ket thread yaratadi → batch `createMany`
- `#67 / S10` — `/api/admin/plugin-subscribers` paginatsiyasiz → `take`/`skip`
- `#68 / S11` — admin "All templates": server paginatsiyasi + "Filter" placeholder tugmasini real qil
- `#69 / S12` — bulk upload: parallel (bounded, masalan 3), presigned URL'ni **har fayl oldidan**
  ol (oldindan emas — muddati tugaydi)

---

## BATCH 6 — WEB + UI/UX

- `#21 / W1` (P1) — `packages/assetflow-studio/scripts/prepare-cf-pages.mjs:87` — `_*` bilan
  boshlanadigan fayl/papkalarni **istisno qil**. Hozir 17 ta ichki dizayn mockup (~992KB),
  "Which panel?" ops sahifasi va dizayn-tizim referensi production domenda ochiq
- `#22 / X1` (P1) — obunani bekor qilish/boshqarish yo'li ilovada **umuman yo'q**, FAQ esa
  "cancel anytime" deb vaʼda beradi → Account sahifasiga LS customer portal havolasi
  *(URL egasidan)*
- `#23 / X2` (P1) — checkout xatosi sanitizatorni chetlab o'tadi → xom backend satrlari
  (`NETWORK`) mijozga ko'rinadi. Xatolarni `friendlyError` naqshi bilan tarjima qil
- `#75 / W2` — o'z-hostli shriftlar 2+ segmentli marshrutda 404 (SPA fallback) → shrift
  yo'llarini **root-absolute** qil (`/fonts/…`)
- `#76 / W3` — "Sign out" faqat klientda; 30 kunlik JWT server tomonda bekor qilinmaydi →
  token versiyasi/blacklist qo'sh
- `#79 / X5` — 0 ta `focus-visible` qoidasi, `<label for=>` yo'q, **107 ta** semantik bo'lmagan
  bosiladigan `div`/`span` → `focus-visible` uslubi + eng muhim oqimlarni `<button>` ga o'tkaz
- `#80 / X6` — 3 xil tema tizimi, 3 xil `localStorage` kaliti → bittaga birlashtir
- `#81 / X7` — bo'sh katalog natijasi boshi berk: "Clear filters" hech narsa tozalamaydi
- `#82 / X8` — Free "1 active project" eʼlon qiladi, server majburlamaydi
  (`apps/api/src/routes/projects.ts:142`) → yo majburla, yo daʼvoni olib tashla
- `#129 / W4` — `_payBusy` redirect amalga oshmasa tiklanmaydi → timeout qo'sh
- `#130 / X9` — `<html lang="en">` qo'sh
- `#131 / X10` — ommaviy web 100% inglizcha, spetsifikatsiya o'zbekcha talab qiladi
  *(katta ish — alohida rejalashtir, avval egasi bilan tasdiqla)*
- `#132 / X11` — Studio ($59) kartasida 2 bullet, Pro ($19) da 6 → Studio bulletlarini to'ldir
- `#133 / X12` — "Jump back in" tarixi bo'lmagan yangi foydalanuvchiga ko'rinmasin

---

## BATCH 7 — CONTRIBUTOR STUDIO

**Eslatma:** manba `packages/assetflow-studio/js/`, keyin `npm run studio:sync`.

- `#24 / C1` (P1) — **"Edit" tugmasi buzilgan**: `openTplDrawer` `UP_EDIT_ID` ni o'rnatmasdan
  upload'ga yo'naltiradi → contributor tahrirlash o'rniga bulk yuklovchiga tushadi
- `#25 / C2` (P1) — bulk upload: **abort tugmasi** qo'sh · 30-daq poll deadline'idan keyin
  qator abadiy "Processing…" da qotadi (`BULK_SUMMARY` o'rnatilmaydi, remove tugmasi yashirin)
  → deadline'dan keyin qatorni "Noma'lum holat" qilib **o'chirish tugmasini ko'rsat**
- `#26 / C3` (P1) — sessiya tugasa `request()` 401 da darhol login'ga otadi → butun bulk yo'qoladi.
  Ogohlantirish ko'rsat, qoralamani `localStorage` ga saqla, qaytgach tikla
- `#83 / C4` — Earnings/Payout nav'da alohida bo'lim (hozir Settings ichida ko'milgan)
- `#84 / C5` — "My Templates" gridi soxta gradient (`thumbArt`) ko'rsatadi → haqiqiy thumbnail
- `#85 / C6` — `statusTimeline` soxta (doim "Submitted") → haqiqiy status tarixi
- `#86 / C7` — Bio textarea'ga `id` bering va **saqlang** (hozir hech qachon saqlanmaydi)
- `#87 / C8` — fayl "pill" havolalari auth header'siz `target=_blank` → 401. Signed URL ishlat
- `#88 / C9` — Overview topbar qidiruvi o'lik → ishlatib qo'y yoki yashir
- `#89 / C10` — hard/soft reject `[hard]` matn markeriga tayanadi → **DB maydoni** qil
- `#90 / C11` — `packages/assetflow-studio/login.html:193` production foydalanuvchisiga
  "In a separate terminal: npm run dev:api" deydi; `admin-login.html:171` ham. Xabarni almashtir
- `#134 / C12` — Register/Login tugmalariga loading/disabled holati
- `#135 / C13` — Notifications kartasi placeholder → real yoki yashir
- `#136 / C14` — sessiya `sessionStorage` da → yangi tabda qayta login (`localStorage` ga o'tkaz)

---

## BATCH 8 — ADMIN PANEL

- `#27 / A1` (P1) — bulk moderatsiya tanlovi **filtr/kategoriya almashganda saqlanadi** va
  bulk-approve'da **tasdiq dialogi yo'q** → ko'rinmayotgan shablonlar tasdiqlanadi.
  Filtr o'zgarganda tanlovni tozala + tasdiq dialogi (nechta element, qaysilar)
- `#28 / A2` (P1) — **DMCA/takedown backend to'liq, admin UI umuman yo'q** → kelgan shikoyatlar
  ro'yxati, ko'rish, takedown/rad etish tugmalari (huquqiy xavf, ustuvor)
- `#91 / A3` — Marketplace Settings "Save" hech narsa saqlamaydi, lekin muvaffaqiyat ko'rsatadi
- `#92 / A4` — Plan chegirma/promo 100% localStorage → real endpoint yoki UI'dan olib tashla
- `#93 / A5` — "Clear logs" auth'siz yuboriladi, doim yiqiladi, muvaffaqiyat deb ko'rsatadi
- `#94 / A6` — "System logs" efemer JSON faylga tayanadi (Cloud Run'da ishonchsiz) → DB yoki Sentry
- `#95 / A7` — Users&Roles "Status" faqat contributor-block'ni ko'rsatadi → umumiy hisob to'xtatish
- `#137 / A8` — Subscriber Generations qattiq 40 element, per-item refund yo'q
  (server paginatsiyani qo'llab-quvvatlaydi)

---

## BATCH 9 — PLAGIN

⚠️ **Har o'zgarishdan keyin egasi AE'da sinaydi** — `docs/SESSION-REPORT.md` ga
"AE testi kutilmoqda" deb yoz.

### T9.1 — Windows zip import *(#2, P0 — eng ustuvor plagin taski)*
**Fayllar:** `plugins/after-effects-cep/assetflow-catalog.js:1313`,
`plugins/after-effects-cep/assetflow-local-store.js:546`
**Muammo:** `execSync("unzip …")` — Windows'da `unzip` yo'q → **har zip-pack importi sinadi**.
Sanitizer `` ` `` va `$()` ni o'tkazadi → shell injection (fayl nomi orqali).
**Tuzatish:** **Aynan shu tuzatish `AssetFlow_Admin` panelida allaqachon yozilgan** — o'sha
implementatsiyani top va mijoz plaginiga ko'chir. Shell chaqiruvini **butunlay** olib tashla
(Node zip kutubxonasi yoki platformaga mos API).

### T9.2 — Qolgan plagin muhandisligi
- `#29 / PL-b` (P1) — "Clear download cache" va "Remove from project" **P9-format ekstraktsiya
  papkalarini hech qachon o'chirmaydi** → kesh cheksiz o'sadi, UI muvaffaqiyat deydi
- `#30 / PL-c` (P1) — shablon o'chirish **nomi mos kelgan HAR QANDAY loyiha elementini**
  o'chiradi → import qilingan element ID'sini saqlab, faqat o'shani o'chir
- `#96 / PL-d` — `expectedSha256` **abadiy no-op** (hech bir chaqiruvchi hash bermaydi) →
  server hash'ini uzat va tekshir
- `#97 / PL-e` — `evalScript` import chaqiruvlarida **timeout/hang-guard yo'q** → overlay
  abadiy muzlaydi. Timeout + "bekor qilish" qo'sh
- `#98 / PL-f` — server tomonga log yuborish jimgina o'lik (`Authorization` header yo'q → 401)
- `#99 / PL-g` — shrift hal qiluvchi **rozilik so'ramasdan** Google'dan yuklab OS shrift
  papkasiga / Windows registriga yozadi → rozilik dialogi
- `#138 / PL-h` — token va prefs ochiq JSON diskda → OS keychain/DPAPI
- `#139 / PL-i` — `settingsFilePath()` har platformada macOS yo'lini qattiq kodlaydi
- `#140 / PL-j` — lokal meta-store read-modify-write'da qulf yo'q

### T9.3 — Plagin UI/UX
- `#31 / PX1` (P1) — **uchayotgan generatsiya panel yopilsa abadiy yo'qoladi**: klient xotirasi
  oddiy JS massiv, persistence yo'q; server `history`/`recent` `status="done"` ni qattiq kodlagan.
  **Tuzatish:** (a) server `history` ga `running`/`queued` ni ham qo'sh, (b) panel ochilganda
  faol joblarni tikla, (c) klient holatini diskka saqla
- `#100 / PX2` — uchayotgan generatsiyani **bekor qilish yo'q** (plaginda ham, API'da ham) →
  `POST /gen/:jobId/cancel` + refund + UI tugmasi ("Cancel" hozir faqat kartani yashiradi)
- `#101 / PX3` — "Auto-load (Project selection)" sozlamasi **butunlay dekorativ** → ishlatib
  qo'y yoki UI'dan olib tashla
- `#141 / PX4` — video-gen "≈ 1–2 min" maslahati realdan uzoq → model bo'yicha real baho
- `#142 / PX5` — "AI describe" o'lik kod (hech bir DOM elementi chaqirmaydi) → o'chir
- `#143 / PX6` — to'liq AE demo-mockup production bundle ichida → paketdan chiqar
- `#144 / PX7` — AI natija kartalari faqat bosish bilan, katalog kartalari drag bilan → moslashtir
- `#145 / PX8` — oflayn/ulanish aniqlash yo'q → `navigator.onLine` + xato holati
- `#146 / PX9` — panel HTML'da CSP yo'q (Node kirishi + keng `innerHTML`)
- `#147 / PX10` — macOS `.pkg` da uninstaller yo'q (Windows MSI'da bor)
- `#148 / PX11` — CSXS manifestida `<Icons>` elementi yo'q
- `#102 / PX12` — self-updater Adobe siyosati *(egasi qarori)*

---

## BATCH 10 — INFRA / OPERATSIYA

- `#33 / I2` (P1) — `deploy-cloudrun.sh` **migratsiyalarni ishga tushirmaydi** va o'zgaruvchan
  `:latest` teg pushlaydi → CI gate'ini chetlab o'tadi. Skriptga migratsiya qadami + SHA teg,
  yoki skriptni "faqat CI ishlatiladi" deb belgilab, ogohlantirish qo'sh
- `#34 / I3` (P1) — **graceful shutdown yo'q**: SIGTERM/SIGINT ushlanmaydi → Cloud Run instans
  o'chganda uchayotgan so'rov va job'lar uziladi. `server.close()` + Prisma disconnect + drain
- `#35 / I4` (P1) — `verify-pipeline.mjs` prod'ga qarshi ishlatish hujjatlashtirilgan va
  **haqiqiy katalogga soxta shablon nashr qiladi**, tozalamaydi → cleanup qo'sh yoki prod'da bloklab qo'y
- `#36 / I5` (P1) — 8 ta `test:*` skriptdan **7 tasi CI'da hech qachon ishlamaydi**
  (2 xavfsizlik testi + 700 assertionli plagin to'plami) → GitHub Actions workflow'ga ulа
- `#108 / I6` — `SENTRY_DSN` yo'qligi hatto ogohlantirilmaydi → boot'da warn + DSN bo'lsa init
  *(DSN egasidan; kod ishini baribir qil)*
- `#109 / I7` — resumable "running" generatsiyalar atomik claim'ni chetlab o'tadi →
  instanslararo dublikat asset. `queued` uchun ishlatiladigan claim naqshini `running` ga ham qo'lla
- `#110 / I8` — template reconciler'lar find-then-touch → dublikat transcode/embedding ishi
- `#111 / I9` — `/health` auth'siz, keshlanmaydi, rate limiter'dan **oldin** ro'yxatdan o'tadi →
  yengil kesh (5s) qo'sh
- `#112 / I10` — CDN edge Worker allow-list manbasini import qiladi, avtomatik redeploy yo'q →
  CI'ga Worker deploy qadami
- `#113 / I11` — production Docker `npm install --include=dev` → `npm ci` ga o'tkaz
- `#114 / I12` — Node 20 EOL → Dockerfile + CI'ni **Node 22** ga o'tkaz *(egasi birinchi deploy'ni kuzatadi)*
- `#152 / I15` — `packages/database/prisma/migrations/migration_lock.toml` qo'sh
- `#153 / I16` — `deploy-ingest-worker.sh` bir-birini istisno qiluvchi gcloud bayroqlarini
  uzatadi — **skript yozilganidek ishlay olmaydi** → tuzat yoki o'chir
- `#154 / I17` — oylik narx-rekonsiliatsiya rejalashtiruvchisida boot-time drift →
  **hech qachon ishlamaydi**. Cron'ni absolyut vaqtga bog'la

---

## BATCH 11 — HUQUQ / OMMAVIY DAʼVOLAR

⚠️ Bir nechtasi egasining qaroriga bog'liq (§2 jadvali).

- `#38 / L1` (P1) — `packages/assetflow-studio/terms.html:80` mavjud bo'lmagan Premiere Pro
  plaginini daʼvo qiladi (`plugins/premiere-uxp` bo'sh katalog) *(egasi qarori)*
- `#116 / L2` — `scripts/verify-public-copy.mjs` ~9 ta ommaviy fayldan faqat **2 tasini**
  skanerlaydi → `terms`, `privacy`, `refund`, `dmca`, `help` ni ham qamrab ol
  (eng yomon buzilishlar aynan o'sha ko'r nuqtada edi)
- `#117 / L3` — landing'dagi **4 ta AI kredit narxi** haqiqiy model narxiga mos emas; SFX kam
  ko'rsatilgan (mijozdan eʼlon qilinganidan **ko'proq** olinadi) → `gen-models.ts` dan hisoblab sinxronla
- `#118 / L4` — Studio tarifi DB'da 6 000, sahifalarda 3 000 *(egasi qaroridan keyin sinxronla)*
- `#119 / L5` — to'rtala huquqiy sahifaning **ommaviy HTML manbasida** "needs lawyer review" /
  LEGAL-TODO izohlari jonli → izohlarni o'chir *(matn ko'rigi egasida)*
- `#120 / L6` — `help.html:91` 4K importni Pro imtiyozi deb eʼlon qiladi — bu gate **olib tashlangan**
- `#121 / L7` — "30+ til" daʼvosi yolg'on (jonli konfiguratsiyada **10 ta**) *(egasi qarori)*
- `#122 / L8` — Free "1 active project" va Pro "Unlimited projects" majburlanmaydi
- `#156 / L9` — huquqiy sahifalarda yuridik nom, yurisdiksiya, minimal yosh yo'q *(maʼlumot egasidan)*
- `#157 / L10` — SEO/OG/meta tavsif teglari, `robots.txt`, `sitemap.xml` **umuman yo'q** → qo'sh

---

## 3. TAVSIYA ETILGAN TARTIB

| Bosqich | Batch'lar | Nima beradi |
|---|---|---|
| 1 | BATCH 0 + BATCH 1 | Maʼlumot yo'qolishi va pul oqishi to'xtaydi |
| 2 | BATCH 4 + T3.1/T3.2 | Xavfsizlik teshiklari va moderatsiya chetlab o'tish yopiladi |
| 3 | BATCH 2 | Billing to'g'ri ishlaydi (pullik mijoz qamalmaydi) |
| 4 | BATCH 9 (T9.1) | Windows foydalanuvchilari uchun plagin ishlaydi |
| 5 | BATCH 5 | Ko'p shablonda tizim sinmaydi |
| 6 | BATCH 3 (qolgani) + 7 + 8 | Zanjir va operator yuzasi to'liq ishlaydi |
| 7 | BATCH 6 + 9 (qolgani) | UI/UX sifat |
| 8 | BATCH 10 + 11 | Operatsiya va huquqiy tozalik |

**Har batch oxirida:**
```bash
npm run build -w apps/api
npm run studio:sync   # agar studio js/styles tegilgan bo'lsa
```
so'ng `main` ga commit (push YO'Q, `Co-Authored-By` YO'Q) va `docs/SESSION-REPORT.md` ni yangila.
