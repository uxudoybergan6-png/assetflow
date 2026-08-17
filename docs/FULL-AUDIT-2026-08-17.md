# FrameFlow — to‘liq mustaqil audit

**Sana:** 2026-08-17
**Rejim:** read-only audit; mahsulot kodi o‘zgartirilmadi
**Qamrov:** 798 tracked fayl, taxminan 205,709 qator TS/JS/MJS/JSX/HTML/CSS, 19 API router, 72 Prisma migratsiya, web platforma, Contributor/Admin Studio, AE/Premiere CEP, Premiere UXP companion, billing, AI, storage, CI/deploy, production smoke va UX/UI. **Jami: 102 ta kod yoki live response bilan tasdiqlangan topilma.**

## 1. Yakuniy hukm

**Hozirgi holat: NO-GO — ommaviy launch, pullik trafik va Adobe Marketplace uchun tayyor emas.**

Yadro muhandisligida yaxshi nazoratlar bor: signed cost quote, server-side reprice, atomik download/generation slotlari, CORS fail-stop, webhook imzolari, SSRF/path traversal himoyalari, malware quarantine, health-gated Cloud Run deploy, kundalik backup va katta avtomatik test to‘plami. Lekin shu mustahkam qismlar orasida bir nechta to‘g‘ridan-to‘g‘ri ekspluatatsiya, pul hisobi, release va acquisition zanjiri uzilishlari qolgan.

Eng muhim natija: **avtomatik build/testlar yashil, ammo foydalanuvchi zanjiri xavfsiz va sotiladigan holatda emas.** Email signup productionda ishlamaydi, AE paketi nashr qilinmagan, contributor tasdiqlangan packni qayta moderatsiyasiz almashtira oladi, Studio stored-XSS admin sessiyasiga yetadi, CEP XSS esa Node RCEga aylanadi. Billing webhook, kredit va refund oqimlarida parallel/transient xatolar pul yoki kreditni yo‘qotishi/mint qilishi mumkin.

### Release oldidan muzokara qilinmaydigan bloklar

| # | Daraja | Bloker | Natija |
|---|---|---|---|
| 1 | P0 | Contributor `metaJson.grad` → Admin stored XSS | Admin JWT va vakolatlar egallanishi mumkin |
| 2 | P0 | Customer CEP XSS + Node/mixed context | Lokal OS user huquqida kod bajarilishi mumkin |
| 3 | P0 | Approved/live pack deterministik keyga qayta PUT qilinadi | Moderatsiyasiz executable/media bait-and-switch |
| 4 | P0 | Production Turnstile `400020` | Email/password ro‘yxatdan o‘tish bloklangan |
| 5 | P0 | AE release `not_published` | Pullik plan va public CTA’da va’da qilingan mahsulot yuklanmaydi |
| 6 | P1 | Lemon Squeezy claim-first webhook | To‘lov eventlari transient xatoda abadiy yo‘qolishi mumkin |
| 7 | P1 | Kredit/top-up/refund transaction invariantlari buziladi | Kredit mint/loss va refund yo‘qolishi |
| 8 | P1 | CEP Admin arbitrary API base | Admin paroli/bearer attacker originiga yuborilishi mumkin |
| 9 | P1 | CEP unsafe ZIP/delete/download | Path escape, disk fill, hang yoki qaytmas katalog o‘chirish |
| 10 | P1 | 2FA eski sessiya va shared routelarni to‘liq yopmaydi | Majburiy MFA siyosati chetlab o‘tiladi |
| 11 | P1 | Pack/download hash, timeout va quota oqimlari fail-open | Offline cap bypass, tampered/unbounded download, noto‘g‘ri quota |
| 12 | P1 | Unified Voice/SFX model va quote drift | Boshqa model ishlaydi, ko‘rsatilgan narxdan boshqa charge bo‘lishi mumkin |
| 13 | P1 | Premiere CEP/UXP release arxitekturasi ikki xil | Clean install/update’da companion yo‘q yoki eski qoladi |
| 14 | P1 | `main` himoyasiz, deploy CI’ni kutmaydi | Test yiqilgan commit ham productionga chiqishi mumkin |
| 15 | P1 | 6 ta HIGH dependency advisory + dev deps runtime image’da | Supply-chain/DoS/SSRF risklari production image’da qoladi |

## 2. Production va repo bo‘yicha tasdiqlangan faktlar

- `https://api.getframeflow.app/health` va `/livez` — `200`; DB va storage `ok`.
- Git `HEAD` va `origin/main`: `97ea672a8baf8c011b5d1dbf30e3f1b4131828e2`.
- Oxirgi GitHub CI va Cloud Run deploy shu SHA’da muvaffaqiyatli; 2026-08-11…17 kundalik DB backup runlari ham muvaffaqiyatli.
- Public katalog: **15 asset**; 15/15 `hasPack:true`, 14/15 preview, 15/15 FREE, 0 PRO; jami fayl hajmi ~3.0 GB, eng kattasi ~1.15 GB.
- Katalog navigatsiyasi: 7 motion, 5 video, 2 SFX, 1 graphics; 2 SFX `uncategorized`.
- AE mac/win release: `latest:null`, `installerStatus:not_published`.
- Premiere mac/win release: eski standalone `0.1.5` CCX; lokal shared CEP `1.2.0` + companion arxitekturasi bilan drift bor.
- Production landing vizual jihatdan kuchli va landing/stock sahifalarida runtime console xatosi kuzatilmadi. Register ekranida Turnstile `400020` qayta-qayta chiqdi; Cloudflare bu kodni **invalid sitekey** deb belgilaydi: <https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/>.
- `npm run build` va auditda ishga tushirilgan lokal regressiya testlari o‘tdi. Bu quyidagi topilmalarni inkor qilmaydi: joriy testlar real Postgres concurrency, malicious HTML, real Adobe host, signed clean-machine install va live checkout/provider failure-injectionni qamramaydi.

## 3. Backend/API/DB/AI — 31 topilma

### Critical va High

