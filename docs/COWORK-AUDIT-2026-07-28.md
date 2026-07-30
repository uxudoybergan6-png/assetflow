# FrameFlow — To'liq mustaqil audit (2026-07-28)

**Auditor:** Claude (Cowork), direktor daftaridan MUSTAQIL ravishda — barcha topilmalar haqiqiy kodni o'qish orqali tasdiqlangan (fayl:qator ko'rsatilgan).
**Qamrov:** butun monorepo — `apps/api` (backend), `packages/assetflow-studio` (web), `plugins/after-effects-cep`, `workers/cdn-proxy`, `functions/`, `packages/database` (Prisma), infra/deploy, `.github/workflows`, hamda `docs/` dagi 12 ta asosiy direktor hujjati (MUAMMOLAR V1/V2, MUAMMOLAR-1/2, DIREKTOR-AUDIT/V2, DIZAYN-AUDIT, LAUNCH-READINESS, PROJECT-STATUS, HANDOFF va boshqalar) to'liq o'qildi.

---

## 1. Umumiy xulosa

Loyiha o'z sinfidagi "vibe-coded" SaaS'lardan ancha yuqori darajada: **pul zonasi (kredit consume/refund, imzolangan narx-kvota, webhook idempotency) chinakam puxta qurilgan**, SSRF/zip-slip/IDOR himoyalari qatlamli, migratsiyalar intizomli, pul integer-cent'da. Direktor daftari ham hayratlanarli darajada aniq — undagi "fixed" deb yozilganlarning katta qismi kodda haqiqatan bor.

Lekin mustaqil audit daftarda YO'Q bo'lgan **2 ta yangi pul-race'i (HIGH)**, plaginda **2 ta shell-injection (RCE)**, Lemon Squeezy webhook'ida **ikki marta kredit berish yo'li**, va diskda yotgan **jonli cloud kalitlar**ni topdi. Launch'dan oldin bular yopilishi shart.

**Baho: kod poydevori — kuchli (8/10), operatsion tayyorlik — o'rtacha (6/10), launch-holati — hali emas (asosiy blok: katalog bo'shligi + quyidagi P0/P1 lar).**

---

## 2. Direktor daftari — qisqa xulosa va ishonchliligi

Daftar (07-08 → 07-23 davri) quyidagilarni qamrab olgan: 27+35 muammo (V1), P1–P35 (V2), D1–D21 dizayn, THREAT H1–H8, 5 ta hardening FAZA, SC/R4/RELEASE-SECURITY raundlari. Asosiy qarorlar: paketlar 250/600/1800 kredit ($5/$12/$35), Studio 3000, pool ulushi 30% (infra ayirilgan holda), watermark bekor (DRM = past sifat), AE 2022+ minimal host, PAYOUT_MODE=pool, provayder filtrini chetlab o'tuvchi kod taqiqlangan.

**Daftarning aniqligi: ~90%.** Tekshirilganda:

