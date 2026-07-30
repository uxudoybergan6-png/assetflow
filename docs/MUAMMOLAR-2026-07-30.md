# FrameFlow — MUAMMOLAR RO'YXATI (aniq, raqamlangan)

**Sana:** 2026-07-30 · **Manba:** `docs/FULL-AUDIT-2026-07-30.md` (batafsil tushuntirish shu yerda)
**Jami: 157 ta muammo** — 🔴 P0: 4 · 🟠 P1: 34 · 🟡 P2: 84 · ⚪ P3: 35

Har qatordagi `[ID]` — audit hujjatidagi kod (M=pul, B=billing, Z=zanjir, S=miqyos, U=user,
W=web, X=UI/UX, C=contributor, A=admin, PL=plagin, PX=plagin UX, SEC=xavfsizlik, I=infra, L=huquq).

---

## 🔴 P0 — BLOKLOVCHI (4)

| # | Muammo | Joy |
|---|---|---|
| 1 | `npm run demo:clear` — `ContributorTemplate` + `StudioAuditLog` + `StudioMessage` jadvallarini **filtrsiz, tasdiqsiz, prod-guardsiz** to'liq o'chiradi. CLAUDE.md'da oddiy buyruq sifatida turibdi | `scripts/clear-assetflow-demo.mjs:37` |
| 2 | **Windows'da zip import ishlamaydi** — `execSync("unzip …")`. Tuzatish Admin panelda bor, mijoz plaginiga ko'chirilmagan. Sanitizer `` ` `` va `$()` ni o'tkazadi → shell injection | `assetflow-catalog.js:1313`, `assetflow-local-store.js:546` |
| 3 | Marketplace submission **16/19 maydon** so'zma-so'z `"OWNER-INPUT-REQUIRED"`; imzolangan `.zxp` yo'q, Adobe sertifikati yo'q → bugun topshirib bo'lmaydi | `plugins/after-effects-cep/marketplace-submission.json` |
| 4 | **Production DB tushgan** (`/health` → 503 `db:"down"`, katalog → 500) va `SENTRY_DSN` yo'q → hech qanday ogohlantirish kelmaydi | jonli prod |

---

## 🟠 P1 — JIDDIY (34)

### Pul — kredit dvigateli
| # | ID | Muammo | Joy |
|---|---|---|---|
| 5 | M1 | Oylik reset **shartsiz absolyut yozuv** → parallel so'rovlar bepul kredit zarb qiladi | `plugin-profile.ts:595` |
| 6 | M2 | `refundAiCredits` eski o'qishdan absolyut yozadi → parallel sarfni o'chirib yuboradi | `plugin-profile.ts:688` |
| 7 | M3 | Seedance 3102 @4K + video-ref **provayder narxidan past** sotiladi (15s = −$2.28). `Apply target margin` tuzatmaydi | `gen-models.ts:1775` |
| 8 | M4 | `DELETE /gen/:jobId` status guard'i yo'q → `running` job o'chiriladi → **refund hech qachon bo'lmaydi** | `studio-gen.ts:2019` |

### Pul — billing / obuna
| # | ID | Muammo | Joy |
|---|---|---|---|
| 9 | B1 | **Lemon Squeezy `Subscription` qatorini hech qachon yozmaydi** → `subscriptionIsPro()` har LS mijozi uchun `false` | LS webhook |
| 10 | B2 | Pullik LS mijozi plaginda "Free" bossa → **abadiy qamaladi**, PRO'ga qayta olmaydi, LS pul olishda davom etadi | `plugin-profile.ts:215` |
| 11 | B3 | LS webhook qisman xatoda `catch` dedup-yozuvini o'chiradi → retry'da **kredit 2×** beriladi | `grantAiCreditsTopup` |
| 12 | B4 | Pause/resume sikli **yangi to'lovsiz** AI kreditlarini to'liq tiklaydi | LS webhook |
| 13 | §4.3 | Oddiy USER "Add to Explore" orqali **contributor payout hovuzidan earning oladi** — turi filtrlanmaydi, 30% hovuz suyuladi | `download-events.ts:152`, `earnings.ts:133` |
| 14 | §4.4 | `void recordTemplateDownloadEvent(...)` — Cloud Run javobdan keyin CPU throttle → **yuklab olish hodisasi + contributor earning jimgina yo'qoladi** | `plugin.ts:586,620,1123` |

### Zanjir (contributor → admin → web → plagin)
| # | ID | Muammo | Joy |
|---|---|---|---|
| 15 | §5.2-A | `/sync` APPROVED shablonning `fileName`/`metaJson`/nomini **moderatsiyasiz va skansiz** almashtiradi (`packScanStatus` "clean" qoladi) | `contributor.ts:3637` |
| 16 | §5.2-B | `/pack-uploaded` pack'ni almashtiradi, `reviewStatus`/`published` **tegilmaydi** → skan toza chiqishi bilan yangi kontent inson ko'rmasdan jonli bo'ladi | `contributor.ts:1600` |
| 17 | Z8 | Pack kengaytmasi almashsa (`.zip`→`.aep`) eski `.zip` o'chirilmaydi va **birinchi qaytariladi** → DB bilan baytlar mos kelmaydi, AE import xatosi | `resolveS3AssetKey` |

### Miqyos
| # | ID | Muammo | Joy |
|---|---|---|---|
| 18 | §6.1 | `GET /api/contributor/catalog` — **auth yo'q + `take` yo'q + `metaJson` bilan** → 10k shablonda OOM + ommaviy maʼlumot eksfiltratsiyasi | `contributor.ts:3575` |
| 19 | §6.2 | Har katalog sahifasida **100 ta S3 LIST + 100 ta DB UPDATE** (`assetKeysJson` null bo'lsa); kalit topilmasa shablon boshiga 27 tagacha HEAD | `resolveCatalogAssets` |

### Foydalanuvchi maʼlumoti
| # | ID | Muammo | Joy |
|---|---|---|---|
| 20 | U1 | `promptPublic:false` saqlanadi lekin **server tomonda majburlanmaydi** → to'liq promptlar anonim internetga oqadi | `/api/public/asset/:id` |

### Web
| # | ID | Muammo | Joy |
|---|---|---|---|
| 21 | W1 | **17 ta ichki dizayn mockup (~992KB) + ops sahifasi** production domenda ochiq — `_*` istisno qilinmaydi | `prepare-cf-pages.mjs:87` |
| 22 | X1 | **Obunani bekor qilish/boshqarish yo'li ilovada umuman yo'q**, FAQ esa "cancel anytime" deb vaʼda beradi | web |
| 23 | X2 | Checkout xatosi sanitizatorni chetlab o'tadi → **xom backend satrlari** (`NETWORK`) mijozga ko'rinadi | web |

### Contributor Studio
| # | ID | Muammo | Joy |
|---|---|---|---|
| 24 | C1 | **"Edit" tugmasi buzilgan** — `UP_EDIT_ID` o'rnatilmaydi → contributor tahrirlash o'rniga bulk yuklovchiga tushadi | `openTplDrawer` |
| 25 | C2 | Bulk upload: **abort yo'q**, 30-daq deadline'dan keyin qatorlar abadiy "Processing…" da qotadi → sahifani qayta yuklashdan boshqa chora yo'q | contributor UI |
| 26 | C3 | Sessiya yuklash o'rtasida tugasa 401 da **darhol login'ga otadi** — qoralama saqlanmaydi, butun bulk yo'qoladi | `request()` |

### Admin
| # | ID | Muammo | Joy |
|---|---|---|---|
| 27 | A1 | Bulk moderatsiya tanlovi **filtr almashganda saqlanadi** + bulk-approve'da tasdiq dialogi yo'q → ko'rinmayotgan shablonlar tasdiqlanadi | admin UI |
| 28 | A2 | **DMCA/takedown backend'i to'liq — admin UI umuman yo'q.** Operator kelgan shikoyatni ko'ra olmaydi (huquqiy xavf) | admin UI |

### Plagin
| # | ID | Muammo | Joy |
|---|---|---|---|
| 29 | PL-b | "Clear download cache" va "Remove from project" **P9-format papkalarni hech qachon o'chirmaydi** — kesh cheksiz o'sadi, UI muvaffaqiyat deydi | plagin |
| 30 | PL-c | Yuklab olingan shablonni o'chirish **nomi mos kelgan HAR QANDAY loyiha elementini** o'chiradi | `host.jsx` |
| 31 | PX1 | **Uchayotgan generatsiya panel yopilsa abadiy yo'qoladi** — klient xotirasi, persistence yo'q; server `history` `status="done"` ni qattiq kodlagan | plagin + API |

### Xavfsizlik
| # | ID | Muammo | Joy |
|---|---|---|---|
| 32 | SEC1 | **Device-code phishing** — `/device/start` autentifikatsiyasiz, kod 32 bit entropiya, foydalanuvchi tomonida tasdiq yo'q → hujumchi plagini qurbon tokenini oladi | `/device/start` |

### Infra
| # | ID | Muammo | Joy |
|---|---|---|---|
| 33 | I2 | `deploy-cloudrun.sh` **migratsiyalarni ishga tushirmaydi** + o'zgaruvchan `:latest` teg → CI gate'ini chetlab o'tadi | `deploy-cloudrun.sh` |
| 34 | I3 | Asosiy API'da **graceful shutdown yo'q** — SIGTERM/SIGINT ushlanmaydi | `index.ts` |
| 35 | I4 | `verify-pipeline.mjs` (prod'ga qarshi hujjatlashtirilgan) **haqiqiy katalogga soxta shablon nashr qiladi** va tozalamaydi | `scripts/verify-pipeline.mjs` |
| 36 | I5 | 8 ta `test:*` skriptdan **7 tasi CI'da hech qachon ishlamaydi** — 2 xavfsizlik testi + 700 assertionli plagin to'plami | CI |
| 37 | I14 | `cloudrun-env.yaml` **jonli maxfiy kalitlar bilan** repo ildizida (git'da yo'q, lekin diskda) | repo ildizi |

### Huquq
| # | ID | Muammo | Joy |
|---|---|---|---|
| 38 | L1 | `terms.html` **mavjud bo'lmagan Premiere Pro plaginini** daʼvo qiladi — `plugins/premiere-uxp` bo'sh | `terms.html:80` |

---

## 🟡 P2 — MUHIM (84)

### Pul (6)
| # | ID | Muammo | Joy |
|---|---|---|---|
| 39 | M5 | `generation.create` P2002'dan boshqa xato bersa → kredit yechilgan, qator yo'q, refund yo'q | `studio-gen.ts:1557` |
| 40 | M6 | `MAX_ACTIVE_GENERATIONS` check-then-act (atomik emas) | `studio-gen.ts:1521` |
| 41 | M7 | `ModelPricing.enabled` saqlanadi/PATCH qilinadi, lekin **generatsiyada hech qachon tekshirilmaydi** | `gen-models.ts:1548` |
| 42 | M8 | SFX (ElevenLabs 4001) maksimal davomiylikda provayder narxidan past | `gen-models.ts:977` |
| 43 | M9 | Oylararo refund ceiling tufayli haqiqiy refund jimgina 0 ga tushadi | `plugin-profile.ts:687` |
| 44 | §4.5 | `consumeDownload` **baytlardan oldin** ishlaydi → S3'da pack yo'q bo'lsa kvota bekorga yonadi (retry bilan 2×) | `guardDownloadable` |

### Billing (5)
| # | ID | Muammo |
|---|---|---|
| 45 | B5 | `npm run reconcile:plans` faqat Stripe'ni biladi → ishga tushsa **har LS pullik mijozini FREE ga tushiradi** |
| 46 | B6 | Ikkinchi (dublikat) LS obunasini sotib olishga to'siq yo'q |
| 47 | B7 | LS test-mode webhook'lari jonli to'lovdan farqlanmaydi |
| 48 | B8 | Qisman refund yo'q — har qanday refund 100% deb hisoblanadi |
| 49 | B9 | Payout hold oynasi pul harakatlanadigan nuqtada majburlanmaydi (faqat maslahat) |

### Zanjir (7)
| # | ID | Muammo |
|---|---|---|
| 50 | Z1 | Ingest retry'lari tugagach `incoming/` dagi zip **abadiy yetim qoladi** — tozalovchi yo'q |
| 51 | Z2 | `reclaimStuck` fencing'siz qayta navbatga qo'yadi → birinchi worker zipni o'chirsa ikkinchisi permanent fail |
| 52 | Z3 | Contributor **o'z shablonini o'chira olmaydi** — delete faqat admin |
| 53 | Z6 | Katalog tartibi `updatedAt desc`, `bumpTemplateCounter` har yuklab olishda uni ko'taradi → **paginatsiya beqaror** + thumb keshi buziladi |
| 54 | Z7 | Thumb qayta yuklanganda `updatedAt` ko'tarilmaydi → `?v=` o'zgarmaydi → CDN eski rasmni **1 yil** beradi |
| 55 | Z9 | Katalog `s-maxage=300` bilan signed URL'larni **umumiy keshga** qo'yadi; ETag har so'rovda o'zgaradi → kesh umuman ishlamaydi |
| 56 | Z10 | Klient versiyani yubormasa `updateAvailable=false` → **majburiy yangilanish eski klientlarga yetmaydi** |

### Miqyos (13)
| # | ID | Muammo |
|---|---|---|
| 57 | §6.2b | **Perf harness noto'g'ri kod yo'lini o'lchagan** — seed `assetKeysJson` ni obyekt, prod massiv yozadi → 50/500/5000 baseline'i ishonchsiz |
| 58 | S1 | Har `GET /templates` da `previewTranscodeStatus` bo'yicha `updateMany` supurish — **indeks yo'q** |
| 59 | S2 | Qidiruv `ILIKE %q%` — trigram/GIN indeks yo'q |
| 60 | S3 | `ORDER BY name` uchun indeks yo'q |
| 61 | S4 | `multer.diskStorage` 3300MB, Cloud Run FS = RAM, HTTP/1 limiti 32MB → yo'l amalda buzilgan |
| 62 | S5 | Rate-limit **in-memory `Map`** → max-instances=10 da real limit 10× eʼlon qilingan qiymat (`rate-limit.ts:76`) |
| 63 | S6 | Upload-progress SSE in-memory pub/sub → boshqa instansga tushsa progress hech qachon kelmaydi |
| 64 | S7 | Inline ingest worker har instansda + har ~4s DB polling × 10 → scale-to-zero bo'lmaydi |
| 65 | S8 | Cloud Run `--concurrency` belgilanmagan → 1 vCPU'ga **80** so'rov; ffmpeg bilan band instans baribir qabul qiladi |
| 66 | S9 | Broadcast xabar har contributor uchun **ketma-ket** thread yaratadi → 10k'da timeout |
| 67 | S10 | `/api/admin/plugin-subscribers` — paginatsiyasiz `findMany` + join |
| 68 | S11 | Admin "All templates" — server paginatsiyasi ham, DOM virtualizatsiyasi ham yo'q; "Filter" tugmasi placeholder |
| 69 | S12 | Bulk upload ketma-ket (100×200MB = soatlar), presigned URL'lar oldindan olinadi va muddati tugaydi |

### Foydalanuvchi (5)
| # | ID | Muammo |
|---|---|---|
| 70 | U2 | USER o'zining Explore submissionini **hech qachon tahrirlay/o'chira olmaydi** (rol gate, egalik gate emas) |
| 71 | U3 | Explore muallif nomi ochiqlanmasdan **email local-part'iga** tushadi (`ali.valiyev@…` → "ali.valiyev") |
| 72 | U4 | Presigned reference-upload URL'ida **server tomonda hajm chegarasi yo'q** — kvota klient eʼloniga qarshi tekshiriladi |
| 73 | U5 | GDPR hisob o'chirish `GenAsset`/`SavedReference` obyektlarini **storage'dan tozalamaydi** |
| 74 | U6 | Hisob o'chirilganda anonimlashtirilgan foydalanuvchining **ochiq email'i audit logga qayta yoziladi** |

### Web muhandislik (2)
| # | ID | Muammo |
|---|---|---|
| 75 | W2 | O'z-hostli shriftlar **2+ segmentli har marshrutda 404** → SPA fallback → shrift jimgina umumiyga tushadi (ulashiladigan katalog URL'lari) |
| 76 | W3 | "Sign out" faqat klient tomonda — **30 kunlik JWT server tomonda bekor qilinmaydi** |

### Web UI/UX (6)
| # | ID | Muammo |
|---|---|---|
| 77 | X3 | Account sahifasi to'lov **"Paddle orqali"** deydi — haqiqiy protsessor Lemon Squeezy |
| 78 | X4 | LS variant sozlanmagan bo'lsa billing **xom dasturchi xatosini** qaytaradi |
| 79 | X5 | Klaviatura: **0 ta `focus-visible`**, `<label for=>` amalda yo'q, **107 ta** semantik bo'lmagan bosiladigan `div`/`span` |
| 80 | X6 | Bir domenda **3 xil tema tizimi**, 3 xil `localStorage` kaliti, mos kelmaydigan qiymatlar |
| 81 | X7 | Bo'sh katalog natijasi — boshi berk ko'cha: umumiy matn + hech narsa tozalamaydigan "Clear filters" |
| 82 | X8 | Free "1 active project" deb eʼlon qiladi — server **hech qanday limit majburlamaydi** (`projects.ts:142`) |

### Contributor Studio (8)
| # | ID | Muammo |
|---|---|---|
| 83 | C4 | Nav'da **Earnings/Payout bo'limi yo'q** — Settings ichida ko'milgan |
| 84 | C5 | "My Templates" gridi **soxta gradient** placeholder ko'rsatadi (`thumbArt`) — haqiqiy thumb faqat drawer'da |
| 85 | C6 | `statusTimeline` **soxta** — haqiqiy statusdan qatʼi nazar doim "Submitted" |
| 86 | C7 | Bio textarea'ning `id` yo'q va **hech qachon saqlanmaydi** |
| 87 | C8 | Fayl "pill" havolalari auth header'siz `target=_blank` → **401, buzilgan havolalar** |
| 88 | C9 | Overview topbar qidiruvi **o'lik** (faqat templates ko'rinishida qayta render qiladi) |
| 89 | C10 | Hard/soft reject review izohidagi `[hard]` markeriga qarab — admin unutsa cheksiz qayta topshirish ochiladi |
| 90 | C11 | `login.html:193` production foydalanuvchisiga **"In a separate terminal: npm run dev:api"** deydi (`admin-login.html:171` ham) |

### Admin (5)
| # | ID | Muammo |
|---|---|---|
| 91 | A3 | Marketplace Settings "Save" **hech narsa saqlamaydi**, lekin muvaffaqiyat deb ko'rsatadi |
| 92 | A4 | Plan chegirma/promo bo'limi **100% localStorage** — obunachilarga hech qachon yetmaydi |
| 93 | A5 | "Clear logs" autentifikatsiyasiz yuboriladi, **doim jimgina yiqiladi**, muvaffaqiyat deb ko'rsatadi |
| 94 | A6 | "System logs" bitta **efemer JSON faylga** tayanadi — Cloud Run'da ishonchsiz |
| 95 | A7 | Users&Roles "Status" faqat contributor-block holatini ko'rsatadi; **umumiy hisob to'xtatish yo'q** |

### Plagin muhandislik (4)
| # | ID | Muammo |
|---|---|---|
| 96 | PL-d | `expectedSha256` yaxlitlik tekshiruvi **abadiy no-op** — hech bir chaqiruvchi hash bermaydi |
| 97 | PL-e | AE `evalScript` import chaqiruvlarida **timeout/hang-guard yo'q** → overlay abadiy muzlaydi |
| 98 | PL-f | Server tomonga log yuborish **jimgina o'lik** — `Authorization` header yo'q → 401 yutiladi |
| 99 | PL-g | Shrift hal qiluvchi **rozilik so'ramasdan** Google'dan yuklab OS shrift papkasiga / Windows registriga yozadi |

### Plagin UI/UX (3)
| # | ID | Muammo |
|---|---|---|
| 100 | PX2 | Uchayotgan generatsiyani **bekor qilish imkoniyati yo'q** (plaginda ham, API'da ham) — "Cancel" faqat kartani yashiradi |
| 101 | PX3 | "Auto-load (Project selection)" sozlamasi **butunlay dekorativ** |
| 102 | PX12 | Self-updater OS `.pkg/.msi/.exe` ni Creative Cloud'dan tashqarida ishga tushiradi — **Adobe siyosatiga muvofiqligi hal qilinmagan** |

### Xavfsizlik (5)
| # | ID | Muammo |
|---|---|---|
| 103 | SEC2 | `/api/logs` — istalgan foydalanuvchi **chegarasiz `meta`** yozadi (`clip()` qilinmaydi) + har POST faylni **sinxron qayta yozadi** → disk tugatish + event loop blok |
| 104 | SEC3 | Google **avtomatik hisob bog'lanishi** → pre-hijacking (hujumchi avval ro'yxatdan o'tadi, keyin paroli ishlaydi) |
| 105 | SEC4 | `/api/plugin/catalog` autentifikatsiyasiz va `externalId` orqali `incoming/<userId>/<fayl>` ni oshkor qiladi |
| 106 | SEC5 | Avatar endpointi autentifikatsiyasiz → user ID enumeratsiyasi + ochiq redirect |
| 107 | SEC6 | Scene-preview asseti autentifikatsiyasiz **har qanday** (nashr etilmagan ham) shablon uchun; `sceneKey()` sanitizatsiyasi qo'llanmaydi |

### Infra (8)
| # | ID | Muammo |
|---|---|---|
| 108 | I6 | `SENTRY_DSN` production env'da **yo'q** va yo'qligi hatto ogohlantirilmaydi |
| 109 | I7 | Resumable "running" generatsiyalar atomik claim'ni **chetlab o'tadi** → instanslararo dublikat asset |
| 110 | I8 | Template reconciler'lar find-then-touch → dublikat transcode/embedding ishi |
| 111 | I9 | `/health` autentifikatsiyasiz, keshlanmaydi, global rate limiter'dan **oldin** ro'yxatdan o'tadi |
| 112 | I10 | CDN edge Worker allow-list'ni import qiladi, lekin o'zgarishga bog'langan **avtomatik redeploy yo'q** |
| 113 | I11 | Production Docker `npm install --include=dev` (`npm ci` emas) — CI tasdiqlaganidan farq qiladi |
| 114 | I12 | Production runtime va CI **Node 20** — rasmiy EOL o'tgan |
| 115 | I13 | Repo ildizidagi eski `render.yaml` migratsiyagacha bo'lgan domenlarni ko'rsatadi |

### Huquq / ommaviy daʼvolar (7)
| # | ID | Muammo |
|---|---|---|
| 116 | L2 | `verify-public-copy.mjs` ~9 ta ommaviy fayldan faqat **2 tasini** skanerlaydi — barcha huquqiy sahifalar ko'r nuqtada |
| 117 | L3 | Landing'dagi **4 ta AI kredit narxining hammasi** noto'g'ri; SFX kam ko'rsatilgan (mijozdan **ko'proq** olinadi) |
| 118 | L4 | Studio tarifi DB'da **6 000 kredit**, ommaviy sahifalar **3 000** deydi — qo'lda tuzatish bajarilmagan |
| 119 | L5 | To'rtala huquqiy sahifaning **ommaviy HTML manbasida** "needs lawyer review" / LEGAL-TODO izohlari jonli |
| 120 | L6 | `help.html:91` 4K importni Pro imtiyozi deb eʼlon qiladi — bu gate **olib tashlangan** |
| 121 | L7 | "30+ til" ovoz daʼvosi **yolg'on** — jonli konfiguratsiyada **10 ta** til |
| 122 | L8 | Free "1 active project" va Pro "Unlimited projects" **hech qayerda majburlanmaydi** |

---

## ⚪ P3 — KICHIK / KEYINROQ (35)

| # | ID | Muammo |
|---|---|---|
| 123 | M10 | Quote imzolangan, lekin `/gen` da narx **server tomonda qayta hisoblanmaydi** (`studio-gen.ts:1485`) |
| 124 | B10 | `recordContributorPayout` da qulf yo'q — parallel ikki to'lov mumkin |
| 125 | B11 | Admin "LS variant (monthly/yearly)" maydonlari — yozma-faqat o'lik konfiguratsiya |
| 126 | Z4 | Admin review endpoint joriy statusni tekshirmaydi — REJECTED/DRAFT shablonni ham approve qilish mumkin |
| 127 | Z5 | `restore` (takedown'dan qaytarish) qayta `published` qilmaydi — admin sezmasligi mumkin |
| 128 | U7 | Admin "block contributor" oddiy USER hisobini **blokdan bosh tortadi** — Explore spamerini to'xtatib bo'lmaydi |
| 129 | W4 | Checkout busy-lock (`_payBusy`) redirect amalga oshmasa **hech qachon tiklanmaydi** |
| 130 | X9 | `<html lang>` atributi umuman yo'q |
| 131 | X10 | Spetsifikatsiya o'zbekcha UI talab qiladi — butun ommaviy web **100% inglizcha** |
| 132 | X11 | Studio ($59) kartasida 2 bullet, Pro ($19) da 6 — qimmatroq tarif arzonroq ko'rinadi |
| 133 | X12 | "Jump back in" sarlavhasi tarixi bo'lmagan yangi foydalanuvchiga ham ko'rinadi |
| 134 | C12 | Register/Login tugmalarida **loading/disabled holati yo'q** — sovuq API'da bir necha marta yuboriladi |
| 135 | C13 | Notifications kartasi — placeholder |
| 136 | C14 | Sessiya `sessionStorage` da → yangi tabda qayta login |
| 137 | A8 | Subscriber Generations paneli faqat o'qish, **qattiq 40 element**, per-item refund yo'q |
| 138 | PL-h | Token va prefs **ochiq JSON** sifatida diskda (keychain/DPAPI yo'q) |
| 139 | PL-i | `settingsFilePath()` har platformada **macOS yo'lini** qattiq kodlaydi |
| 140 | PL-j | Lokal meta-store read-modify-write'da qulf yo'q |
| 141 | PX4 | Video-gen "≈ 1–2 min" maslahati real kutish vaqtini jiddiy kamaytirib ko'rsatadi |
| 142 | PX5 | "AI describe" — **butunlay o'lik kod**, hech bir DOM elementi chaqirmaydi |
| 143 | PX6 | To'liq AE demo-mockup **production panel bundle'i ichida** jo'natiladi |
| 144 | PX7 | AI natija kartalari faqat bosish bilan import, katalog kartalari drag qilinadi — nomuvofiq |
| 145 | PX8 | Oflayn/ulanish aniqlash **umuman yo'q** |
| 146 | PX9 | Panel HTML'da **CSP yo'q** (Node kirishi + keng `innerHTML` bilan) |
| 147 | PX10 | macOS `.pkg` da **uninstaller yo'q** (Windows MSI'da bor) |
| 148 | PX11 | CSXS manifestida `<Icons>` elementi yo'q |
| 149 | SEC7 | Login `contributorBlockedAt` ni **token imzolangandan keyin** tekshiradi |
| 150 | SEC8 | `/2fa/disable` backup kodni isteʼmol qiladi, lekin qolganlarini **saqlamaydi** |
| 151 | SEC9 | DMCA `/report` faqat global 600/min limit bilan — spam mumkin |
| 152 | I15 | `migration_lock.toml` yo'q |
| 153 | I16 | `deploy-ingest-worker.sh` bir-birini istisno qiluvchi gcloud bayroqlarini uzatadi — **ishlay olmaydi** |
| 154 | I17 | Oylik narx-rekonsiliatsiya rejalashtiruvchisida boot-time drift → **hech qachon ishlamaydi** |
| 155 | I18 | `_to_delete/` katalogi Docker build kontekstidan chiqarilmagan |
| 156 | L9 | Huquqiy sahifalarda kompaniya yuridik nomi, yurisdiksiya, minimal yosh yo'q |
| 157 | L10 | **Hech qanday SEO/OG/meta tavsif tegi, `robots.txt`, `sitemap.xml` yo'q** |

---

## Yig'indi

| Zona | P0 | P1 | P2 | P3 | Jami |
|---|---|---|---|---|---|
| Pul — kredit dvigateli | – | 4 | 6 | 1 | **11** |
| Pul — billing/obuna/payout | – | 6 | 5 | 2 | **13** |
| Zanjir (contrib→admin→web→plagin) | – | 3 | 7 | 2 | **12** |
| Miqyos (ko'p shablon) | – | 2 | 13 | – | **15** |
| Foydalanuvchi / maʼlumot | – | 1 | 5 | 1 | **7** |
| Web muhandislik | – | 1 | 2 | 1 | **4** |
| Web UI/UX | – | 2 | 6 | 4 | **12** |
| Contributor Studio | – | 3 | 8 | 3 | **14** |
| Admin panel | – | 2 | 5 | 1 | **8** |
| Plagin muhandislik | 2 | 2 | 4 | 3 | **11** |
| Plagin UI/UX | – | 1 | 3 | 8 | **12** |
| Xavfsizlik | – | 1 | 5 | 3 | **9** |
| Infra / operatsiya | 2 | 5 | 8 | 4 | **19** |
| Huquq / ommaviy daʼvolar | – | 1 | 7 | 2 | **10** |
| **JAMI** | **4** | **34** | **84** | **35** | **157** |

Tuzatish tartibi: `docs/FULL-AUDIT-2026-07-30.md` §14.