**A01 · P0 — Approved pack/preview/thumb qayta moderatsiyasiz almashtiriladi.** `POST /templates/:id/upload-url` egalikni tekshiradi, lekin `APPROVED/published/scan` holatini bekor qilmasdan deterministik live keyga PUT URL beradi (`apps/api/src/routes/contributor.ts:1222-1277`, `apps/api/src/lib/s3.ts:149-159,539-557`). Re-review faqat klient keyin chaqiradigan `/pack-uploaded`da (`contributor.ts:1691-1805`). Download eski DB holatiga ishonadi (`apps/api/src/routes/plugin.ts:795-830,911-922`). **Fix:** versioned staging upload session, upload boshlanishida atomik unpublish, HEAD/magic/size/hash/malware scan va faqat verified versionni atomik promote.

**A02 · P1 — Lemon Squeezy claim-first webhook eventni yo‘qotadi.** Dedup qatori side-effectdan oldin yoziladi, duplicate doim `200`, catch claimni saqlaydi (`apps/api/src/routes/lemonsqueezy.ts:441-543`). Oraliq DB xatosidan keyingi provider retry eventni qayta ishlamaydi. **Fix:** `processing/succeeded/failed`, lease, attempts, lastError state machine; pul side-effectlarini transaction/outbox bilan yakunlash.

**A03 · P1 — Kredit/top-up parallel hisobida mint/loss.** Consume atomik, lekin `aiCreditsTopup` stale balansdan keyin clamp qilinadi va reset stale top-up bilan absolute write qiladi (`apps/api/src/lib/plugin-profile.ts:675-726`). DB’da `topup<=credits` CHECK yo‘q (`packages/database/prisma/schema.prisma:112-147`). **Fix:** row lock/serializable yoki bitta atomik SQL, transactiondagi reset/grant va DB CHECKlar.

**A04 · P1 — Refund applied deb oldin belgilanadi, kredit keyin beriladi.** `refunded=false→true` claim profil increment va ledgerdan alohida (`plugin-profile.ts:823-877`). Keyingi xatoda retry early-return qiladi. **Fix:** pending/applied status + applied amount va credit update bitta transactionda, reconciler.

**A05 · P1 — 2FA yoqilganda eski sessiyalar revoke qilinmaydi.** JWT 30 kun (`apps/api/src/middleware/auth.ts:32-38`); enable faqat bool yozadi (`apps/api/src/routes/auth.ts:655-687`). Oldin o‘g‘irlangan token MFA’dan keyin ham ishlaydi. **Fix:** enable’da `tokenVersion++`, plugin token delete, `amr/mfa_at`li yangi sessiya.

**A06 · P1 — `ADMIN_REQUIRE_2FA` shared/admin-by-role routelarda chetlab o‘tiladi.** Enrol qilinmagan admin to‘liq JWT oladi (`auth.ts:255-270`), `requireContributorOrAdmin` faqat rolni tekshiradi (`middleware/contributor.ts:3-19`). Upload/PATCH, AI reindex va messages admin shoxlari `requireAdmin`dan o‘tmaydi (`contributor.ts:1239-1243,3274-3321`, `routes/ai.ts:308-319`, `routes/messages.ts:50-55,78-102,181-205,311-325`).

**A07 · P1 — “Oxirgi admin” invariantida race.** Count/update serializable yoki advisory lock ostida emas (`apps/api/src/routes/account.ts:50-66`, `apps/api/src/routes/admin.ts:2067-2079,2132-2153`). Ikki parallel amal 0 faol admin qoldirishi mumkin.

**A08 · P1 — Presigned PUT real hajm/kvota bilan bog‘lanmagan.** Imzo faqat key + Content-Type (`apps/api/src/lib/s3.ts:149-159`); template/incoming/raw va gen ref yo‘llari real content-lengthni kriptografik cheklamaydi (`contributor.ts:1227-1277,1845-1885,2725-2781`, `studio-gen.ts:1499-1537`). Orphan obyektlar kvotaga kirmaydi. **Fix:** content-length-range POST policy yoki reserved upload row, completion HEAD/magic, lifecycle expiry/reconciliation.

**A09 · P1 — Katta body/media memory DoS.** 150 MB JSON parser authdan oldin (`apps/api/src/index.ts:247-270`), ref-upload `memoryStorage` va full buffers ishlatadi (`studio-gen.ts:1215-1412`); provider resultlari ham cap/streaming’siz `arrayBuffer` (`lib/ai/fal.ts:227-236`, `byteplus.ts:282-294`, `kling.ts:247-256`, `topaz.ts:377-387`). Cloud Run 1 GiB/20 concurrency (`.github/workflows/deploy-cloudrun.yml:150-159`).

**A10 · P1 — Public thumb/preview/scenes takedown holatini tekshirmaydi.** Generic media route DB publication gatesiz (`routes/plugin.ts:925-934`); serve faqat keyni redirect qiladi (`lib/serve-asset.ts:200-275`), Worker allowlist DB’dan mustaqil (`lib/public-keys.ts:45-59`). Oldin ma’lum ID media draft/rejected/DMCA holatida ham ochiq qoladi.

**A11 · P1 — Bir orderdagi keyingi partial refundlar dedupda yo‘qoladi.** Bir xil order/invoice key ishlatiladi (`lemonsqueezy.ts:188-273,430-439`); birinchi partial refund keyingi cumulative delta’ni bloklaydi. **Fix:** provider refund event ID yoki `refundedTotal - appliedTotal`ni transactionda qo‘llash.

**A12 · P1 — Account delete faol subscriptionni bekor qilmaydi.** User avval revoke/anonymize qilinadi, keyin providerda alohida cancel qilish aytiladi (`apps/api/src/routes/account.ts:66-116`). Login yo‘q userdan charge davom etishi mumkin.

**A13 · P1 — “GDPR deletion” prompt/media/message PII’ni o‘chirmaydi.** Route User maydonlarini tozalaydi, lekin Generation prompt/params/assets, SavedReference, messages, logs/audit va bucket obyektlari qoladi; delete auditiga eski email yoziladi (`account.ts:66-111`). **Fix:** retention matrix, delete/anonymize queue, R2/GCS cleanup, pseudonymous finance records va deletion receipt.