| Daftar daʼvosi | Kodda holat |
|---|---|
| D1/D2 narxlar (250/600/1800, Studio 3000) + boot-assert | ✅ TASDIQLANDI — `assert-pricing-floors.ts:26-33`, barcha 5 kanal floor'dan yuqori |
| D3 pool 30% + infra ayirish | ✅ TASDIQLANDI — `earnings.ts:51-56,99` |
| D5 top-up/plan kredit ajratish | ✅ BOR — `schema.prisma:113 aiCreditsTopup` (oylik reset'da saqlanadi) |
| Pro plan server-gate (plagindan bypass bo'lmaydi) | ✅ TASDIQLANDI — `plugin-profile.ts:224-232` obunasiz PRO rad etiladi; prod'da `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE:"false"` |
| Step 8 (refund'dan oldin provayderdan so'rash) — daftar "keyinga qoldirildi" degan | ✅ ASLIDA BAJARILGAN — `gen-processor.ts:1279,1829-1873` probe-before-refund ishlaydi. Daftar eskirgan |
| AE 2022+ manifest | ✅ TASDIQLANDI — `manifest.xml: Host AEFT [22.0,99.9]` |
| CDN Worker gate (pack/mogrt 403) | ✅ TASDIQLANDI — `isPublicReadKey()` bitta manbadan |
| P28: Windows-xavfsiz unzip, execFile migratsiya, sha256 pack tekshiruvi | ❌ **HALI OCHIQ** — quyida P0-3/P0-4 |
| P26: to'lov UX (busy-state, ?checkout=success) | ❌ bajarilgani haqida yozuv yo'q, kodda ham topilmadi |
| Sybil himoyalari (block J) | ❌ OCHIQ (ataylab — payout o'chiq turibdi, bu to'g'ri qaror) |
| Daftarning o'z xatolari | P7.3/P20.3 va P11 tashxislari noto'g'ri bo'lgani daftarning o'zida tan olingan — "fixed" ≠ fixed tamoyili to'g'ri |

---

## 3. YANGI KRITIK topilmalar (daftarda YO'Q)

### P0-1. Oy boshida kredit-reset race → cheksiz bepul generatsiya (HIGH)
`apps/api/src/lib/plugin-profile.ts:593-604` — `consumeAiCredits` ichidagi oylik reset **guard'siz absolyut yozuv**: `aiCreditsResetAt < start` tekshiruvi o'qish paytida, yozuv esa shartsiz `update`. Oy almashgan zahoti N ta parallel `/gen` so'rovi har biri balansni to'liq allotmentga qayta o'rnatib, boshqalarning atomik ayirishlarini o'chirib yuboradi. Xuddi shu faylning 144-149-qatorlarida to'g'ri pattern (`updateMany({ where: { monthResetAt: { lt: start } } })`) allaqachon bor — shuni qo'llash kifoya.

### P0-2. `refundAiCredits` — atomik emas (HIGH)
`plugin-profile.ts:686-696` — eski o'qilgan `prof.aiCredits + cost` qiymati absolyut yoziladi (`increment` emas, balans-guard yo'q). Fon reconciler har 10 daqiqada refund qiladi; foydalanuvchi shu payt faol generatsiya qilsa, consume yozuvi yo'qoladi (bepul gen) yoki sotib olingan top-up yutiladi. Double-refund guard (`refunded=false→true`) to'g'ri, lekin balans yozuvining o'zi racy.

### P0-3. Plagin: ZIP import orqali shell-injection = RCE (HIGH)
`plugins/after-effects-cep/assetflow-local-store.js:546` — `execSync("unzip -o -q " + JSON.stringify(outPath) ...)`. Shell qo'sh tirnoq ichida `` ` `` va `$(...)` baribir bajariladi; fayl nomi sanitizer'i (534-qator) bularni o'tkazadi. `` `whoami`.zip `` kabi nom = foydalanuvchi mashinasida buyruq bajarish. Bonus: Windows'da `unzip` yo'q — **Windows'da import umuman ishlamaydi** (daftar P28 buni bilardi, "scheduled" edi — hali tuzatilmagan). Yechim: `execFileSync("unzip",[...])` — `assetflow-catalog.js` allaqachon shu xavfsiz patternda.

### P0-4. Plagin: `openExternal` shell-injection (MED-HIGH)
`assetflow-account.js:391-396` — `cp.execSync('open "' + url + '"')`, faqat `"` almashtirilgan. URL server javobidan keladi (checkout URL, adminUrl) — buzilgan/MITM API = RCE. Yechim: `execFile('open',[url])`.

### P0-5. Lemon Squeezy: retry'da ikki marta kredit berish (MEDIUM, pul)
`routes/lemonsqueezy.ts:222-247, 468-475` — `handleOrderCreated`: `grantAiCreditsTopup` (shartsiz increment) → `recordRevenueEvent` throw qilsa → catch dedup-claim'ni **o'chiradi** → LS retry butun handler'ni qayta ishlaydi → **top-up ikki marta beriladi**. Refund yo'nalishida ham simmetrik (ikki marta clawback). Yechim: grant/clawback'ni order-id bilan idempotent qilish.

### P0-6. `/gen`: consume → `generation.create` xatosi (P2002 emas) → kredit abadiy yo'qoladi (MEDIUM)
`routes/studio-gen.ts:1536-1578` — DB xatosi P2002 bo'lmasa refund yo'q, Generation qatori ham yo'q — reconciler va backfill uni hech qachon ko'rmaydi. Foydalanuvchi puli jimgina yonadi.

### P0-7. Jonli cloud kalitlar diskda (rotatsiya SHART)
- `vwrap.mjs:4` — **jonli GCS HMAC kaliti** (prod bucket `assetflow-assets-2026`ga to'liq o'qish/yozish/o'chirish) kod ichiga yozilgan.
- `apps/api/.env` — eski R2 kalitlari.
- Yaxshi xabar: `git ls-files` tekshirildi — bu fayllar **git'ga HECH QACHON commit qilinmagan** (`.gitignore` to'g'ri ishlagan), GitHub'da yo'q.
- Lekin: ular loyiha papkasida ochiq yotibdi va **shu audit jarayonida tahlil kontekstiga tushdi** (jumladan `COST_QUOTE_SECRET` va Turnstile secret ham). Ehtiyot chorasi sifatida quyidagilarni **rotatsiya qiling**: GCS HMAC juftligi, R2 kalitlari, `COST_QUOTE_SECRET`, `TURNSTILE_SECRET_KEY`. So'ng `vwrap.mjs`ni o'chiring yoki env'dan o'qiydigan qiling.

---

## 4. Backend — qolgan muhim topilmalar

- **M:** `/api/logs` POST — foydalanuvchi bergan `id` bilan boshqalarning log yozuvini ustidan yozish mumkin; `meta` chegarasiz (14MB); har POST'da butun fayl sinxron qayta yoziladi (`routes/logs.ts:82-108`). Plagin tomonda esa bu endpoint'ga **Authorization'siz** yuboriladi (`assetflow-log.js:66-74`).
- **M:** 150MB `express.json` + base64 buferlar (`index.ts:213`, `studio-gen.ts:1073-1130`) — 1Gi instansda 2-3 parallel so'rov OOM qiladi; Cloud Run HTTP/1 cap 32MB — bu yo'l ehtimol allaqachon sinadi. Presigned-upload'ga o'tkazing.
- **M:** Ko'p-instans rejimda resume/idempotency zaiflashadi — enhance idempotency kesh, rate-limit, gen semaforlar hammasi in-memory (`ioredis` hatto dependency emas). `max-instances 10` bilan limitlar 10× bo'ladi.
- **M:** Login'da per-akkaunt lockout yo'q (faqat per-IP 10/min, in-memory) — taqsimlangan credential stuffing ochiq.
- **M:** `PluginToken.token` DB'da ochiq matnda saqlanadi va indekslanadi (`schema.prisma:245`) — DB leak = barcha plagin sessiyalari. SHA-256 hash saqlang.
- **M:** Pul bilan ishlaydigan API'da **avtomatik test yo'q** (package.json'da test framework yo'q) — yuqoridagi ikki race aynan shu bo'shliqning mahsuli.
- **M:** `GET /api/contributor/catalog` — auth'siz, sahifalash'siz, to'liq `metaJson` bilan (`contributor.ts:3575`) — plagin katalogi ataylab yashiradigan ichki metadata'ni oshkor qiladi.
- **L:** 2FA backup-kod check-then-write; TOTP kaliti default JWT_SECRET; SIGTERM handler yo'q (deploy'da in-flight so'rovlar uziladi); `/health` limitsiz DB+S3 tekshiradi; `apply-ae-prefs` endpoint'i server diskiga yozadi (dev qoldiq).
- **God-fayllar:** `contributor.ts` 3 927 qator, `gen-processor.ts` 2 112, `studio-gen.ts` 2 054 — ikkala HIGH race ham dublikat mantiq atomik "aka-uka"sidan uzoqda yashagani uchun paydo bo'lgan.

**Sog'lom deb tasdiqlanganlar:** narx-kvota HMAC (params-hash bilan), atomik consume/download gate'lar, refund double-fire guard, Stripe/LS/fal imzo tekshiruvlari, SSRF allow-list har joyda, barcha raw SQL parametrlangan, IDOR topilmadi (har route ownership tekshiradi), zip-slip/zip-bomb guard'lar.

---

## 5. Frontend + UX/UI

### Kod
- **H:** Platform SPA token'ni `localStorage.ff_token`da saqlaydi (`platform/ff-api.js:5-20`) — studio buni allaqachon sessionStorage'ga ko'chirgan (`login.html:163` eski patternni "XSS risk" deb tozalaydi!). Eng katta trafikli sirt eng zaif qolgan. Daftar GAP3 buni bilardi — hali ochiq.
- **H:** CSP o'z-o'zini bekor qiladi: 138+ inline `onclick` + `dc-runtime` `new Function` tufayli `unsafe-inline`+`unsafe-eval` majburiy (`prepare-cf-pages.mjs:246` — kodda buni o'zi tan olgan).
- **H:** `js/` = `studio/js/` = `admin/js/` uch nusxa commit qilingan build-artefakt — va **allaqachon drift bor**: `admin-releases.js` 135 qator farq (installer+SHA256 oqimi faqat manbada). ~1.1MB o'lik kod; grep/patch noto'g'ri nusxaga tushishi mumkin.
- **H:** 17 ta ichki mockup (`platform/_*.html`, ~1MB) prod deploy'ga kiradi (`prepare-cf-pages.mjs:87` butun papkani ko'chiradi) — `getframeflow.app/_platform-redesign-mockup.html` ochiq.
- **M:** `index.html` 23 112 qator, qo'lda yozilgan template-runtime; plagin bilan "sync manually" kommentlar orqali qo'lda nusxa ko'chiriladi — drift kafolatlangan.
- **M:** Admin "Settings" saqlash tugmasi soxta (faqat brauzerga, toast "server sync in a future version"); plan/promo konfiguratsiyasi localStorage-birinchi — ikki admin ikki xil narx holatini ko'rishi mumkin.
- **M:** `studio-api.js:60-74` POST'larni idempotency-key'siz 3× retry qiladi (`ff-api.js` to'g'ri, UUID bilan) — dublikat submit xavfi.

### UX/UI
- **Accessibility eng qolgan soha:** butun kodda birorta `:focus-visible` yo'q; 21 ta bosiladigan `<tr onclick>` klaviaturadan ishlamaydi; icon-tugmalarda `aria-label` yo'q; modal'da `role="dialog"`/focus-trap yo'q; `<html lang>` yo'q. Admin/contributor panellari amalda faqat-sichqoncha.
- **Kontrast:** `--muted2:#5E6675` qora fonda 3.32:1 (WCAG talab 4.5:1), 10px mikro-yorliqlarda 26 joyda ishlatilgan.
- **Uch mahsulot bir plashchda:** contributor (violet/teal, sidebar), admin (amber, adx-shell), platform (lime) — uch theme tizimi, ikki storage-key (`af-theme` vs `ff-theme`), admin'da yuklangan theme.js o'lik kod. Kirish `hub.html` "Which panel?" sahifasi orqali.
- **1 213 ta inline `style="..."`** va 167 unikal hex — token tizimini yuvib yuborgan; accent hali ham `--violet` nomida lime qiymat bilan.
- **Yaxshi tomonlari:** escaping intizomi kuchli (faqat 21 ta ID-interpolatsiya istisno), platform SPA'da 167 catch / 38 Retry / skeleton'lar — xato-holatlar madaniyati chinakam yaxshi; dizayn tili (Hanken Grotesk + Plex Mono, uch tema) kogerent va premium.
- **Spec ziddiyati:** DESIGN-PROMPT "barcha UI matnlari o'zbekcha" deydi — shipped UI 100% inglizcha, i18n qatlami umuman yo'q.

---

## 6. Plagin + Workers

- P0-3/P0-4 (yuqorida) — ikkita shell-injection.
- **M:** Token diskda ochiq matnda (`prefs.json`) — istalgan lokal jarayon o'qiy oladi. Server-side revocation (tokenVersion) bor — zarba radiusi cheklangan, lekin OS keychain afzal.
- **M:** Lokal meta-store'da read-modify-write race (`assetflow-local-store.js:322`, disk-bridge variantida await'lar orasida) — tez ketma-ket upload'da yozuvlar yo'qoladi.
- **L:** Updater zanjiri kuchli (HTTPS-only, SHA-256 stream, spawn-array, traversal guard) — lekin hash o'sha API'dan keladi, pinned imzo kaliti yo'q; haqiqiy himoya OS installer imzosi. Pack/mogrt/font yuklamalarida esa httpsOnly/maxBytes flag'lari o'chiq.
- **L:** CDN worker `ACAO:*` — hotlink himoyasi yo'q (ommaviy media uchun qabul qilsa bo'ladi).
- **INFO:** `premiere-uxp/` bo'sh stub. `.fuse_hidden*` host.jsx nusxalari va `_*.html` mockuplar daraxtni iflos qiladi — lekin packager allowlist'i (`package-flavors.mjs`) ularni customer ZXP'ga o'tkazmaydi (preflight testlar bilan) — bu juda to'g'ri qilingan.
- **Yaxshi:** cross-origin redirect'da Authorization header tashlab yuboriladi; `--disable-web-security` taqiqlangan va test bilan qo'riqlanadi; atomik `.part`→rename yuklab olish.

---

## 7. Infra / DB (tuzatilgan holda)

Muhim: dastlabki agent xulosasidagi "CI yo'q, backup yo'q, migratsiya ishlamaydi" daʼvolari **noto'g'ri chiqdi** — mening tar arxivimga `.github/` kirmagan ekan. Qayta tekshirdim (bevosita diskda):

- ✅ `.github/workflows/` BOR: `ci.yml` (Windows MSI real build bilan), `db-backup.yml` (har kuni 03:00 UTC cron), `deploy-cloudrun.yml` (**migrate:deploy bajaradi**, image'ni `:latest` + `:GITHUB_SHA` bilan teglaydi) — runbook'lar haqiqatga mos.
- ⚠️ Lokal `deploy-cloudrun.sh` esa migrate'siz va faqat `:latest` — laptopdan deploy qilinsa xavfli yo'l. CI-only qilib qo'ying yoki skriptga migrate qo'shing.
- **M:** `render.yaml` o'lik/eskirgan (COST_QUOTE_SECRET yo'q — boot FATAL, LS env'lari yo'q) — o'chiring, "ikki production" chalkashligini yo'qoting.
- **M:** SIGTERM/graceful shutdown yo'q (`index.ts`) — Cloud Run har deploy'da in-flight ishlarni uzadi.
- **M:** GDPR: `TemplateDownloadEvent.ip/userAgent` muddatsiz saqlanadi; self-delete User'ni anonimlashtiradi, lekin bu qatorlar userId bilan qoladi — purge job kerak.
- **M:** Bitta xizmat hammasini qiladi (user traffic + gen processing + inline ingest worker + scheduler'lar, 1 vCPU) — o'sishda birinchi bo'g'in.
- **M:** `clear-assetflow-demo.mjs` BARCHA StudioMessage'larni o'chiradi, DRY_RUN/prod-guard yo'q (backfill-* oilasi esa namunali).
- **L:** Dockerfile: `npm install` (ci emas), root user, single-stage; `.dockerignore` daʼvo qilingan joyda yo'q — `COPY . .` diskdagi `.env`ni image'ga qo'shadi.
- **L:** Bitta region, restore-drill o'tkazilmagan, asosiy bucket'da lifecycle yo'q (contributor kvotasiz — H5), pack'lar CDN'ni chetlab signed GCS URL bilan = to'lanadigan egress.
- **Yaxshi:** pul integer-cents, 59 ta additive-only migratsiya, webhook/earnings unique idempotency kalitlari, health/livez ajratilgan.

---

## 8. Daftar bilmagan / eskirgan joylar — xulosa jadvali

| | |
|---|---|
| **Daftar to'g'ri, kod tasdiqladi** | Narxlar D1/D2, pool D3, top-up D5, Pro server-gate, CDN gate, AE 2022 manifest, watermark-dormant, probe-before-refund (hatto daftar o'ylaganidan yaxshiroq — bajarilgan) |
| **Daftar "ochiq" degan, hali ham ochiq** | P28 plagin injection/unzip (endi P0!), to'lov UX (P26), sybil himoya, shared-store rate-limit, localStorage token (GAP3), CSP unsafe-inline, katalog bo'shligi |
| **Daftar umuman bilmagan** | P0-1 reset-race, P0-2 refund-race, P0-5 LS double-grant, P0-6 kredit yo'qolishi, P0-7 diskdagi kalitlar, /api/logs tampering, admin-releases drift, mockup'lar prod'da, soxta Settings save, SIGTERM, GDPR IP retention |

---

## 9. Tavsiya etilgan tartib (prioritet bo'yicha)

**Shu hafta (pul + RCE):**
1. P0-1, P0-2 — ikkala kredit race'ini mavjud guarded-`updateMany` patterni bilan tuzatish (yarim kunlik ish).
2. P0-3, P0-4 — plagindagi ikki `execSync`ni `execFile*`ga o'tkazish + Windows uchun zip yechishni yauzl/emirilgan kutubxonaga ko'chirish.
3. P0-5 — LS grant/clawback'ni order-id bilan idempotent qilish; P0-6 — consume→create orasiga catch-all refund.
4. P0-7 — 4 ta sirni rotatsiya qilish, `vwrap.mjs`ni tozalash, `.dockerignore` qo'shish.

**Launch'dan oldin:**
5. Platform token'ini sessionStorage'ga ko'chirish (studio patterni tayyor).
6. Mockup `_*.html`larni deploy'dan chiqarish; uch nusxa `js/`ni bitta build-manba qilish.
7. To'lov UX (P26: busy-state, `?checkout=success`) — daftarning o'zi "SHART" degan.
8. Kredit dvigateli atrofida minimal test to'plami (consume/refund/reset/quote) — race'lar qaytmasligi uchun.
9. SIGTERM handler (20 qator) + `render.yaml`ni o'chirish + `deploy-cloudrun.sh`ga migrate.
10. Egalik tomondagi ro'yxat (daftardan, hali ham dolzarb): LS LIVE + webhook, Resend DKIM, Sentry DSN, backup bucket versioning, Neon Launch plan, 2FA→ADMIN_REQUIRE_2FA, CMS'dagi eski narx-copy'ni qayta saqlash, katalogni to'ldirish (asosiy blok!).

**Launch'dan keyin:** accessibility bosqichi (focus-visible, aria, klaviatura), Redis rate-limit, per-akkaunt lockout, GDPR IP-purge job, god-fayllarni bo'lish, restore-drill.

---

*Eslatma: audit uchun vaqtincha yaratilgan `_to_delete/.ctsaas-src.tar.gz` faylini loyiha papkasidan o'chirib yuborishingiz mumkin.*
