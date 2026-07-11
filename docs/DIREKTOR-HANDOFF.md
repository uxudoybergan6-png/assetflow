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

**2 rejim** (foydalanuvchi tanlaydi):
- **Birma-bir:** har muammо kelганда darhol alohida prompt (tez, jonli test uchun).
- **Jamlash:** foydalanuvchi bir nechta muammoни ketma-ket aytadi → Direktor oxирида ularни
  bitta yoki bir necha promptга jamlab beradi (bir xil fayllar tegсa — samarali).

**Batch fayl:** bir "davra"/kun uchun bitta fayl — `docs/FIX-PROMPTS-BATCH<N>-<sana>.md`.
Yangi davra boshlанганда yangi fayl ochiladi (eskиси tarix bo'lib qoladi).
Batch fayl **TO'LIQ ingliz tilида** yoziladi (header, izoh, prompt — hammasi English).
Joriy aktiv: `docs/FIX-PROMPTS-BATCH3-2026-07-10.md`.

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
- **Artlist = ILHOM, 1:1 nusxa EMAS.** Artlist (yoki boshqa referens) UX/pattern'idan g'oya olamiz, lekin
  FrameFlow o'z identikligини (lime accent, qora tokenlar, mavjud komponentlar) saqlaydi — piksel/rang
  nusxa qilinmaydi. Maqsad: FrameFlow'ning o'z xatolarини tuzatish, ilhomlanган holda.

---

## 5. JORIY HOLAT (2026-07-10)

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
- ⏳ **Deferred:** web @-mention autocomplete · atomik chip editor · headless admin E2E.

---

## 6. HUJJATLAR XARITASI (tarix va tafsilot shu yerда)

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