### Medium

**A14 · P2 — Single-use auth tokenlar check-then-act race.** Backup code va password reset parallel ikki marta ishlatilishi mumkin (`routes/auth.ts:301-340,495-524,690-733`). Atomic claim/delete kerak.

**A15 · P2 — `/gen` idempotency side-effectlardan keyin.** Daily cap, slot va credit unique Generation yozuvidan oldin (`studio-gen.ts:1566-1583,1791-1900`). Duplicate loser capni rollback qilmaydi, refund xatosi yutiladi, request hash tekshirilmaydi.

**A16 · P2 — fal submit↔persist crash window va JSON lost-update.** Provider request ID submitdan keyin yoziladi; erta webhook topilmay `200` oladi (`lib/gen-processor.ts:656-667`, `routes/fal-webhook.ts:122-175`, `lib/ai/fal.ts:160-176`). Alohida `ProviderJob` state machine kerak.

**A17 · P2 — Direct image/audio external reference immutable/owned emas.** Video rad qilinadi, lekin keyga aylanmagan image/audio HTTP URL size/type/ownershipsiz providerga uzatiladi (`studio-gen.ts:984-1010`, `lib/gen-processor.ts:481-504`). Provider-fetch abuse va quote-after-mutation xavfi.

**A18 · P2 — Legacy `/api/plugin/ai` charge oqimi transactional/idempotent emas.** Provider successdan keyingi storage/DB xatosi kreditni yo‘qotadi, retry double-charge qiladi (`routes/ai.ts:96-178,206-301`). Generation pipelinega ko‘chirish kerak.

**A19 · P2 — Distributed rate-limit config amalda ishlamasligi yoki false throttle.** `ioredis` dependency yo‘q, dinamik import fail bo‘lsa memory fallback (`middleware/rate-limit.ts:44-100`, `apps/api/package.json`). Env/topologiyaga qarab limit max×instance yoki bitta faol instanceda 10ga bo‘lingan holatga tushadi.

**A20 · P2 — Gen display/preview derivativlari quota/delete’da qoladi.** Schema ularni saqlaydi, retention/manual delete hammasini qamramaydi (`schema.prisma:615-629`, `lib/storage-quota.ts:95-159`, `routes/studio-gen.ts:2581-2605`).

**A21 · P2 — PlanConfig cold-start/stale money decision.** Cache timestamp fetch successdan oldin qo‘yiladi, sync getter refreshni await qilmaydi (`plugin-profile.ts:60-94,675-684`). Birinchi request admin narx/limitini e’tiborsiz qilishi mumkin.

**A22 · P2 — Upload progress SSE authsiz DB poll amplifier.** Public template ID bilan 200 parallel stream, har 2 soniyada DB poll (`contributor.ts:727-789`). Signed progress token va shared pub/sub kerak.

**A23 · P2 — Secret-bearing URL/token loglari.** Magnific signed URL to‘liq loglanadi; email yo‘q paytda verify/reset takeover linklari logga chiqadi (`gen-processor.ts:1565-1584`, `routes/auth.ts:46-68,450-485`).

**A24 · P2 — Readiness false-green.** Storage sozlanmagan bo‘lsa ham health healthy; 401/403 HeadBucket ham healthy (`index.ts:170-215`, `lib/s3.ts:166-179`). Production uchun PUT/GET/DELETE canary kerak.

**A25 · P2 — Legacy Stripe checkout LS/Stripe active-sub guard va idempotency’siz.** (`routes/auth.ts:953-1005`); canonical LS checkoutda guard bor (`routes/billing.ts:59-75`). Stripe env qolsa double subscription mumkin.

**A26 · P2 — Ingest queue per-user quota/dedupe’siz flood qilinadi.** Har request 50 key, `(contributorId,key)` active unique yo‘q (`contributor.ts:2638-2695,2785-2847`, `lib/ingest-worker.ts:94-119`).

**A27 · P2 — ESM dotenv ordering lokal/file-based launchni buzadi.** Static dependencies `.env` load’dan oldin evaluate bo‘ladi, auth/quote/S3 top-level env capture qiladi (`index.ts:1-45`, `middleware/auth.ts:32`, `lib/gen-quote.ts:10-14`, `lib/s3.ts:24-45`). Injected prod env mitigatsiya.

**A28 · P2 — ML/output moderation default off/fail-open.** Key yo‘q bo‘lsa CLEAN no-op, image strict alohida flag, output image-only (`lib/moderation.ts:9-29,98-142`, `gen-processor.ts:1379-1393`). Production required-env va media-specific quarantine kerak.

**A29 · P2 — Money/security state’larda DB constraint va concurrency testlar yo‘q.** `PluginProfile` nonnegative/topup/active CHECKsiz, Generation status/mode string, WebhookEvent state machine emas (`schema.prisma:112-147,208-215,525-560`). Real Postgres failure-injection/property testlar kerak.

### Low

**A30 · P3 — `headersSent` error `next(err)`siz yutiladi.** Mid-stream socket osilishi mumkin (`apps/api/src/index.ts:277-280`).

**A31 · P3 — TOTP encryption JWT secret’dan derivatsiya qilinadi.** JWT compromise TOTPni ham ochadi (`apps/api/src/lib/twofa.ts:17-27,127-140`). Productionda mustaqil required key va rotation kerak.

## 4. Contributor/Admin Studio — 24 topilma

### Critical va High

**S01 · P0 — Contributor payload → Admin stored XSS.** `metaJson` ixtiyoriy nested obyekt (`apps/api/src/routes/contributor.ts:250-260,3193-3375`); `meta.grad` raw class atributiga tushadi (`packages/assetflow-studio/js/studio-templates.js:32-56`, `js/studio-media.js:46-79`) va admin drawer shu renderer bilan ochadi (`js/admin-views2.js:763-780`). CSP `unsafe-inline`, token localStorage’da. **Fix:** server nested schema/`g1…g10` enum, `classList/textContent`, malicious contributor→moderation regression test.

