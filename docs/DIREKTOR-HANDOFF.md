# DIREKTOR-HANDOFF — Loyiha Direktori (doimiy daftar)

> Bu fayl butun loyiha davomida yashaydi. Faqat ASOSIY narsa turadi: rol, ishlash uslubi,
> qat'iy qoidalar, JORIY holat, hujjatlar xaritasi. Batafsil tarix bu yerda EMAS — u batch
> md fayllarда, docs/PROJECT-STATUS.md'да va git tarixида. Daftar shishib ketmasin:
> "JORIY HOLAT" bo'limини YANGILAB tur (eski tafsilotни ko'chirib tashla, saqlama).
>
> **BU YERGA YOZILADI (faqat):** rol, ishlash uslubi, qat'iy qoidalar, hujjatlar xaritasi
> (o'zgармаса — tegилmайди) + "JORIY HOLAT" (3–6 qator, qayerга yetdik).
> **BU YERGA YOZILMAYDI:** har muammо/prompt matni, commit hash'lар, ildiz-sabab qaydlar,
> faza-bo'faza log, uzun tafsilot → bular **batch fayl** yoki `docs/SESSION-REPORT.md`'ga.
> Qoida: yangi holat kelса, eskиsини O'CHIR (ustiga yoz), qo'shib UZAYTIRMA. Butun fayl ~150 qator ичida qolsin.

---

## 1. ROL — Loyiha Direktori

Sen — o'zbek foydalanuvchi bilan **Claude Code** (alohida kod-agent) o'rtasidagi **Direktor**san.

- **Kod YOZMAYSAN.** Foydalanuvchining o'zbekcha xom g'oyasi/muammosini Claude Code uchun
  **TO'LIQ INGLIZ tilидаги, self-contained, one-shot** promptga aylantirasan: nima qilish,
  qaysi fayl, chegaralar, kutilgan natija, noaniqликда qanday qaror qilish.
- **Har prompt oxiri:** *"When finished: (a) commit with a clear concise message (no
  Co-Authored-By); do NOT push. (b) write a short summary."*
- **Foydalanuvchi bilan doim O'ZBEKCHA, sodda** (texnik bo'lmagan odam tushunadigan) gaplashasan.
  Code natijasini ham o'zbekcha, sodda tushuntirasan. FAQAT Code prompti inglizcha.
- **Proaktiv bo'l:** foydalanuvchi aytmagan muammolarни ham o'zing topib ogohlantir. Ortiqcha
  uzun tushuntirma berma — foydalanuvchi buni yoqtirmaydi (qisqa, aniq).

### Model tanlash (Code'ni qaysi modelда ishlatish)
- Oddiy / kичик / aniq (CSS, joylashuv, bitta fayl) → **Sonnet 5** (kunlik ish; Haiku EMAS).
- Murakkab / ko'p qatlamli / migratsiya / refactor / plagin+backend → **Fable 5 (+Extra/High)**.
- Fable 5 kodlaшда eng kuchli (SWE-Bench Pro 80.3% vs Opus 4.8 69.2%) lekin kvotani ~2x tez yeydi.
- Kvota tejash kerak bo'lsa → **Opus 4.8** yoki **Fable 5 Medium**.

---

## 2. ISHLASH USLUBI (asosiy oqim)

1. Foydalanuvchi jonli testда topgan muammoни o'zbekcha aytadi.
2. **Direktor AVVAL kodни o'zi ko'rib chiqadi** (Grep/Read bilan aniq fayl, element/selektor,
   ildiz-sababни topadi) — "ko'r-ko'rona" prompt yozmaydi. So'ng shu aniq diagnozga asoslanган
   to'liq inglizcha Code promptини **alohida batch md faylга** yozadi (aniq qator/selektor bilan).
   Muammolar daftарга (bu fayl) EMAS, **batch faylга** yoziladi.
3. Har batch faylда yuqorida **GLOBAL QOIDALAR** header bo'ladi (pastдаги 4-bo'limdan).
4. Foydalanuvchi har promptни Code'да ishlatadi, oradа `/clear` qiladi → har prompt **self-contained**.
5. Foydalanuvchi natijaни (screenshot / xulosa) ko'rib chiqadi, keyingисига o'tadi.
6. **PUSH'ни doim FOYDALANUVCHI qiladi** (GitHub Desktop). Direktor/Code hech qachon push qilmaydi.
7. Direktor Code natijаsини o'zbekcha sodda tushuntiradi, so'ng bu daftардаги "JORIY HOLAT"ни
   qisqa yangilaydi (faqat asosiy — qayerга yetdik; eski tafsilotни saqlamaydi).

**Prompt topshirish qoidasi:** Direktor har promptni foydalanuvchiga berganда (a) prompt OSTIDA
qaysi modelда ishlatishни aniq aytadi (Sonnet 5 / Fable 5 / Opus 4.8 — 1-bo'limdagi mezon bo'yicha),
(b) Code oldiда turgan ishни o'zbekча sodda 3-6 bandда tushuntiradi (foydalanuvchi nima kutishни bilsin).

**2 rejim** (foydalanuvchi tanlaydi):
- **Birma-bir:** har muammо kelганда darhol alohida prompt (tez, jonli test uchun).
- **Jamlash:** foydalanuvchi bir nechta muammoни ketma-ket aytadi → Direktor oxирида ularни
  bitta yoki bir necha promptга jamlab beradi (bir xil fayllar tegсa — samarali).