**S02 · P1 — Health-check tugamasidan login formasi passwordni GET queryga yuborishi mumkin.** Submit listener `await StudioApi.healthCheck()`dan keyin ulanadi, health timeout yo‘q; forma markupida method/action yoki erta preventDefault yo‘q (`studio/login.html:61-71,103-106,210-223,404-428`, `admin/login.html:68,173-188,232`, `js/studio-api.js:152-159`).

**S03 · P1 — Studio/Admin JWT persistent localStorage’da.** (`js/auth.js:41-79,105-118`); hujjat sessionStorage deydi. CSP `unsafe-inline/unsafe-eval` (`scripts/prepare-cf-pages.mjs:302-335`). HttpOnly cookie yoki kamida session-only token kerak.

**S04 · P1 — Logout server revoke’ni kutmaydi.** Request fire-and-forget va darhol navigation (`js/auth.js:192-201`); test faqat local clearni tekshiradi.

**S05 · P1 — Global retry non-idempotent mutationlarni takrorlaydi.** (`js/studio-api.js:78-110`). Create/reply/broadcast/review/payout/CMS kabi amallar duplicate bo‘lishi mumkin. Retry faqat safe method; mutation uchun idempotency key.

**S06 · P1 — Messaging race noto‘g‘ri threadga reply yuboradi.** Global selection va kech async render/send bir-biridan uzilgan (`js/contributor-views.js:1561-1643`, `js/admin-views2.js:385-439,1195-1205`). Request epoch va stabil displayed thread ID kerak.

**S07 · P1 — Upload/moderation asosiy journey keyboard bilan tugamaydi.** Dropzone, moderation item, select-all va bir nechta qatorlar click-only div (`js/contributor-views.js:658-682,853-882`, `js/admin-views.js:304-327`, `js/admin-views2.js:277-289`, `js/admin-subscribers.js:181-196`, `js/admin-dashboard.js:111-119`).

### Medium

**S08 · P2 — Modal/drawer to‘liq accessible dialog emas.** Focus entry/restore va Escape bor, lekin `role=dialog`, `aria-modal`, accessible name, focus trap va background `inert` yo‘q (`js/ui.js:144-176,217-226`).

**S09 · P2 — Contributor mobile nav route almashtirgach ochiq qoladi.** Listener bir marta ulanadi, nav har renderda `innerHTML` bilan yangilanadi (`js/theme.js:105-139`, `contributor/index.html:140-190`).

**S10 · P2 — Admin business route stale response’ni yangi sahifaga yozadi.** Barcha sahifa bir `#bizRoot`, abort/epoch yo‘q (`admin/index.html:262-287`, `js/admin-business.js:36,178-185,257-269,416-445,547,592,816,848,856-876,942,951-974`).

**S11 · P2 — Single-upload progress callback contract buzilgan.** API `(loaded,total)` deydi, XHR faqat `loaded` beradi, UI ikkisini kutadi (`js/studio-api.js:226-229,275-277,349-365`, `js/contributor-views.js:1459-1467`). `0%/NaN MB` chiqishi mumkin.

**S12 · P2 — Bir nechta “Export CSV” tugmasi faqat toast.** (`js/admin-business.js:421,552,597,821`, `js/admin-subscribers.js:155`). Download yo‘q.

**S13 · P2 — Admin theme toggle fake.** State/toast o‘zgaradi, `.adx-app` dark tokenlarni qayta bosadi (`js/theme.js:45-75`, `styles/admin.css:125-168`, `admin/index.html:314-323`).

**S14 · P2 — Screen-reader live statuslari yetishmaydi.** Toast `aria-live`/status emas, bulk progress semantik `<progress>` emas, spinner status emas (`js/ui.js:82-116`, `js/contributor-views.js:624-655`, `js/admin-business.js:15-16`).

**S15 · P2 — Admin secondary text kontrasti va o‘lchami past.** `--muted2:#5E6675` taxminan 3.13–3.47:1, 7–10px matnda ishlatiladi (`styles/admin.css:125-133,182,208,241,275-276,292`).

**S16 · P2 — CMS unsaved changes himoyasi to‘liq emas.** Website dirty belgilanmaydi; Plugin CMS dirty ko‘rsatadi, lekin route/refresh warning yo‘q (`js/admin-website.js:786-793`, `js/admin-plugin-cms.js:105-133`).

**S17 · P2 — Til/timezone izchil emas.** UI English/Uzbek aralash, UTC string slicing Toshkent oy/kun chegarasini siljitishi mumkin (`js/admin-business.js:890-899,918-923,940`).

**S18 · P2 — Startup xatolari “0” sifatida ko‘rinadi.** 7 ta ish `Promise.allSettled`, ayrim failure faqat console (`admin/index.html:347-379`). Degraded/error/retry state kerak.

### Low

**S19 · P3 — `⌘K` hint bor, shortcut yo‘q.** (`admin/index.html:101-105`).

**S20 · P3 — Route error fallback `err.message`ni raw HTMLga qo‘yadi.** (`contributor/index.html:185-189`, `admin/index.html:289-293`).

**S21 · P3 — Bulk category almashtirish tanlangan fayllarni ogohlantirishsiz tozalaydi.** (`js/contributor-views.js:541-547`).

**S22 · P3 — Contributor reply busy/disable guardsiz.** Double-click + global retry duplicate xabarni kuchaytiradi (`js/contributor-views.js:1628-1643`).

**S23 · P3 — `prefers-reduced-motion` yo‘q.** Skeletonlar doim animatsiya qiladi (`styles/app.css:1225-1244`, `styles/admin.css:446-448`).

**S24 · P3 — Vercel backup build canonical CF builddan drift qilishi mumkin.** CF clean/hash qiladi, Vercel source tree ichiga clean/hashsiz nusxalaydi va auth route’lari to‘liq emas (`scripts/prepare-cf-pages.mjs:12-210`, `scripts/prepare-vercel.mjs:8-38`, `vercel.json:1-19`).

## 5. AE/Premiere CEP va UXP — 30 topilma

### Critical, High va Medium-High

**P01 · P0 — Customer CEP XSS → Node RCE.** CSP `unsafe-inline/unsafe-eval`, manifest Node/file access/mixed contextni yoqadi (`plugins/after-effects-cep/AssetFlow_Plugin.html:27-41`, `CSXS/manifest.xml:31-40`). Project/folder, host/API error va plan label bir necha joyda unescaped `innerHTML`ga tushadi (`AssetFlow_Plugin.html:9967-9973,12164-12212,14810-14828,15323,15396,16704-16726,16948-16963,17420,17496`). DOM/textContent, full escaping va malicious mutation testlari shart.

**P02 · P1 — CEP Admin arbitrary API originiga password/bearer yuboradi.** Base URL localStorage’dan, login/settings exact-origin allowlistsiz, token endpoint almashtirilganda saqlanadi; CSP yo‘q (`AssetFlow_Admin.html:1-24,669-690,749-790,875-900,3209-3214`). Release build faqat canonical HTTPS originni qabul qilishi kerak.

**P03 · P1 — Admin untrusted ZIPni OS unzip/PowerShell bilan cap/validation’siz ochadi.** Download ham HTTP(S), redirect, timeout/max/checksumsiz (`AssetFlow_Admin.html:581-607,1928-2009`). Zip bomb, traversal, symlink va stale mixed content xavfi.

**P04 · P0/P1 — Persisted Admin record arbitrary recursive delete qiladi.** localStorage’dagi `d.dir`/aep dirname `fs.rmSync(...recursive...)`ga containment/root/home guardsiz beriladi (`AssetFlow_Admin.html:2950-2988`). Recoverable trash va exact child realpath guard kerak.

**P05 · P1 — “Secure storage”ga qaramay token plaintext prefsga doim yoziladi.** (`assetflow-account.js:134-138,251-307,403-415`, `assetflow-local-store.js:741-745`). Secret-store successdan keyin prefs/legacy token o‘chirilishi kerak.

**P06 · P1 — Main ZIP extractor resource/integrity limitsiz.** Traversal check bor, ammo entry count/size/ratio/CRC/free-space/total output cap yo‘q va unsafe entryni archive’ni rad etmasdan skip qiladi (`assetflow-zip.js:45-147,194-270`).

**P07 · P1 — Pack SHA verification fail-open.** Hash read error empty qaytaradi, missing sidecar cache reuse’ni to‘smaydi, caller expected SHA bermaydi (`assetflow-catalog.js:935-949,1009-1038`, `AssetFlow_Plugin.html:5910-5923`). Immutable catalog SHA majburiy bo‘lishi kerak.

**P08 · P1 — Pack/MOGRT download unbounded, timeoutless va HTTPS downgrade mumkin.** Strict options faqat updaterda; pack/MOGRT calls max/https bermaydi (`assetflow-catalog.js:1069-1080,1120-1147,1235-1240,1273-1276,1391-1400`).

**P09 · P1 — Import plan gate fail-open va quota Adobe successdan oldin yechiladi.** `/record-import` host importdan oldin, faqat 403 blok; network/5xx yutiladi (`AssetFlow_Plugin.html:6090-6110,6204-6217`, `apps/api/src/routes/plugin.ts:1598-1613`, `lib/plugin-profile.ts:596-627`). Reserve→host→commit/cancel oqimi kerak.

**P10 · P1 — Unified Voice/SFX picker tanlangan emas, default modelni yuboradi.** Unified draft model ID legacy handlerga qo‘llanmaydi (`AssetFlow_Plugin.html:17690-17700,17776-17786,17888-17902,19066-19161`).

**P11 · P1 — Ko‘rsatilgan quote submitted signed quote emas.** Controller quote saqlaydi, draft signature bermaydi, legacy ikkinchi quote oladi (`frameflow-create-workspace.js:97,236-270`, `AssetFlow_Plugin.html:15030-15044,17576-17597,17888-17902,19066-19161`).

**P12 · P1 — Premiere updater/release componentlari mos emas.** Shared CEP `app=pr` kanalini so‘raydi, API faqat `.ccx`, frontend updater pkg/exe/msi qabul qiladi; customer package/installer companionni kiritmaydi (`AssetFlow_Plugin.html:5564-5569,18581-18642,18835-18840`, `apps/api/src/routes/plugin.ts:472-482`, `lib/plugin-release-contract.ts:50-66`, `package-flavors.mjs:26-56`, `installer-payload.mjs:1-9,70-78`). Alohida `cep-ui` va `pr-host-companion` version/channel + orchestrated signed installer kerak.

**P13 · P1 — Checkout/portal fallback shell injection.** Server URL shell `execSync`ga faqat quote escape bilan tushadi (`assetflow-account.js:842-855,866-934`). Exact HTTPS host allowlist + `spawn/execFile` argv kerak.

**P14 · P1/P2 — Unified required references ulanmagan.** Controller `addReference`ni qo‘llaydi, ammo repo call-site yo‘q; `+` legacy pickerga o‘tadi va tanlovni controllerga qaytarmaydi (`frameflow-create-workspace.js:156-205`, `AssetFlow_Plugin.html:19172-19233`). Image-edit/I2V user stuck bo‘ladi.

**P15 · P1/P2 — Google Fonts install supply-chain boundary keng.** CSS/binary redirect HTTP, host/max/MIME/magic/hash allowlistsiz va user Fontsga yoziladi (`assetflow-catalog.js:1550-1632,1681-1725`). Rozilik bor, validation yo‘q.

**P16 · P1/P2 — Unzip cache non-atomic va stale.** Size-only marker, final dirga to‘g‘ridan extraction; same-size update/crash stale yoki aralash fayl qoldiradi (`assetflow-catalog.js:966-975,1315-1454`).

### Medium

**P17 · P2 — AI result import remote URL max/HTTPS/timeout/hash/magic’siz.** (`AssetFlow_Plugin.html:10180-10223`). Temp lifecycle ham aniq emas.