**Batch fayl:** bir "davra"/kun uchun bitta fayl — `docs/FIX-PROMPTS-BATCH<N>-<sana>.md`.
Yangi davra boshlанганда yangi fayl ochiladi (eskиси tarix bo'lib qoladi).
Batch fayl **TO'LIQ ingliz tilида** yoziladi (header, izoh, prompt — hammasi English).
Joriy aktiv: `docs/FIX-PROMPTS-SC-2026-07-16.md` (SC oqimi — plagin CMS + topilgan muammolar).

### Yangi chatда davom etish (kontekst tugаганда)
Foydalanuvchi yangi chat ochганда: bu faylни Claude'ga beradi → Claude **ROL (1-bo'lim)ни qabul
qiladi** → "JORIY HOLAT (5-bo'lim)дан davom et" deydi. Boshqa hech narsa kerak emas — bu daftar
+ hujjatлар xaritasi (6-bo'lim) yetarli.

---

## 3. LOYIHA (qisqa)

**FrameFlow** (eski nom AssetFlow). Repo: `~/Projects/creative-tools-saas`.
AE/Premiere shablon marketplace + AI generatsiya studiyasi.

**Zanjir:** Contributor shablon yuklaydi → Admin tasdiqlaydi → tasdiqlangan shablon AE plagin
katalogида chiqadi → obunachi AE ichида import qiladi (Free/Pro limit) → obunachi AE ичида
kredit bilan rasm/video/ovoz/SFX generatsiya qiladi (Studio Gen AI).

**Infra (haqiqiy):**
| Xizmat | URL |
|--------|-----|
| API (Cloud Run) | `api.getframeflow.app` |
| Web (CF Pages) | `getframeflow.app` |
| Storage | GCS · AI: Vertex · DB: Neon Postgres · To'lov: Lemon Squeezy (MoR) |

**Plagin:** `plugins/after-effects-cep/` (bitta HTML fayl ~792KB, bundle `com.frameflow`).
Server deploy'ga KIRMAYDI — AE ичига `install-cep.sh` bilan o'rnatiladi.

**Seed hisoblar:** admin@assetflow.uz / admin123 · dilnoza.k@gmail.com / contrib123 (contributor)
· user@assetflow.uz / user123 (obunachi).

---

## 4. QAT'IY QOIDALAR (HAR promptга tegishli — buzma)

- **PUL-ZONA BYTE-FOR-BYTE:** kredit consume/refund, imzolangan cost-quote va HMAC'i
  (`lib/gen-quote.ts`, `gen-models.ts` `computeGenCost`/`imageUnitCost`, `plugin-profile.ts`),
  webhook idempotentligi, har qanday kredit QIYMATI — HECH QACHON o'zgармайди. Fix shularга
  tegsa → TO'XTA va flag qil.
- **Migratsiya faqat additive** (yangi jadval/ustun; buzuvchi emas). `migrate:deploy` oqими.
- **English UI**; kod izohlari o'zbekcha.
- **Studio manba:** ROOT `packages/assetflow-studio/js|styles` (+ `admin/`, `contributor/` manba)
  ni edit → `npm run studio:sync`. `platform/index.html` = CF Pages TO'G'RIDAN manba (to'g'ridan edit).
  `studio/`, `admin/` artefaktларини HECH QACHON edit qilma. Landing (`ffl-`) ga tegma.
- **Plagin:** edit → `bash plugins/after-effects-cep/scripts/install-cep.sh` (USER AE restart).
  AE'да internet YO'Q (shrift self-host, inline SVG). `node --check` + DOM/handler bilan tasdiqla.
- **Commit** aniq xabar bilan, **`Co-Authored-By` YO'Q** (deploy bloklaydi). **PUSH QILMA.**
- **Minimal, tor diff.** Mavjudni qayta ishlat, regress qilma. Har prompt self-contained (`/clear`).
- **PLAGIN UI KONSTITUTSIYASI (2026-07-17, ega tasdig'i — HAR UI promptiga kiritiladi):**
  (1) bitta chrome — yagona top bar, ikkinchi to'liq bar taqiq; (2) karta yuzi = media +
  tur belgisi, qolgani hover/fokusda; (3) zona budjeti — doimiy ko'rinadigan boshqaruv
  ≤5, ortig'i bitta ⋯/disclosure ortida; (4) progressiv ochilish — funksiya O'ChMAYDI,
  ko'chadi; (5) faqat tema tokenlari, bitta spacing shkala; (6) narx/kredit doim ko'rinadi.
- **Referens (Artlist/Higgsfield) = ILHOM, 1:1 nusxa EMAS.** Naqsh/oqim/kayfiyat olinadi; kod,
  asset, piksel-klon TAQIQ. ⚠️ YANGILANDI (2026-07-12, USER so'rovnomasi): eski "lime accent
  saqlanadi" qoidasi BEKOR — USER hozirgi identikadan voz kechdi; yangi identika BATCH6'da
  tanlanadi (`docs/BATCH6-REDESIGN-BRIEF.md` — brif + so'rovnoma natijalari shu yerda).

---

## 5. JORIY HOLAT (2026-07-22)

> ✅ **TASK 2: PANEL SELF-UPDATER O'CHIRILDI → OS INSTALLER ZANJIRI (push/deploy YO'Q).**
> Avval panel yangilanishni o'zi o'rnatardi (zip → `unzip` → extension papkasi ustiga `cp -R`) —
> bu CEP'da ishonchsiz va butunlik majburiy tekshirilmasdi. Endi panel HECH NARSA o'rnatmaydi:
> OS aniqlanadi (**faqat** mac=`.pkg` · win=`.exe`/`.msi`), artefakt HTTPS'dan chegaralangan
> temp papkaga tushadi, **SHA-256 (64 hex) MAJBURIY** tekshiriladi, so'ng fayl argument-massiv
> bilan OS installeriga topshiriladi (`/usr/bin/open` · `msiexec /i`). Ishonch chegarasi = OS.
> Nosozlikda halol xabar + "Open download page" (papka almashtirish maslahati YO'Q).
> Poll / Later / English UI o'zgarmagan. `GET /api/plugin/version` endi
> `platform=` oladi va FAQAT o'sha platformaning installerini beradi (storage kaliti chiqmaydi);
> admin publish SHA-256'ni storage'dan QAYTA hisoblab solishtiradi. Additive migratsiya:
> `PluginInstaller` + `downloadKey` nullable. Kontrakt: **`docs/PLUGIN-UPDATE-CHAIN.md`**.
>
> **Direktor auditi bo'yicha tuzatildi (o'sha kun, alohida commit):**
> (1) **Legacy kill switch** — legacy `.zxp` `downloadUrl` endi FAQAT `manual=1` opt-in bilan
> qaytariladi; param'siz (ya'ni ESKI o'rnatilgan panelning so'rov shakli) → `null`, ya'ni eski
> klient kelajakdagi relizda ham o'z-o'zini yoza olmaydi. Veb yuklab olish tugmasi opt-in'ni
> aniq yuboradi. (2) **Strict yuklovchi** — umumiy `downloadUrlToFile`ga orqaga-mos `opts`
> (`httpsOnly`+`maxBytes`); updater https→http downgrade'ni rad etadi va 512 MiB'dan oshgan
> oqimni darhol uzadi (pack import xulqi o'zgarmagan). (3) **Imkonsiz majburiy yangilanish
> QOPQON EMAS** — yaroqli installer bo'lmasa mandatory dialog yopiladi (yaroqli installerda
> bloklash saqlanadi). (4) **"Installer opened" faqat `spawn` dan keyin**, xatoda temp tozalanadi.
> ✅ **TASK 3 (KOD) BAJARILDI — installer artefakt quvuri.** Panel kutayotgan artefaktlar endi
> haqiqatan quriladi: macOS `.pkg` (`pkgbuild`+`productbuild`) va Windows `.msi` (WiX v5),
> ikkalasi ham FAQAT foydalanuvchi papkasiga yozadi (`auth="none"` / `Scope="perUser"` —
> administrator/UAC so'ralmaydi) va payload AYNAN mijoz flavor ro'yxati (`package-flavors.mjs`);
> ichki Admin paneli kod darajasida rad etiladi. Imzolash FAIL-CLOSED: kredensiallar faqat
> env'dan, qisman bo'lsa ham to'xtaydi, self-signed/standart parol yo'q, nosozlikda na artefakt
> na temp qoladi. Har artefakt yoniga `.sha256` + reliz manifesti chiqadi (admin publish server
> tomonda qayta hisoblab solishtiradi). `npm run test:plugin-installers` **160/160**.
> Buyruqlar: **`docs/RELEASE-ARCHITECTURE.md` §3A**.
> 🔴 **Bloker (EGA, kod EMAS):** Apple Developer ID Installer sertifikati + notarizatsiya
> kredensiali, Windows Authenticode (EV) sertifikati/token, Windows mashinasi yoki
> `windows-latest` CI (`dotnet tool install --global wix`).
> 🔴 **Ega ishi (o'zgarmadi):** `PluginRelease` jadvalida hali reliz yo'q → prod'da download
> tugmasi halol "beta hali chiqmagan" deydi.

## 5a. OLDINGI HOLAT (2026-07-21) — qisqacha

> ✅ **Reliz xavfsizligi:** mijoz plagini ↔ ichki Admin AJRATILDI — 2 flavor (**customer**
> `com.frameflow.panel` default · **admin** `com.frameflow.admin` ICHKI), yagona manba
> `scripts/package-flavors.mjs`; `--disable-web-security` ikkala manifestdan olib tashlandi
> (backend CORS/auth TEGILMAGAN); ZXP imzolash **fail-closed** (`ZXP_CERT`+`ZXP_CERT_PASS` shart,
> self-signed/qattiq parol o'chirilgan, nosozlikda artefakt qolmaydi); `install-cep.sh` default =
> faqat mijoz. Test `test-package-security.mjs` 47/47 (haqiqiy build + negativ fiksturalar).
> Batafsil: **`docs/RELEASE-ARCHITECTURE.md`**.

> Oldingi tugagan ishlar (dependency security, Launch Task A/B, R4, BATCH oqimi, MUAMMOLAR 1/2)
> shu daftarda TAKRORLANMAYDI — tafsilot: `docs/SESSION-REPORT.md`, `docs/FIX-PROMPTS-*.md`,
> 5b-bo'lim va git tarixi.


### 🔴 QOLDI (ega ishi, kod EMAS)
Marja **2×** (hozir 1.2× — zarar!) · **Neon → Launch reja** (bepul 100 soat tugasa sayt o'ladi) ·
Sentry DSN · Neon parol rotatsiya · suv belgisi backfill · GCS lifecycle · **KONTENT** (katalogda 2 asset,
landing "5000+" deydi) · legal/email/Turnstile/LS-LIVE.

### ⚠️ Ochiq risk
Qidiruv **indekssiz ILIKE** — 5000'da 5 ms, lekin chiziqli. ~15-20k'dan keyin `pg_trgm` kerak.

---

## 5b. ESKI HOLAT (BATCH oqimi, 2026-07-10..12)

- ✅ **Butun mahsulot qurilgan:** kontent quvuri (F1–F6) · hardening/launch-readiness fazalari ·
  login/2FA/3-portal · ingliz-tarjima · QA-FIX 16 + BATCH2 21 · Site/Landing CMS · Artlist web
  redesign (A/B/C/D) · plagin redesign · admin redesign port (qisman) · Lemon Squeezy integratsiya.
- ✅ **BATCH3 TUGADI (13/13, 18 commit, PUSH YO'Q):** #10 Stock **S1** (upload kind-picker + `kind`/
  `stockType`/`templateType` + migratsiya) · #3 templates pill+filter · #11/#12/#13/#14 = Direktor-audit
  §D/§B/§A/§C tuzatishlari · #1/#5/#6/#7/#8 AI Studio composer (Artlist-ilhom) · #2 admin gen preview ·
  #9 plagin My Library ref. Pul-zona byte-for-byte; 2 additive migratsiya (`stock_kind_columns`,
  `plan_config_active`). Batafsil: batch fayl + `docs/DIREKTOR-AUDIT-2026-07-10.md`.
- ✅ **BATCH4 TUGADI (4/4, 11 commit, PUSH YO'Q, migratsiya YO'Q, pul-zona diff'siz):** #1 rasm Upscale
  (Vertex `imagegeneration@002` — ✦4/✦8) · #2 video Upscale (fal Topaz, tier ✦/s, server ffprobe imzoда) ·
  #4 ovoz Kokoro/OpenRouter → **Chirp 3 HD** (Cloud TTS, jonli ishladi; 0 enabled OpenRouter) · #3 **narx
  dvigateli** ("Apply 2× margin" tugma + enabled-only + sarf-chegараси). Kredit langari $0.019 (Pro 1000).
- ✅ **PUSH+DEPLOY TASDIQLANDI (2026-07-11, Direktor jonli tekshiruvi):** git 0 ahead/clean; prod
  `/health` ok (db+storage); katalog `kind`/`stockType` qaytaryapti → BATCH3 kod+migratsiya jonli;
  API boot bo'lgan → `COST_QUOTE_SECRET` o'rnatilgan; legal sahifalar LS; attestation server-enforce;
  bundle `com.frameflow`. ⚠️ Tashqaridan tekshirib BO'LMADI: **Apply target margin bosilganmi** (Admin →
  Pricing'da tasdiqla — Seedance 4k Apply'gача zararда!) · AE plagin jonli test · SENTRY/BACKUP/
  MODERATION/LS-LIVE env'lар prod'да o'rnatilganmi.
- 🔴 **ENG KATTA BLOKER — KONTENT:** prod katalogда FAQAT 1 shablon published (landing esa "5000+"
  deydi — nomuvofiqlik). Launch'дан oldин katalog to'ldirish yoki landing raqamlarини moslash SHART.
- 👉 **KEYINGI:** Stock **S2** (ingest quvuri) — `docs/STOCK-EXPANSION-PLAN.md` (S2→S6 hali yozilmagan).
- 🚧 **AKTIV — BytePlus/Seedance migratsiya** (`docs/FIX-PROMPTS-BATCH5-2026-07-11.md` + API sxema:
  `docs/BYTEPLUS-DOCS-MODELS.md` TO'LIQ tasdiqlangan): USER hisob ochdi, ModelArk ishlaydi, narx
  2-3.3× arzon. **USER QARORI: Seedance FAQAT BytePlus — fal-fallback YO'Q** (fal qimmat); yuzli
  referens → aniq xato + refund (BytePlus real yuzni bloklaydi; keyingi faza: Seedream zanjiri
  AI-yuzni ochadi). **Topaz 3201 fal'да QOLADI.** ⚠️ Seedance aktivatsiya = prepaid resource pack
  SHART (bepul token yo'q). Scope kengaydi: **video (Prompt #1) + RASM Seedream (Prompt #2)** —
  plagin+web ikkalasi bitta katalogdan avtomatik oladi; Vertex rasm modellari parallel qoladi.
  Region: **Johor (ap-southeast-1)** — Dublin EMAS (API key ham shu regionда).
  ✅ Bosqich 0 TUGADI (2026-07-11): pack olindi ($30.10, 7M token, 90 kun!) · Dreamina-Seedance-2.0
  + Dola-Seedream-5.0-Pro AKTIV (5.0-lite: 50 bepul rasm — activate qilinsin) · API key lokal .env'да.
  Eslatma: bulk-activate oynasi ishlamaydi (mini pack yo'q) — har modelni QATORIDAN yakka activate.
  ✅ **Prompt #1 BAJARILDI** (commit 17ece57, push YO'Q): byteplus.ts adapter · 3102→BytePlus
  ("Seedance 2.0" nom) · 3101 Fast disabled (pack yo'q) · JONLI TEST PASS (t2v 480p/4s, 70s,
  40,594 token — formula mos, pack'дан ≈$0.17). Token sarfida multiplier YO'Q — $4.30/1M pack
  narxi amal qiladi, jadval to'g'ri (birinchi invoice bilan yakuniy tasdiq).
  ✅ **Prompt #2 BAJARILDI** (commit 06f7bc7): byteplusImage() · 1020 Seedream 5.0 Lite
  (enabled:false — narx tasdiqlanmagan) · 1021 Seedream 5.0 Pro (enabled:true, 1K $0.045/2K $0.09) ·
  jonli test PASS ikkalasida (Lite 2K 32s / Pro 1K 115s, GCS'га tushdi). ⚠️ Lite'ni yoqish = kod
  o'zgarishi (admin toggle /gen gate'га ta'sir qilmaydi) — Lite rasmiy narxi topilгач.
  ✅ **Prompt #4 BAJARILDI:** rewriteMentionTokens (kadr-OFFSET fix: @img1+start-frame→"Image 2",
  BytePlus frame'ларни ham sanaydi!) + 12-case build-test + edit-preset chiplari (Replace/Edit/
  Inpaint, ikkala composer, SD2-EDIT-PRESETS marker bilan qo'lda sync).
  ✅ **BATCH5 KOD TO'LIQ TUGADI** — #1 adapter (17ece57) · #2 Seedream (06f7bc7) · #4 mention+preset ·
  #5 start/end kadr (c6abc9f) · #7 nisbat/piksel (96ab7c5) · #6 Dreamina pill-editor (34114f4).
  Faqat #3 cleanup qoldi (prod'да 1-2 hafta barqarorlikdan keyin). ⚠️ PROBLEM 3 kuchda: Seedance 2.0
  plaginда ko'rinmaydi (web-only) — ochish alohida qaror. 👉 **HOZIR: USER push** (7+ commit) →
  Actions deploy → WEB jonli E2E checklist: Seedance 2.0 video (kadr+@pill+preset chip) · Seedream
  ✅ **BATCH5 RASMAN YOPILDI (2026-07-12):** push+deploy OK · Apply target margin BOSILDI ·
  **web E2E PASS** (USER tasdig'i: Seedream nisbat, Seedance kadr, @ pill, preset-chiplar, video
  generatsiya — hammasi ishladi). Qoldiq: Fast pack (xohlaganda) · #3 cleanup (1-2 hafta keyin).
- 🚧 **BATCH6 — Higgsfield-ilhom redizayn** (`docs/BATCH6-REDESIGN-BRIEF.md` + promptlar:
  `docs/FIX-PROMPTS-BATCH6-2026-07-12.md`): ✅ Prompt #0 TUGADI (916c148) — TO'LIQ-sayt mockup
  `docs/mockups/batch6/index.html`: ✅ Prompt #0.5 vizual QA ham TUGADI (63b46dd) —
  **46 ekran × 3 tema (noir/neon/cold)**, real katalog verifikatsiya, kritik buglar tuzatilgan
  (qora katalog / ko'rinmas kompozer / footer), 25+ hover, 3 temada skrinshot-tasdiq.
  ✅ **USER QARORLARI:** 3 tema HAMMA JOYDA foydalanuvchi tanlovida · **default = A NOIR** ·
  token-first majburiy (hardcode rang = defekt, har prompt 3-temada tekshiriladi).
  ✅ Prompt #1 BAJARILDI (b216fab): PRODUCTION'да 3-tema tokenlar + compat-shim (lime→theme,
  hech narsa buzilmadi) + Space Grotesk/Inter/JetBrains Mono + nav/footer yangi chrome + tema-
  tanlagich (localStorage ff-theme, FOUC'siz). Qoldiq: 103 bo'lim-lime literal (keyingi
  promptlar hal qiladi) · mega-menyu Home promptiда · footer 4-ustun = CMS qarori.
  ✅ Prompt #2 (50ff85c) Home/landing 1:1 + mega-menyu, landing lime 103→0.
  ✅ Prompt #3 (c3b9cab) Templates katalog+detal+Pro-gate 1:1 (hero+⌘K qidiruv, All-pill, yopishqoq
  toolbar, player-bar, spec-list, inline gate→#pricing); scope lime 5→0; 1-element/empty holatlar halol.
  ✅ Prompt #4 (90a4971+6ffca7b): Dashboard+Projects+Credit-modal 1:1; app yuzasida 65 lime literal→
  token (3 tema ilova ichida ham to'g'ri); Sparky mascot tema-mos; BATCH5 chip-editor TEKSHIRILDI sog'.
  ⚠️ Kompozer/model-picker/history: tema-mos lekin 1:1 tasdiq REAL data bilan qilinmadi (lokal backend
  yo'q) — USER jonli saytда ko'radi, kamchilik chiqsa #4c mini-prompt.
  ✅ Prompt #5 (eee5b68): Auth+Account 1:1 — in-app auth split-layout (media-art+quote) ·
  account-head kicker+underline tabs · REAL kontent (250/600/1800, Studio 3000, ledger refund) ·
  standalone reset/verify/device sahifalari tema-tizim oldi · lime→0. ⚠️ `login.html` = Contributor
  konsoli — TEGILMADI (USER logini in-app; kontributor konsol reskini = alohida qaror).
  ✅ **Prompt #6 BAJARILDI (2026-07-14, commit 1d9c729) = BATCH6 YAKUNLANDI.** Pricing 1:1
  (REAL CMS narxlar: Free $0/50 · Pro $19/1000 · Studio $59/3000 — mockupdagi eskirgan
  matn ishlatilmadi) · Plugin sahifa 1:1 · help/terms/privacy/refund/dmca 3-tema token +
  nav/footer chrome · `#C2F04A` literal = 0 hamma joyda (`var(--lime)` 176 saqlangan) ·
  3 tema × 5 sahifa skrinshot-tasdiq. Eslatma: auto-commit hook 3 ta hujjat faylini (handoff,
  FIX-PROMPTS-BATCH6/8) shu commitga qo'shib yuborgan — zararsiz.
  ⚠️ Repo'да aralash unpushed commitlar (MUAMMOLAR 3 + BATCH6 + V2 boshlanishi) — push
  hammasini birga chiqaradi.
  👉 KEYINGI: **USER PUSH + jonli ko'rik** → V2-EASY combined (endi platform/index.html
  TOZA — BATCH6 guard to'sig'i yo'q) → BATCH7 CMS → BATCH8 plagin (#0-R mockup TAYYOR;
  USER 2026-07-15: **Dashboard B = default Home** + **1:1 web-parity QAT'IY talab**;
  ✅ #0.5 BAJARILDI (ecc1364): Pro-gate + gen-progress pane + 820/620/500 balandlik + popover
  polish; LEKIN parity'да 3 xato — Code BATCH6 maketни haqiqat deb oldi (Improve/modal-matn/
  chip-shakl production'дан farqli). 🔴 QOIDA: maket vs production farq qilsa —
  **production (`platform/index.html`) yutadi**. Port 2 promptда (SKIN ONLY, Fable 5 High).
  ✅ **PORT 1/2 BAJARILDI (584e6a1, push YO'Q):** mockup-fix + noir/neon/cold tokenlar
  (legacy-token alias'lar bilan — eski panellar buzilmaydi) + Space Grotesk/Inter/JetBrains
  lokal (12 woff2) + Dashboard B (real hook'lар: hmList/homeGo/kredit) + auth/device-code +
  install-cep.sh FIX (shriftlar hech qachon ko'chirilmasdi!).
  ✅ **PORT 2/2 BAJARILDI (34636f6, push YO'Q) = BATCH8 KOD TUGADI.** Asosiy topilma:
  plagin avvalgi batch'lардан allaqachon skin'langan ekan — qolgan ish: 30+ hardcode lime
  literal → tema-token (noir/cold'да lime oqishi tuzatildi) + "Enhance · ✦1" + "Choose a
  model" matnlari. 41-qatorlik 1:1 diff, mantiq/pul-zona tegilmagan, 7 inline script
  node--check OK. ⚠️ Deferred: model-sheet qidiruvi (xatti-harakat o'zgarishi = SKIN-ONLY
  taqiq — alohida qaror) · gen-progress kartalari offline tekshirib bo'lmadi (jonli testda).
  ✅ **Prompt #3 ham BAJARILDI (70ab4d4):** model-sheet qidiruvi (sanktsiyalangan kichik
  xatti-harakat) + app-bar maket anatomiyasi (brend + kontekst-label, id/handler'lар
  saqlangan). **PUSH BO'LDI** — origin/main = 70ab4d4. Seedance-plaginda-ochish = alohida
  mahsulot qarori (ochiq). 👉 QOLDI: **USER AE to'liq restart (⌘Q) + JONLI TEST**
  (login + Dashboard B + ↻ Sync + 1 generatsiya [progress kartasi!] + 1 import + 3 tema +
  model qidiruv). Solishtirish: `docs/mockups/batch8-plugin/compare.html`).
  🔴 **JONLI TEST NATIJASI (2026-07-16): USER skin-portni RAD ETDI** — tuzilish eski
  (launcher, karta-composer), maket bilan 1:1 emas. **USER QARORI: "faqat skin" (variant B)
  BEKOR → STRUKTURAVIY 1:1, xatti-harakat saqlanadi.** Reja: **#R1** (AI Studio workspace:
  launcher o'chadi, sessiya-lenta + dok-composer + mockup natija-kartalari) → USER jonli
  test → **#R2** (Browse/Library/Settings/States/Auth + eski qoldiqlar). Ikkalasi batch
  faylда tayyor (Fable 5 High). Feature-survival ro'yxati to'liq kuchda.
  ✅ **#R1 BAJARILDI (4e15e04, push YO'Q):** AI Studio 3 view (image/video/audio) mockup
  workspace anatomiyasiga qayta qurildi — sessiya-lenta + viewbar + stage + dok-composer;
  hamma id/handler saqlangan (rewire, rewrite EMAS), `.axws` scoped CSS. Kalta panel ≤560px
  = butun workspace scroll (Generate hech qachon kesilmaydi). ⚠️ #R2'ga qoldi: Upscale
  source-first composer (hozir halol toast) · Browse/Library/Settings/States/Auth tuzilishi.
  🔴 #R1 jonli AE'да BUZILDI (prompt ko'rinmas, layout rasvo) — #R1 QA sun'iy overlay'да
  o'tgan edi. ✅ **#R1-FIX BAJARILDI (b078d70):** 2 ildiz-sabab: (1) balandlik zanjiri
  cheklanmagan → composer fold'дан 1.5 ekran pastда; (2) chip-editor CSS `.pbox` scope'да
  qolib, ko'chirilgan promptга umuman uslub tegmagan (ko'rinmas 22px). 21-qator fix:
  #aiPage.axws-tool height:100% zanjiri + overflow-y:auto degradatsiya + .axws-promptwrap
  chipedit uslublari + Generate ichida cost-tag qaytarildi. In-place matritsa PASS.
  🔴 **USER QARORI (2026-07-16): STRATEGIYA O'ZGARDI — TAB-MA-TAB QAYTA QURISH.**
  Plagin UX/UI holati yomon; eski plagin ko'rinishi ENDI DIZAYN MANBASI EMAS. Direktor
  dizayner sifatida har tab uchun to'liq spetsifikatsiya yozadi (asos: tuzatilgan BATCH8
  mockup + production tokenlar), Code yangi namespace'да noldan quradi, USER har tabни
  ko'rib tasdiqlaydi, keyin keyingisiga o'tiladi. Tartib: **HOME (#H1)** → USER ko'rigi →
  keyingi tab (AI Studio / Catalog / Library / Settings). #R2 muzlatildi (bekor emas,
  strategiya almashdi).
  🔎 **DIREKTOR JONLI AUDIT (2026-07-16, computer-use bilan AE ichida, panel ≈345px):**
  HOME: chap-kesik (kritik layout bug) · balans 2x · hero dekorlari media ustida · kulrang
  CTA · tokcha meta xato. AI: pill'lar "MODEL V."/"OUT 16:..." gacha qisqargan · 6 boshqaruv
  1 qatorda · sessiya=xom prompt matn · audio bo'sh karta · app-bar yo'q (3 xil header).
  LIBRARY: har kartada 6 belgisiz ikonka · bo'sh placeholder'lar · yuklanish=qora ekran.
  CATALOG: har kartada Re-import tugma · pastda 2 texnik bar (build hash ko'rinadi) ·
  340px'da 3 ustun. YAXShI: Account sheet, tema tizimi, umumiy noir baza. #H1 prompt shu
  audit asosida qayta yozildi (6 defekt, Fable 5 Medium) — USER'ga berildi.
  🔴 **USER #H1'ni ham RAD ETDI — "eski plaginni yamash emas, YANGI dizayn kerak".**
  Direktor chuqur so'rovnoma o'tkazdi (3 bosqich). ✅ **YANGI STRUKTURA TASDIQLANDI
  (2026-07-16, USER so'rovnoma javoblari):** yagona tepa panel, 4 tab **Home · AI ·
  Stock · Ishlarim**; HOME = banner + so'nggi ishlar + shablon tanlovi (prompt YO'Q);
  AI = composer (rejim prompt yonida) + sessiya/Projects TO'LIQ qoladi + gen FONDA
  (erkin yurish, tugaganda xabar); ISHLARIM = AI ishlar + yuklab olganlar BIRGA
  (filtr + Projects + bulk); hisob/kredit/top-up/tema — BITTA avatar oynasida;
  texnik barlar Account ichiga. Eski launcher/marketing-Home/3xil header O'CHADI.
  ✅ **DIZAYN-USLUB HAM TASDIQLANDI (so'rovnoma):** referens = Higgsfield + Artlist/
  Frame.io · rang muhiti = DARK asosiy + LIGHT tanlov · aksent = BITTA rang: MOVIY-OSMON
  (sky blue, lime BEKOR) · zichlik = HAVODOR (katta bo'shliq, yirik element) · sarlavha =
  geometrik-zamonaviy (Space Grotesk qoladi). Eski #H1/#R2 promptlari BEKOR (eski strukturaga edi).
  ✅ **YANGI #H1 BAJARILDI (9448382, PUSH BO'LDI — origin/main=9448382):** Home tab clean-room
  `.fhome` (Direktor spec 1:1) — jonli model narxlari (`/gen/models`), real-katalog javoni
  (fallback yo'q), QA: 3 tema × 320/420/600 × 820/620/500 PASS, install-cep.sh bajarilgan.
  🆕 **R4 DAVRA (2026-07-20):** `docs/FIX-PROMPTS-R4-2026-07-20.md`.
  ✅ **R4_01 (f74c7ee):** Seedance 2.0 Mini (3103) — aktiv, e2e tasdiqlangan.
  ✅ **R4_02 (a7dd487):** Kling 3.0 to'g'ridan-API — YANGI provayder `kling.ts`; 5 model
  (3004 t2v/3005 Turbo/3008 Omni-video/1030 Image/1031 Image-Omni), 5/5 e2e tasdiqlangan,
  R2'ga tushdi. Eski fal placeholder 3004/3005 haqiqiy Kling bilan almashtirildi.
  ✅ **R4_03 (10f2d07):** Topaz POYDEVOR — `topaz.ts` adapter + dormant provayder yo'llari,
  0 model / 0 UI / pul-zona daxlsiz. Probe: auth PASS · 46 supportedModels · video-create
  PASS · 🔴 rasm 412 "No valid subscription" (EGA: Topaz obuna kerak). Manba:
  `docs/TOPAZ-API-NOTES.md` + `docs/topaz/*.yaml`.
  ✅ **R4_07 (5e4197d):** Topaz OPERATSIYA katalogi (composer modeli EMAS, opType-filtrli) —
  5001 Upscale Video (Proteus) ✅ · 5002 Upscale Image (Gigapixel) ✅ · 5003 RemoveBG ❌
  (Topaz'da 3/3 Failed — EGA: Topaz planда Matting/BG yoqilsin, kod tayyor). Narx marja
  qoidasi + `TOPAZ_USD_PER_CREDIT` env. Pul-zona daxlsiz, boot floor PASS.
  ✅ **R4_05 (d5a5eb6):** o'lchangan xarajat marja/panelga ulandi — Seedream Lite/4.5
  narx $0.50→$0.0705, marja **−229%→+54%**. Xavfsizlik: BytePlus rasm token→USD invoys
  bilan tasdiqlanmagan → o'lchov faqat video + jadvalsiz rasm(Lite/4.5)da ishlatiladi,
  tasdiqlangan jadvalni pasaytirmaydi. Control (Nano Banana) o'zgarmagan, floor PASS.
  ✅ **R4_06 (fd4a7ef):** Pricing panelда measured/table/estimate belgilar + "Measure cost"
  tugma (jonli probe) + "Measure all missing" + "cost rose" tasdiq-gate.
  ✅ **R4_08 (65331b5):** gen/library kartada bir-klik **Use ▸ Upscale** (plagin+web) —
  yangi `GET /gen/ops`. Gigapixel rasm E2E ishladi (✦11→done→R2). Topaz nihoyat userда.
  ✅ **R4_04 (4520fcb):** Google real-yuz rad etilishi → toza xabar (xom JSON yo'q) +
  real-yuz modeli taklifi (Omni→Seedance Fast); bad-params 400 over-match yo'q.
  🟢 **R4 DAVRA TUGADI — hammasi origin/main'da (e1aa2f5).** Topaz bir-klik: Gigapixel rasm
  + Proteus video 2×/4× yoqilgan; RemoveBG entitlement kutmoqda.
  🔑 EGA: (1) Topaz Matting/BG yoqilsin → 5003 enabled · (2) Seedream rasm narxini haqiqiy
  invoysga solishtir · (3) "Measure cost" faqat BytePlus (token); boshqalar jadvaldan.
  🔑 EGA: Topaz obuna aktivlashtirish · narxlarni 1-invoysdan keyin admin Apply-margin ·
  probe skriptlar qayta ishlatiladi (probe-kling/topaz/byteplus, e2e-gen-once).
  ✅ **SC-3 DAVRA TUGADI (2026-07-17): 13/13 (SC_41B–SC_53), 13 commit, PUSH YO'Q** —
  `docs/FIX-PROMPTS-SC3-2026-07-17.md` + `docs/SESSION-REPORT.md` (13-model PASS jadvali).
  Bo'sh-ekranlar o'chdi · Favorites olib tashlandi (backend jadval tegilmagan) · yagona
  chrome · ovoz pikeri · composer 3-qatorli anatomiya + ikonkali sig'im · sessiya/karta
  ochilishida chaqnash yo'q · Home 3→6 zona + admin New/Top rail (`home.rails` sxema) ·
  My Library masonry + Use ichida · web katalog fluid · motion tizimi.
  👉 QOLDIQ (EGA/keyingi davra): SC_50 Explore zonasi + CMS sarlavhalar + kategoriya
  sonlari · SC_52 web rail pariteti + admin drag-tartiblash · SC_49 prod favorites
  ma'lumot qarori · deploy (push → API → wrangler → CF Pages → migratsiya) → AE E2E.
  ✅ **SC-2 DAVRA TUGADI (2026-07-17): 16/16 (SC_25–SC_40), har biriga commit, PUSH
  qisman** — `docs/FIX-PROMPTS-SC2-2026-07-17.md` + jamlama `docs/SESSION-REPORT.md`
  (SC_30 amal-matritsasi + SC_27 13-model PASS jadvali shu yerda). Asosiylari: sessiya
  scoping/rename · Use ▾ amallari · bulk delete · qidiruv · CMS zanjiri (prod media =
  worker redeploy!) · auth audit · per-model payloadlar · to'liq-panel + jonli resize ·
  konstitutsiya passi · −34KB o'lik kod. 👉 EGA: (1) `wrangler deploy` cdn-proxy —
  prod CMS media shuni kutyapti · (2) push + API deploy (rename PATCH ham) · (3) bucket
  CORS (dev presign) · (4) jonli AE E2E (⌘Q: resize, CMS 5daq, har rejim 1 gen, Import,
  rename, bulk delete, search, sign-out/in). Plagin UI Konstitutsiyasi 4-bo'limda.
  ✅ **SC OQIMI TUGADI (2026-07-17): 23/23 bajarildi, 23 commit, PUSH YO'Q** —
  `docs/FIX-PROMPTS-SC-2026-07-16.md` + `docs/SESSION-REPORT.md`. Asosiylari: Plugin CMS
  (backend+admin+plagin wiring, `landing/` CDN 403 bug fix) · doimiy markaziy 3-tab seg ·
  History→My Library · session picker + toza nomlar · Upscale butunlay o'chirildi
  (pul-zona tegilmagan, cost-quote toza 400) · fon-generatsiya + toast · Home redesign
  jonlandi · katalog karta/detal/grid · composer + chip fix · compact/microcopy/skeleton
  sweep'lar. 👉 KEYINGI (EGA): push → API deploy → `wrangler deploy` (cdn-proxy) →
  CF Pages → prod migratsiya `plugin_content_config` → AE ⌘Q + jonli E2E (CMS edit→5daq
  plagin · gen→toast · import). Qo'lda: landing megamenyuda "Video Upscale · Topaz" qatori
  qoldi (ffl- scope tashqarisi edi). Web account compact — xohlasa alohida.
- ⏳ **Deferred:** headless admin E2E · BATCH5 Prompt #3 (fal Seedance cleanup — prod'да 1-2 hafta
  barqarorlikdan KEYIN) · **BATCH7 = Site CMS kengaytmasi** (BATCH6'dan KEYIN: help/legal(versiyali)/
  promo-strip/SEO-OG/ticker/cinema/presets/mega-model-ro'yxat admin'дан; page-builder EMAS) ·
  **BATCH8 = AE plagin redizayni web'ga moslash** (USER niyati 2026-07-12: BATCH6 tokenlar/naqshlar
  plaginга ko'chiriladi — 3 tema + Higgsfield-uslub composer; BATCH7'dan keyin).

---

## 6. HUJJATLAR XARITASI (tarix va tafsilot shu yerда)

**MUAMMOLAR oqimi (2026-07-12/13 — parallel direktor, TUGADI):**
- `docs/MUAMMOLAR-1-POYDEVOR-PUL-MIQYOS.md` — 30 muammoning yarmi: infra · pul · miqyos · xavfsizlik.
  **Boshida STATUS + A→J bo'laklar jadvali.** ⚠️ `P7.CDN` bo'limi — bucket'ni ochish PULLIK PACK'LARNI
  SIZDIRADI (Worker yechimi shu sabab).
- `docs/MUAMMOLAR-2-MAHSULOT.md` — AI Studio · kompozer · katalog · kontent quvuri · AI Stock.
  ⚠️ `P30` — **DIREKTOR QARORI: provayder xavfsizlik filtrini chetlab o'tish uchun hech narsa
  qurilmaydi** (hisob yopiladi). `P13` — referens hovuzi (qayta raqamlash = jimgina buzilish).
- `docs/PERF-BASELINE.md` — 50/500/5000 asset o'lchov raqamlari.
- `workers/cdn-proxy/README.md` — CDN Worker deploy.

- `docs/PROJECT-STATUS.md` — loyiha JORIY holatining yagona kod-tasdiqланган manbai.
- `docs/FIX-PROMPTS-BATCH3-2026-07-10.md` — **aktiv** fix promptlar.
- `docs/FIX-PROMPTS-2026-07-09.md` (16) · `docs/FIX-PROMPTS-BATCH2-2026-07-09.md` (21) — bajarилган batchlar.
- `docs/QA-FIX-PLAN.md` — 16-muammo QA rejasi (partiyalar tugagan).
- `docs/LAUNCH-READINESS.md` · `docs/THREAT-REGISTER.md` · `docs/HARDENING-FAZALAR.md` — audit/hardening.
- `docs/KONTENT-QUVURI-SXEMA.md` — kontent modeli (F1–F6).
- `docs/COMPOSER-MECHANISM-ANALYSIS.md` — Mister Horse mexanizm tahlili.
- `docs/FAL-*.md` — fal.ai migratsiya referenslari.
- `docs/SESSION-REPORT.md` — oxirги sessiya hisoboti.

---

## 7. FOYDALANUVCHI TASHQI LAUNCH QADAMLARI (kod EMAS — checklist)

Bular Code emas, foydalanuvchi o'zi qiladi (prod'да pulли ishga tushишдан oldin):

- `COST_QUOTE_SECRET` o'rnat (yo'q bo'lsa API boot bo'lmaydi) · `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false`
- `PAYOUT_MODE` / `CONTRIBUTOR_POOL_SHARE` qaror · `SENTRY_DSN` (+ `npm i @sentry/node`)
- Backup bucket + versioning (`BACKUP_GCS_BUCKET`) · sir rotatsiya
- Turnstile kalitlari · Resend domen+DKIM/SPF+`EMAIL_FROM` (yo'q bo'lsa register/kredit fail-closed blok)
- `MODERATION_API_KEY` · `VIRUSTOTAL_API_KEY` · `MODERATION_MODERATE_OUTPUTS`
- Lemon Squeezy identity → LIVE · webhook qo'sh · `LEMONSQUEEZY_STORE_ID` + `LEMONSQUEEZY_WEBHOOK_SECRET`
- GCS `incoming/` CORS + 7-kun lifecycle · Cloud Run `--timeout=900`
- 2FA enrol → keyin `ADMIN_REQUIRE_2FA` · yurist legal ko'rigi · katalog kontent to'ldirish
- Eski buzuq shablonlarни QAYTA yuklash (asl zip o'chgan — P7)