**P18 · P2 — “Timeline/current frame” faol comp yo‘q bo‘lsa first CompItemni jimgina eksport qiladi.** (`jsx/host.jsx:2584-2618`, `AssetFlow_Plugin.html:14830-14839,16965-16972`). Noto‘g‘ri/maxfiy comp providerga ketishi mumkin.

**P19 · P2 — AI prompt/job history accountlar orasida leak.** `af_active_jobs` global; explicit logout clear qiladi, forced expiry clear qilmaydi (`AssetFlow_Plugin.html:10005-10020,11766-11777,12544-12548,19179-19190`). User ID bilan namespace kerak.

**P20 · P2 — Logout UI credential clear bo‘lishidan oldin success deydi.** API revoke await qilinguncha local token diskda qoladi, UI await qilmaydi (`assetflow-account.js:721-731`, `AssetFlow_Plugin.html:11766-11778`). Avval local clear, keyin best-effort revoke.

**P21 · P2 — Browse oldingi request xatosida eng yangi filter/searchni tashlaydi.** (`assetflow-catalog.js:507-559`). Abort/request generation kerak.

**P22 · P2 — CEP Admin cross-tab stale response race.** Shared `#listArea`, abort/currentTab guard yo‘q (`AssetFlow_Admin.html:992-1033,2771-2793`).

**P23 · P2 — CEP Admin network operations indefinite hang.** Core fetch, XHR va pack networkda timeout/cancel yo‘q (`AssetFlow_Admin.html:749-809,1539-1554,1928-1981`).

**P24 · P2 — Premiere bridge singleton mailbox race/replay.** Fixed files, in-process-only queue, stale request TTL/PID tekshiruvisiz (`assetflow-uxp-bridge.js:13,17,36-43,66-138`, `plugins/premiere-uxp/companion/bridge.js:31-58`). Per-panel nonce/PID, journal/ack va cancellation kerak.

**P25 · P2 — Companion dev installer registryni non-atomic overwrite qiladi.** Read/parse xatosini empty listga aylantirib unrelated UXP entrylarni yo‘qotishi mumkin; eski companion yangi copydan oldin o‘chadi (`install-uxp-companion.mjs:18-49`, `install-uxp-dev.mjs:51-127`).

**P26 · P2 — Premiere ExtendScript walk capsiz va identity collisionli.** Recursive all-project walk, `nodeId || name` dedupe bir xil nomli clipni tashlaydi (`jsx/host-premiere.jsx:75-87,287-291`).

**P27 · P2 — Pluginning asosiy workflowlari keyboard-accessible emas.** Launcher, result Use, lightbox actions, Admin avatar/template rowlar div/b bilan click-only (`AssetFlow_Plugin.html:13154,13218-13220,13321-13323,13797-13825`, `AssetFlow_Admin.html:443,1123`).

**P28 · P2 — Legacy full Premiere UXP va current invisible companion ikkalasi “current”dek turibdi.** README/manifest/build eski visible UI, companion alohida (`plugins/premiere-uxp/README.md:1-12,140-165`, `manifest.json:1-56`, `companion/manifest.json:1-23`). Release operator noto‘g‘ri CCX publish qilishi mumkin.

### Low

**P29 · P3 — Stale docs/dev switches.** README localhost default deydi, env production; install script global PlayerDebugMode’ni qaytarish yo‘riqnomasiz yoqadi; eski local path hint bor (`plugins/after-effects-cep/README.md:28`, `assetflow-env.js:5-45`, `scripts/install-cep.sh:50-52`, `assetflow-plugin-disk-bridge.js:338-340`).

**P30 · P3 — Dead auto-load/UI drift.** Script mavjud bo‘lmagan `editimage/editvideo/op` viewlarni poll qiladi; current Create tool boshqa IDlarda (`AssetFlow_Plugin.html:13705-13760`).

## 6. Production, business, web, SEO va DevOps — 17 topilma

**X01 · P0 — Email signup productionda bloklangan.** Hardcoded Turnstile sitekey (`packages/assetflow-studio/platform/index.html:5`) browserda `400020 invalid sitekey`; frontend tokensiz submitni to‘sadi (`index.html:20613-20618`), error callback userga config xatosini aytmaydi (`20714-20718`), backend prod’da fail-closed (`apps/api/src/lib/turnstile.ts:15-45`, `routes/auth.ts:110-135`). Google OAuth alternativ, ammo email/password acquisition ishlamaydi.

**X02 · P0 — AE CTA va plan va’dasi amalda yo‘q.** Production `/api/plugin/version` mac/win `latest:null/not_published`; public pricing Pro/Studio’da “After Effects plugin”, plugin page esa faol `.zxp` CTA ko‘rsatadi. Clickdan keyingina “not published” toast chiqadi. CTA waitlist/disabled holatga o‘tishi yoki signed paket nashr qilinishi shart.

**X03 · P1 — Pullik katalog qiymati yo‘q va public kategoriya da’vosi live data bilan mos emas.** 15/15 asset FREE, 0 PRO; landing “6 content categories” va LUT/audio kabi qamrovni aytadi, live navda 4 yo‘nalish va LUT/music yo‘q. Pro’dagi unlimited download qiymati hozir deyarli monetizatsiya bermaydi.

**X04 · P2 — Katalog data quality.** 1/15 preview yo‘q, 2 SFX `uncategorized`; kartalarda `4K/4k`, lowercase `hd`, `AI/Motion/Ae` nomenklaturasi aralash. Taxonomy/schema normalizatsiyasi va publish gate kerak.

**X05 · P1 — `main` branch protection ham, repository ruleset ham yo‘q.** GitHub API `Branch not protected`, rulesets `[]`. Direct push/rewrite/reviewsiz merge mumkin.

**X06 · P1 — Production deploy CI muvaffaqiyatini kutmaydi.** `ci.yml` va `deploy-cloudrun.yml` bir pushda mustaqil ishga tushadi (`.github/workflows/ci.yml:1-32`, `deploy-cloudrun.yml:1-31`). Deploy build/migration qiladi, lekin CI test matrixini kutmaydi. Branch required checks + deployni successful CI `workflow_run`/promotionga bog‘lash kerak.

**X07 · P1 — CI joriy testlarning katta qismini ishlatmaydi.** Workflow package/updater/release/install/responsive/public-copyni qamraydi, lekin API’dagi provider/reference/auth/upload/availability/param testlari, Studio session/device/create, CEP create/vNext/session/Premiere va UXP bridge suite’lari CI’da yo‘q. Auditda qo‘lda o‘tdi, keyingi regressiya main’ga kirishi mumkin.

**X08 · P2 — GitHub Actions commit SHAga pin qilinmagan.** `actions/*@v7`, `google-github-actions/*@v3`, `setup-dotnet@v4` mutable major taglar (`.github/workflows/*.yml`). Deploy WIF ishlatgani sabab actions supply-chain boundary muhim.

**X09 · P1 — Dependency auditda 6 HIGH.** Prisma zanjiri `deepmerge-ts@7.1.5` stack-exhaustion ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)); `pm2@7.0.3` orqali `js-yaml@4.3.0` quadratic CPU ([GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj)) va `ip-address@10.2.0` trust-boundary/SSRF ([GHSA-mwp4-54f8-5fhr](https://github.com/advisories/GHSA-mwp4-54f8-5fhr)). `npm audit --omit=dev`da ham Prisma zanjiri 3 HIGH qaytdi.

**X10 · P2 — Docker single-stage va dev dependencies production image’da.** `COPY .` + `npm ci --include=dev`, prune/multistage/non-root user yo‘q (`Dockerfile:1-32`). PM2/Prisma CLI/build tool va ularning advisoriesi runtime image’da qoladi; image kattalashadi va attack surface oshadi.

**X11 · P2 — Public SPA monolit.** `platform/index.html` 1,108,650 byte/24,587 qator; 460 KB inline JS + 451 KB inline CSS, har route shu shellni oladi; compressed transfer ~264 KB, ustiga React/runtime/fontlar. Route-level caching/code split yo‘q, CSP uchun `new Function` talab qilinadi (`platform/assets/dc-runtime.js:743,1092`). Mobile parse/compile, maintainability va XSS blast radius oshadi.

**X12 · P2 — SEO metadata noto‘g‘ri/duplikat.** `/stock` generic home canonical/OGdan keyin route-specific meta append qiladi (`functions/stock/[[path]].js:115-151`): ikki canonical/description/OG/Twitter to‘plami. `/pricing` va `/plugin` serverdan home title/canonical oladi; crawler/social bot JavaScriptsiz home preview ko‘radi.

**X13 · P2/P3 — Soft-404 va brauzer assetlari yo‘q.** Noma’lum URL, `/favicon.ico` va `/manifest.webmanifest` `200 text/html` bilan 1.1 MB SPA shell qaytaradi. Router noma’lum pathni landingga aylantiradi (`platform/index.html:19134-19141`). Haqiqiy 404, favicon, apple-touch icon, manifest va route-aware edge metadata kerak.

**X14 · P2 — Guest app chrome login holatini soxtalashtiradi.** `user:null` bo‘lsa ham `User`, `Free plan`, Account/Downloads/Projects va `Sign out` menu ko‘rinadi (`platform/index.html:16512-16523,18220-18240,23122-23133`). Guestga Sign in/Create account ko‘rsatilishi kerak.

**X15 · P2 — Public accessibility/semantic polish.** Stock page H1siz H2 bilan boshlanadi (`platform/index.html:16867-16883`); theme dots 17×17, promo dismiss ~21×18 — WCAG 2.2 24×24 targetdan kichik (`index.html:14211`). Landing stats scrollgacha `statP=0` bilan `0` ko‘rsatadi (`16155-16165,19350-19399,19766,23198-23210`), virtual cursor/screen reader noto‘g‘ri qiymat o‘qishi mumkin.

**X16 · P1 — “Yagona haqiqat manbai”ning o‘zi qarama-qarshi.** `docs/PROJECT-STATUS.md` tepasida Cloud Run/GCS/Cloud SQL/FrameFlow va current CEP 1.2.0, pastda Render/R2/Neon/AssetFlow, eski URL/commands va bajarilgan deb yozilgan eski claimlar birga turadi. `AGENTS.md`, `HANDOFF.md`, `DR-RUNBOOK.md`, `MARKETPLACE-SUBMISSION.md` ham version/infra bo‘yicha drift qiladi. Bu agent/operatorni noto‘g‘ri prod URL, deploy, restore yoki releasega yo‘naltirishi mumkin. Current-state hujjatni ≤2–3 sahifaga qisqartirib, tarixni `docs/archive/`ga ajratish kerak.

**X17 · P0 release gate — Kod bilan tasdiqlab bo‘lmaydigan tashqi ishlar ochiq.** Signed ZXP/PKG/MSI va clean-machine install, real AE/Premiere restart/smoke, bir arzon real-provider canary, live checkout→webhook→plan/credit→cancel/refund, restore drill, asset bucket versioning, production Sentry/moderation/malware env va yurist sign-off dalili yo‘q. Bular bajarilmaguncha “production/Marketplace ready” deb e’lon qilish mumkin emas.

## 7. Nima yaxshi va saqlanishi kerak

- Production API, DB va storage sog‘lom; oxirgi CI/deploy hamda kundalik backup runlari green.
- Cost quote authdan alohida secret, server-side reprice va model/pricing boot validatorlari kuchli.
- Production CORS empty/`*`da boot fail-stop; Helmet va structured access logs bor.
- Stripe/LS/FAL webhook signatures tekshiriladi; FAL ED25519 timestamp/body hash bilan.
- First-party fetch SSRF himoyasi DNS/private-IP/redirect bo‘yicha yaxshi.
- API ZIP/path traversal/bomb himoyalari, malware quarantine, duplicate/anti-theft va pack download gate’lari mavjud.
- Auth har requestda user/tokenVersion/statusni DB’dan qayta tekshiradi; normal admin login TOTPni talab qiladi.
- Download va active generation slotlari atomik; worker lease/heartbeat/stuck reconciler bor.
- Multipart nesting/files/parts limitlari aniq va regression testli.
- Studio CF build canonical source’dan clean dist va cache-bust yaratadi; upload resume/abort/beforeunload ishlangan.
- CEP customer/admin package ajratilishi, updaterning signed HTTPS/SHA/cap/temp-cleanup qismi va cross-origin auth stripping yaxshi.
- Premiere bridge random 256-bit secret, mode `0700`, allowlisted dispatcher; arbitrary JSX eval yo‘q.
- Shared AE/Premiere UI responsive testlari keng; unified modal focus trapga ega.
- Tracked fayllarda obvious plaintext Stripe/Google secret topilmadi.

## 8. Ishga tushirilgan tekshiruvlar

### PASS

- Root/workspace build: API TypeScript + 51 model/24 enabled validator, database TypeScript, CEP static build.
- Prisma schema validate; 72 migration katalogi mavjud. Live DB drift deploy workflowda green, auditda bevosita DB credential ishlatilmadi.
- API testlari: preflight, upload limits, device auth, provider availability/adapters, public keys, enhance, moderation, pricing, video trim, plugin session/release, gen reference/param contracts.
- Studio testlari: download state, session policy, AI create init/parity, device auth.
- CEP/UXP testlari: package security, updater 118, installer 262, Windows installer 169, Marketplace 100, responsive 105, release 110, Premiere host/integration, create, vNext, session persistence, host shim va CEP↔UXP bridge.
- Root contracts: gen client 44, dependency floors, public copy 137.
- Production read-only: health/livez/catalog/featured/landing config/release endpoints; public landing/stock/pricing/plugin browser inspection.
- `npm audit`: muvaffaqiyatli bajarildi va 6 HIGH advisoryni qaytardi — bu PASS emas, topilma X09.

### Ataylab bajarilmadi

- Productionga yozadigan Contributor→Admin→publish→import pipeline testi.
- Real checkout/refund/cancel va provider pullik generation.
- AE/Premiere GUI restart/import/clean-machine installer va signing/notarization.
- Production env secret qiymatlari, private Cloud Run logs/Sentry dashboard va live DB query.
- Formal axe/Lighthouse barcha breakpointlar, tashqi penetration test va yurist/compliance certification.

## 9. Tuzatish tartibi va release darvozalari

### 0-bosqich — bugun: zarar va noto‘g‘ri sotuvni to‘xtatish

1. AE CTA/plan copy’ni “Coming soon / waitlist”ga o‘tkazish yoki signed paketni nashr qilish.
2. Turnstile sitekey/secret/domainni birga sozlash; real email signup smoke’ni release gate qilish.
3. Contributor live-key PUTni yopish; approved asset upload boshlanishidayoq unpublish/quarantine.
4. Studio `meta.grad` va CEP barcha raw HTML sinklarini allowlist/escape qilish.
5. CEP Admin API originni production exact allowlistga qamash; recursive delete va OS ZIP extractionni vaqtincha disable qilish.

### 1-bosqich — pul va auth invariantlari

6. LS webhook processing state/outbox; top-up/reset/refund/partial-refund transactionlari va DB CHECKlar.
7. 2FA enable’da barcha sessiyani revoke; admin shared route’larda markaziy MFA gate.
8. Account delete oldidan provider cancel; privacy deletion job + receipt.
9. Real Postgres concurrency/failure-injection testlari: webhook, refund, topup, `/gen` idempotency, last-admin.

### 2-bosqich — distribution va local security

10. Pack/MOGRT/result/font download uchun HTTPS exact host, timeout, size/free-space, SHA/magic; atomic staging extraction.
11. Import quota reserve→host→commit/refund; offline capped plan fail-closed.
12. Unified composer tanlangan model + aynan ko‘rsatilgan signed quote bilan submit qilsin.
13. CEP UI va Premiere companion uchun alohida version/channel/dependency manifest va bitta signed orchestrated installer.
14. Plaintext prefs token migration; OS secret store successda legacy tokenlarni o‘chirish.

### 3-bosqich — platforma va operatsiya

15. Branch protection/ruleset + required CI; deploy faqat successful CI artifact/SHA promotiondan keyin.
16. Barcha auditda ishlatilgan testlarni CI matrixga qo‘shish; actions commit SHAga pin.
17. Dependency upgrade; multi-stage Docker, `npm prune --omit=dev`, non-root runtime.
18. 150 MB parserdan oldin cheap auth/length gate; streaming/caps/semaphore; presigned upload reservation/lifecycle.
19. Public derivativ takedown/delete/quota reconciliation va storage canary readiness.

### 4-bosqich — UX, accessibility va content

20. Guest chrome, keyboard journeys, dialog semantics, contrast, live regions, touch targets, H1/SEO/404/favicons.
21. 15 asset demo katalogni real Free/Pro assortment va public kategoriya da’volari bilan moslashtirish.
22. SPA shellni route chunks/cacheable CSS/JSga ajratish; strict CSPga o‘tish rejasi.
23. `PROJECT-STATUS`ni current-only hujjatga aylantirish; eski infra/release/DR yozuvlarini archive qilish.

### Final launch sign-off

Quyidagi dalillar bir papkada saqlanmaguncha launch yo‘q: email+Google signup, email verify/reset, checkout/renew/cancel/refund, contributor upload→admin review→web/AE/PR import, Free/Pro limitlar, 4 AI mode canary + failed-job refund, signed mac/win clean install/update/rollback, DB restore drill, takedown/delete privacy test, axe/Lighthouse keyboard/mobile pass va yurist tasdig‘i.

## 10. Audit chegarasi

Bu audit kod, lokal avtomatika va productionning xavfsiz read-only yuzalarini juda keng qamradi, lekin formal pentest yoki huquqiy sertifikat emas. Real to‘lov, provider, Adobe host va destructive workflow ataylab ishga tushirilmadi; shuning uchun ularning **dalili yo‘qligi release gate**, “albatta buzilgan” degan da’vo emas. Aksincha, yuqoridagi A/S/P/X topilmalar kod yoki live response bilan bevosita tasdiqlangan.
