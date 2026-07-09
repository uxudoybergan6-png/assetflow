# DIREKTOR-HANDOFF — Loyiha Direktori davom-kiti

> Yangi chatda davom etish uchun: bu faylni Claude'ga bering + pastdagi ROL bo'limini qo'ying, so'ng "shu joydan davom et" deng.

## ⭐⭐⭐⭐ KEYINGI HISOBDA SHU JOYDAN DAVOM ET (2026-07-09, limit tugadi)
ROL o'zgarmagan (Direktor — o'zbekcha gaplash, Code'ga inglizcha prompt yoz, model tanla). HOLAT:
- ✅ KONTENT QUVURI F1–F6 + LAUNCH-READINESS Faza 1–5 + login/2FA/3-portal-dizayn + ingliz-tarjima — HAMMASI QURILDI,
  commit qilingan, USER PUSH QILDI, deploy JONLI (getframeflow.app eng yangi kod). Batafsil: shu handoff pastda.
- 👉 KEYINGI ISH: **docs/QA-FIX-PLAN.md** — USER jonli QA (16 muammo) + Direktor QA + Artlist o'rganishdan chiqqan
  YAGONA fix reja. 16 muammo → **6 PARTIYA** (ketma-ket, bir xil fayllar → parallel emas; pul-zona minimal diff).
- 👉 **PARTIYA 1 (KRITIK #7 — shablon to'liq paketi) BIRINCHI QILINADI** (USER keyingi hisobda). Prompt tayyor:
  ingest contributor zipining BUTUN paketini (.aep + footage + audio + papkalar) saqlasin (faqat .aep emas) → download
  (web+plagin) to'liq bersin (AE "files missing" demasin) → plagin to'liq ochib import. Model Fable5+Extra, lokal Code.
  (To'liq prompt matni: shu chatда yozilган; QA-FIX-PLAN.md Partiya 1'дан qayta tuzsa bo'ladi.)
- Keyin PARTIYA 2 (AI model sozlamalari — PUL-ZONA #16) → 3 (web routing/layout/filtr/login) → 4 (media/kartalar/playback)
  → 5 (AI Studio session + Projects) → 6 (plagin+admin polish). Har biri alohida Code prompt.
- ARTLIST ANDOZA (shimoliy yulduz): haqiqiy media (gradient EMAS) · masonry · to'liq ekran · inline video/audio play ·
  bottom-docked composer · sessions+My Library+New Session · Use▾ menyu · model-settings inline (per-model params).
- ⚠️ O'QISH TARTIBI (yangi hisobda): (1) docs/QA-FIX-PLAN.md (keyingi ish) (2) docs/LAUNCH-READINESS.md (5 faza holati)
  (3) docs/THREAT-REGISTER.md (xavfsizlik) (4) docs/KONTENT-QUVURI-SXEMA.md (kontent modeli).
- ⚠️ QOLGAN USER TASHQI QADAMLAR (launch uchun, kod emas): COST_QUOTE_SECRET prod (JWT'dan farqli, aks holda API boot yo'q) ·
  deploy tartibi migrate:deploy AVVAL (assetKeysJson/totp/RevenueEvent ustunlari) · eski shablon pack RE-SCAN (409 bo'lmasin) ·
  PAYOUT_MODE(pool)/CONTRIBUTOR_POOL_SHARE(0.50) qaror · SENTRY_DSN · backup bucket+versioning · sir rotatsiya · Resend DKIM ·
  yurist ko'rigi (legal matn) · Lemon Squeezy identity→LIVE · KONTENT (katalog to'ldirish) · 2FA enrol OLDIN ADMIN_REQUIRE_2FA.
- ⚠️ ARXITEKTURA QARORI o'zgargan: "zip=faqat .aep" NOTO'G'RI edi (P7) → endi TO'LIQ PAKET (footage bilan). KONTENT-QUVURI-SXEMA
  shu bo'yicha yangilanishi kerak (Partiya 1'da).

## ROL (Claude'ga qayta beriladi)

Sen — foydalanuvchi (o'zbek) bilan Claude Code o'rtasidagi "Loyiha Direktori"sisan.
Vazifang: kod yozish EMAS. Foydalanuvchining o'zbekcha xom g'oyasini Claude Code
uchun TO'LIQ INGLIZ tilidagi, self-contained, one-shot bajariladigan promptga
aylantirasan (nima qilish, qaysi fayl, chegaralar, kutilgan natija, noaniqlikda
qanday qaror). Har prompt oxiriga: "When finished: (a) commit with a clear concise
message (no Co-Authored-By); do NOT push. (b) write a short summary." Model tanla:
oddiy/kichik/aniq (CSS, joylashuv, bitta fayl) → SONNET 5 (arzon kunlik ish uchun
FAQAT Sonnet 5, Haiku EMAS); murakkab/ko'p qatlamli/migratsiya/refactor → OPUS yoki
FABLE 5. ⚠️ MODEL YANGILANISH (2026-07-04, benchmark bilan tasdiqlangan): FABLE 5
kodlashда eng kuchli — SWE-Bench Pro 80.3% (Opus 4.8 = 69.2%), murakkab/uzun
vazifalarда ustunligi kattaroq. Kamchiligi: kvotani ~2x tez yeydi (Fable $50 vs
Opus $25 / 1M token). Katta/murakkab plagin va backend ishlariga FABLE 5 (+ "Extra"/
"High" effort) tavsiya; oddiyга Sonnet 5. Kvota tejash kerak bo'lsa → Opus 4.8 yoki
Fable 5 "Medium".
Code natijasini
foydalanuvchiga O'ZBEK tilida, sodda (texnik bo'lmagan odam tushunadigan) qilib
tushuntir. Foydalanuvchi bilan doim o'zbekcha; faqat Code prompti inglizcha.

## LOYIHA

- FrameFlow (eski nom AssetFlow). Repo: `~/Projects/creative-tools-saas`.
- AE shablon marketplace + AI generatsiya studiyasi.
- Infra (haqiqiy): Cloud Run API (`api.getframeflow.app`) + GCS + Vertex AI +
  Neon PG + CF Pages (`getframeflow.app`). Batafsil: `docs/PROJECT-STATUS.md §-1`.
- Plagin: `plugins/after-effects-cep/AssetFlow_Plugin.html` (~792KB, bitta fayl).
  Plagin server deploy'ga KIRMAYDI — AE ichiga `install-cep.sh` bilan o'rnatiladi.

## HOZIRGI KATTA ISH: Plagin redesign (mockupdan 1:1)

Dizayn manbai (yagona haqiqat): `packages/assetflow-studio/platform/_frameflow-redesign-mockup.html`
— 32 panelli flow board. Zonalar:
- z-home: 1b (Home) · z-rasm: 1d (Rasm) · z-found: f1-f4 (tokens/tipografiya)
- z-a: a1-a7 (Katalog) · z-b: b1-b12 (AI Tools) · z-g: g1-g3 (Hisob)

### 1:1 ko'chirish USULI (nega ilgari buzilardi → yechim)
1. "O'xshat" EMAS — "verbatim ko'chir": mockupdagi aniq hex/px/radius/gap so'zma-so'z,
   tokenlashtirmasdan.
2. Bitta ekran/holat bir promptda (hammasi birdan = 1:1 buziladi).
3. Shrift LOKAL (CDN emas) — AE ichida internet/CSP yo'q. (Home'da qilindi.)
4. RESPONSIVE majburiy: kartalarga aspect-ratio (fixed height emas) +
   grid `repeat(auto-fill,minmax(Wpx,1fr))`. Tor (~380px)=mockup 1:1, keng=ko'p ustun.
5. Tekshiruv: Code headless Chrome bilan 380px VA ~900px skrinshot olib solishtirsin.

### PROGRESS
- [x] Home (1b) — 1:1 + lokal shrift + responsive. AE'da ishlaydi. (commit f5b0a30, 5804e9f)
- [x] Katalog a1 (grid) — REBUILD qilindi (eski struktura a1'dan farq qilardi) → 1:1
      + responsive (aspect 171/96, auto-fill minmax166). 380px/900px tasdiqlangan.
      (commit e7c5b71). Eslatma: pastdagi .foot account bar + #afFtr connection strip
      a1'da yo'q — ular Account/connection doirasi, qoldirildi (Home'da ham bor).
      USER O'ZGARISHI: grid header (.af-cathead) son+sort markazda (a1'da chap/o'ng
      edi) — "BARCHA SHABLONLAR · N · MOS ⌄" markazda guruh. (commit 3703999)
      USER O'ZGARISHI #2: chip qatori (.af-tabs Shablonlar/Motion/Graphics/LUTs) ham
      markazda (a1'da chapda edi). Ikki qator izchil markazda. (commit 0accdd3)
- [x] Katalog a2 (filtr) — REBUILD: ichki panel → bottom-sheet (a2). #filterSheet
      qo'shildi, #filterPanel olib tashlandi (#envScope carrier qoldi). Barcha filtr
      mantig'i saqlangan (selectCategory/selectOrientFilter/selectResFilter/
      toggleCatalogAi/selectSort/clearAllFilters). Ochish=filter btn, yopish=backdrop/
      apply/Esc. 380px 1:1 + 900px (440px markazda). (commit 3c1f8c3)
- [x] Katalog a3 (shablon detail) — 1:1 (commit c6de64c)
- [x] Katalog a4 (import oqimi: progress + success toast + MOGRT multi-select sheet) (bc297b4)
- [x] Katalog a5 (limit holatlari: Free oylik limit + PRO qulf sheet'lari; server 402/403) (2dec697)
- [x] Katalog a6 (Kutubxonam: Sevimli grid + Yuklab olingan qator + segment) (28a12e0)
- [x] Katalog a7 (holatlar: cold-start · xato · bo'sh natija) (ae651ce) → PILLAR A TUGADI
- [x] AI Tools b1–b12 (butun Pillar B) — 1:1, 10 commit + 2 tuzatish sweep (post-live-test):
      glass panel, in-place popover sozlamalar (bottom-sheet EMAS), model-aware boshqaruv
      (refKind/maxRefs/endFrame/imageRequired), video=rasm tool, kredit tarixi UI, video
      poster, lightbox katta, ikkilangan referens olib tashlandi, home filter bug, tarix
      karta→lightbox. QAROR: hech qayerda bottom-slide yo'q — kichik=popover, katta=markaziy modal.
- [x] Hisob g1–g3 (Hisob/login/publish) — hammasi MARKAZIY modal (bottom-sheet emas),
      1:1 reskin, mantiq saqlangan (setTheme/AF_THEMES, plan, folder, login/logout,
      Google, publishScan/publishGo, barcha field id'lar). g1→ea031c5 (parallel commit
      ichiga tushib ketdi), g2→0a2d38c, g3→7181005 (height min(640px,92vh)).
      ⚠️ PARALLEL SESSIYA ogohlantirishi: ayni faylda (AssetFlow_Plugin.html) bir vaqtda
      2 sessiya ishladi — g1 boshqa committer'ning commit'iga tushib ketdi (rewrite
      QILINMADI — unpushed + faol committer bilan xavfli). ⇒ PLAGIN DIZAYNI TUGADI.
- [ ] Rasm (1d) — VAR·B variatsiya; AI Tools rasm-tool'i qurilgani uchun QAMRALGAN deb o'tkazildi
- [ ] Poydevor f1-f4 (tokens/components) — kerak bo'lsa oraliqda
- [x] API-CORRECTNESS AUDIT — 13 enabled model tekshirildi → 9 PASS · 4 FIXED · 1 NEEDS-CONF.
      Hisobot: docs/AI-API-AUDIT.md. 4 commit (push YO'Q, build toza).
      ENG MUHIM FIX (ea031c5): Veo — faqat end-frame + gen bosilsa processor uni jimgina
      tashlab, user to'liq to'lab end'siz t2v olardi (PUL LEAK) → endi /gen kreditdan OLDIN
      400 END_FRAME_REQUIRES_START, plagin ham bloklaydi.
      FIX (88bf250): Nano Banana 2 Lite resolutions:["1K"] qo'shildi (quality meros bug).
      Seedance 3101/3102 aslida ENABLED (fal dormant emas — jonli zaxira).
      NEEDS-CONF: Kokoro TTS (OpenRouter key jonliligi statik tasdiqlanmaydi), Nano Pro narx
      "TAXMINIY" (pul zonasi — tegilmadi). API o'zgardi → PUSH + Cloud Run deploy KUTILMOQDA.
- [ ] PLATFORMA (web) REDESIGN — 5 bosqich (Faza 4 UX shu ichiga singadi)
      Manba: docs/DESIGN-PROMPT-PLATFORM.md (SPEC — rendered mockup EMAS). Joriy:
      platform/index.html (16283 qator), 9 ekran: landing/pricing/plugin/auth/
      dashboard/templates/aistudio/account/projects + privacy/terms/refund.
      "1:1" = bir xil dizayn TIZIMI (token/shrift/komponent plagin bilan aynan), web-native
      layout (380px panel EMAS). Studio manba: root js/+styles/ ga edit, so'ng studio:sync!
      · [x] Bosqich 1: rendered mockup TAYYOR — platform/_platform-redesign-mockup.html
        (~1890 qator, 27 freym, 9 ekran + desktop/tablet/mobile, design-system sheet,
        yagona nav, §5 IA muammolar dizaynda hal). Plagin tokenlari aynan. index.html/
        ff-api.js/build TEGILMAGAN. (commit 9d3ea7a) → USER TASDIG'INI KUTMOQDA.
      · [x] Bosqich 2: Marketing PORT QILINDI real index.html'ga (1:1 mockupdan). Landing/
        Pricing/Plugin + marketing top-nav (frost-on-scroll + mobil drawer) + footer (real
        legal). IA fix: Blog+Hujjatlar o'lik link olib tashlandi, soxta social proof→real stats.
        CSS `ffm-` scoped, template runtime/routing/ff-api saqlangan. index.html = CF Pages
        to'g'ridan (prepare-cf-pages copyDir platform→dist). 1280/960/390 tasdiqlangan.
        (commit f8ba6d0) ⚠️ index.html = REAL sayt → push CF Pages deploy qiladi.
        USER TWEAK: landing (home) ~30% vertikal compact qilindi (hero 64→44, bo'lim
        72→50, shrift/layout tegilmagan; pricing/plugin o'zgarmagan). (commit 4fbde97)
        USER: landing "iddiy" tuyuldi → BOY landing mockup yasaldi platform/_landing-rich-mockup.html
        (2 hero: A=jonli AI Studio media-hero [tavsiya], B=kinematik aurora-sahna; to'liq boy landing A'da:
        aurora-mesh, 64px hero, count-up stat, marquee showcase, 3D-tilt kartalar, nafas-glow CTA; brend
        tokenlar 1:1, prefers-reduced-motion). (commit 9da61ad). USER TANLADI: Variant B.
        [x] BOY LANDING PORT QILINDI real index.html'ga (Variant B "Kinematik sahna", ffl- scoped):
        Hero B (aurora/mesh + dot-grid, 6 suzuvchi karta parallax + gen-holat, vignette, clamp-64px hero,
        cta-glow, marquee), stats count-up jonli, showcase 2-qator marquee (cattab filtr real), AI Studio
        tilt+glow, plagin 3D panel, narx lime-glow, FAQ akkordeon, CTA glow. Bindinglar saqlangan (jonli
        tasdiq). ffm- footer/nav tegilmagan, ff-api/app ekran/pricing/plugin O'ZGARMAGAN. prefers-reduced-
        motion ishlaydi. (commit dfe6a84) ⚠️ index.html=REAL sayt → push CF Pages deploy.
      · [x] Bosqich 3: Auth (login/register/forgot/verify — split composition) + Dashboard +
        YAGONA APP SIDEBAR (ffa- scoped: sidebar + mobil drawer + bottom tab-bar + avatar
        dropdown+logout, collapse 64px). Auth mantiq saqlangan (FFAPI login/register/forgot/
        Google #ffGoogleBtn/Turnstile #ffTurnstileWidget/verify gate). 1280/960/390 tasdiqlangan.
        (commit e5cf0ad) App CSS = ffa- scope (marketing ffm-, hech nima to'qnashmaydi).
      · [x] Bosqich 4: Templates marketplace (filtr rail + wide grid + split detail modal) +
        Projects (Loyihalar mosaic). IA FIX: Orientatsiya/Sifat filtrlari REAL ulandi
        (loadCatalog ori/qual/ar normalize → filtered() predicate), mobil filter drawer
        (filterDrawerOpen, live-filter + "N natijani ko'rsatish"). Sort real ishlaydi. Katalog/
        download/search mantiq saqlangan. ffa- scope. 1280/960/390 tasdiqlangan. (commit a2a4b5d)
      · [x] Bosqich 5: AI Studio (3-panel: tool rail/composer/canvas; rasm/video/ovoz/SFX,
        model-aware labeled settings, cost clarity ✦N, pending-glow, lightbox) + Account
        (4 tab: Profil/Obuna/Kreditlar/Yuklamalar — §5 IA fix). Gen flow (cost-quote/consume/
        refund/poll) + account bindings saqlangan. ffa- scope. 1280/960/390 tasdiqlangan.
        (commit 4347d92) ⇒ PLATFORMA REDESIGN TO'LIQ TUGADI 🎉
        USER FIX: AI Studio composer Bosqich 5'da mockupdan chetlagan edi (tik vertikal panel)
        → BOTTOM-DOCKED composer'ga qayta qurildi (tepada gorizontal tab + pastda frosted
        docked bar + sozlama CHIP→popover; Ovoz ai3 list qoldi). ffa-st- scope. (commit 0ece114)
      ⇒ PLAGIN + PLATFORMA redesign IKKALASI TUGADI. Keyingi: FIX-REJA-5-BOSQICH (biznes/zanjir).
- [ ] Backend fazalar (mustaqil): Faza 3 (SSRF, N+1, deploy xavfsizligi),
      Faza 5 backend (Paddle, rebrend). Batafsil: `docs/AUDIT-2026-07-02.md`.

## SYSTEM-CHAIN-AUDIT (docs/SYSTEM-CHAIN-AUDIT.md — branch claude/frameflow-system-audit-fcx6rw, commit 2394d0c)
Biznes model (user qarori): obuna+kredit top-up (hybrid) · gen marja ~2x provider · contributor
payout 50% · storage tarif bo'yicha ~3GB+ · miqyos yuzlab (o'sishga tayyor) · admin hammasini ko'radi.
> Tahlil xulosasi: "plumbing" (upload→approve→publish→catalog→serve, kredit gate, webhook) real va
> asosan to'g'ri, LEKIN atrofidagi BIZNES yo'q (pul olish, marja, payout, huquq, DR).
ENG QO'RQINCHLI P0 (blind spots — user so'ramagan):
1. TO'LOV: faqat Stripe (USD, obuna-only, kalitlar bo'sh=OFF). Payme/Click/Uzcard/UZS YO'Q → O'zbekistonda
   pul olib bo'lmaydi → daromad strukturaviy 0. Local rail noldan qurilishi kerak.
2. HUQUQ/SOLIQ: Terms/Privacy "Paddle merchant-of-record" deydi, kod=Stripe (MoR emas) → VAT SIZNING
   javobgarligingiz, huquqiy hujjat noto'g'ri entity'ga ishora.
3. KONTENT MODERATSIYA ~yo'q → jinoiy javobgarlik. Faqat keyword match. CSAM tor holatda, deepfake faqat
   warn. Yuklangan .zip/.aep skanlanmaydi (malware), dedup/DMCA yo'q.
4. RUNAWAY BILL tormozi yo'q: global spend cap/kill-switch/gen daily-cap YO'Q. Turnstile+email-verify
   env yo'q bo'lsa FAIL-OPEN. Bitta multi-account farm cheksiz Vertex/fal hisob.
5. MOLIYAVIY KO'RLIK: financial dashboard yo'q; ProviderSpend.estimatedCostUsd hech yozilmaydi
   (studio-gen.ts:929) → marja hisoblanmaydi; Payout/Earnings model YO'Q → 50% payout o'lik UI stub.
6. BACKUP/DR yo'q (Neon/bucket o'lsa hammasi yo'qoladi). OBSERVABILITY yo'q (Sentry yo'q, /health soxta).
MISPRICING (TUZATILDI — Direktor mustaqil 4-agent tekshiruvi): Code "har gen zarar" dedi (kredit
~$0.0065 taxmini bilan), LEKIN u narx SOXTA/mavjud emas pack'dan — real kredit qiymati = PRO $19/1000cr
= $0.019/kredit (data.js:53 + plugin-profile.ts:16). $0.019'da Nano Banana 2 / Veo 3.1 / Omni PROFITABLE
(~1.3-1.5x), ZARAR EMAS — lekin 2x maqsaddan PAST, va cost yozilmagani uchun margin KO'RINMAYDI. Fix:
estimatedCostUsd yozish (studio-gen.ts:929) + ~2x uchun narxni biroz oshirish. Modellar kalibr $0.012-0.015.
YANGI topildi (Code aytmagan): (a) PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=true (.env.cloud.example) → to'lovsiz
PRO berish mumkin; (b) Studio tarif UI'da bor, backend faqat FREE|PRO ('studio'→Pro normalize); (c) JWT_SECRET
auth VA cost-quote imzo uchun bir xil → sizsa cheksiz bepul gen forge; (d) Download model schema'da bor lekin
HECH QAYERDA yaratilmaydi (o'lik) → contributor download soni forgeable ContributorTemplate Int counter'dan.
Contributor approve/reject email KODI bor (notifyContributorReview) — lekin sandbox sender = yetkazilmaydi.
PHASE 0 ROADMAP (qon to'xtatish): ①provider USD cost yozish ②zararli Vertex video reprice/disable
③global spend kill-switch+daily cap ④real moderatsiya klassifikator ⑤Payme/Click ⑥Paddle/Stripe huquq
fix ⑦DB/R2 backup+runbook ⑧Sentry+real /health ⑨email-verify fail-CLOSED. Keyin: chain accounting
(download count forgeable, pack presigned) → financial dashboard → payout → storage quota → scale.
⚠️ Audit doc BRANCH'da (main'da emas) — kerak bo'lsa main'ga olib chiqish/merge kerak.

## ⭐ MASTER REJA: docs/FIX-REJA-MASTER.md (7 bosqich — yagona, ustun)
Biznes+admin+narx+monitoring hammasi shu yerda. Qatlam: BACKEND=1-4&7, ADMIN UI=5-6.
1 Himoya/xavfsizlik · 2 Huquq/moderatsiya · 3 Daromad+narx dvigateli+monitoring · 4 Zanjir+payout+storage
· 5 Admin redesign (mockup+mavjud ekran) · 6 Admin biznes markaz (moliya/narx UI/payout/sarf — backendga ulanadi)
[~] BOSQICH 5.1 ADMIN MOCKUP TAYYOR — admin/_admin-redesign-mockup.html (21 freym, dizayn-system +
  mavjud 10 ekran (Overview/Moderatsiya/Shablonlar/Contributor+detal/Obunachi+detal/Tarif/Xabar/Analitika/
  Sozlama/Log+Audit) + YANGI biznes markaz (Moliya dashboard/Narx boshqaruvi margin%/Har-user sarf/Contributor
  payout=download soni→qo'lda/Faoliyat jurnali) + responsive. Plagin tokenlari aynan. admin/index.html TEGILMAGAN.
  (commit d2f7193) → TASDIQLANDI.
[x] BOSQICH 5a PORT BAJARILDI (3 commit main'da, push YO'Q, jonli API bilan tasdiqlangan):
  admin SHELL (styles/admin.css adx- prefix; 4-guruh sidebar + topbar; lokal shrift+Phosphor, CDN yo'q) +
  Dashboard (e1: stat+moderatsiya preview+recent) + Moderatsiya (e2: 2-panel+decision, approve/reject jonli
  ishlaydi). Mantiq saqlangan. Manba tasdiqlangan (admin/index.html+root js/+styles/=MANBA, studio:sync).
  BUG FIX: modRejectConfirm reject-sababni tashlardi; loadModerationOnly soft-reject'ni yo'qotardi. Biznes
  nav = "Tez orada" (5b/6). (commit 52071ec shell, 12605cf dash, 2cf5616 mod).
  QOLGAN: 5b (Shablonlar/Contributor/Obunachi) · 5c (Tarif/Xabar/Analitika/Sozlama/Log) · Biznes ekranlar (Bosqich 6).
· 7 Miqyos+polish+rebrand. (FIX-REJA-5-BOSQICH.md — eski, shu masterga singdirilgan.)
Narx boshqaruvi = DVIGATEL(3.4) backend + SAHIFA(6.2) UI. Monitoring=3.5.
TO'LOV QARORI (Bosqich 3.1 — Payme/Click O'RNIGA): xalqaro = LEMON SQUEEZY (MoR — soliq/VAT o'zi hal
qiladi, huquqiy muammoni yopadi). Payout → Khamkorbank UZ TO'G'RIDAN (Farg'ona filiali, KHKKUZ22XXX;
Payoneer shart emas). Store: getframeflow.lemonsqueezy.com, USD, TEST MODE, identity IN REVIEW.
Mahsulotlar: Pro $19/mo YARATILDI(published) · qolgan (Studio $59/mo + 500/$5,1500/$12,5000/$35 credit
packs) — YARATILMOQDA. Model: Free(app default)·Pro·Studio; obuna=cheksiz shablon+AI kredit; pack=extra kredit.
[x] LS TO'LOV INTEGRATSIYA BAJARILDI (5 commit main'da, push YO'Q, build toza, pul mantig'i tegilmagan):
  STUDIO tarifi REAL (enum + migratsiya 20260705120000; allotment FREE50/PRO1000/STUDIO6000; Pro-template
  gate isPaidPlan bilan tuzatildi) · lib/lemonsqueezy.ts (client+variant discovery+sig verify) · POST /api/
  billing/checkout · POST /api/lemonsqueezy/webhook (raw body, HMAC-SHA256, WebhookEvent idempotent, exactly-once
  topup grant) · frontend tugmalar (FFAPI.checkout, data-amt/data-plan) ulandi.
  ⚠️ USER QADAM: (1) mahsulotlar tugat (Studio+3 pack, nom "Pro/Studio/N Credits") (2) LS dashboard→Webhooks
  qo'sh: URL https://api.getframeflow.app/api/lemonsqueezy/webhook, event: subscription_* + order_created →
  signing secret ol (3) env: LEMONSQUEEZY_STORE_ID + LEMONSQUEEZY_WEBHOOK_SECRET + gh secret set + push.
  ⚠️ HAL QILINISHI KERAK: (a) Pro kredit — marketing 1,500 der, backend 1,000 (qaysi to'g'ri? user qaror);
  (b) oylik reset top-up kreditni O'CHIRADI (pack sotib olgan user oy oxirida qo'shimcha kreditni yo'qotadi)
  — hybrid model uchun TUZATISH kerak (reset = allotment+leftover-topup bo'lsin).
  Narx dvigateli (A guruh) hali qilinmagan (parallel, hisob kutmaydi).
[x] BOSQICH 4 BAJARILDI (5 commit main'da, push YO'Q, build toza, pul mantig'i tegilmagan):
  #1 TemplateDownloadEvent (real atomik download/import event; contributor stats forgeable Int emas real'dan;
  legacy Int fallback birinchi event'gacha) · #2 konsolidatsiya: Asset+Download O'LIK→DEPRECATED, /users/
  downloads real event'ga qayta ulandi, ContributorTemplate=yagona manba · #3 ContributorEarning+Payout
  (idempotent downloadEventId unique) + endpointlar (/contributor/earnings, admin/earnings, admin/payouts) ·
  #4 GenAsset.sizeBytes + storage quota (FREE3GB/PRO50GB/STUDIO200GB) + /gen 413 charge'dan oldin + retention
  + privacy (owner-only, signed URL) · #5 aiCreditsTopup tracker — oylik reset endi allotment+qolgan-topup
  (pack kredit YO'QOLMAYDI). 4 additive migratsiya (push'da auto).
  USER QAROR (hal qilindi, env'da): (a) PAYOUT — CONTRIBUTOR_PAYOUT_PER_DOWNLOAD_CENTS=0 → avtomat $ YO'Q;
  faqat download sanaladi, admin qo'lda hisoblab tarqatadi (hozircha). Admin uchun per-contributor download
  ko'rinishi = admin redesign (Bosqich 6)da chiroyli qilinadi. (b) STORAGE — FREE1/PRO5/STUDIO20 GB (env).
[x] BOSQICH 1 BAJARILDI (10 commit main'da, push YO'Q, build toza, pul mantig'i tegilmagan):
  1 provider-cost.ts (estimatedCostUsd yoziladi) · 2 spend-guard.ts (kill-switch+USD ceiling+daily cap,
  consume'dan OLDIN) · 3 backdoor=false · 4 COST_QUOTE_SECRET (JWT fallback) · 5 turnstile+email prod
  fail-closed · 6 sentry.ts + real /health(SELECT1+HeadBucket) + /livez · 7 fetch-safe.ts SSRF (4 fetch) ·
  8 db-backup.mjs + workflow + DR-RUNBOOK.md · 9 email prod EMAIL_FROM warning. Migratsiya YO'Q (ustun bor edi).
  /gen tartib: kill→ceiling→quote-verify→daily-cap→consume (hammasi charge'dan oldin).
  ⚠️ USER TASHQI QADAM (prod): COST_QUOTE_SECRET o'rnat · PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false ·
  TURNSTILE + RESEND sozla (aks holda prod'da register/kredit BLOK — fail-closed!) · SENTRY_DSN + npm i
  @sentry/node · Resend domen+DKIM/SPF+EMAIL_FROM · backup bucket + versioning + BACKUP_GCS_BUCKET var.
[x] YANGI-USER 0-KREDIT bug: HAL — deploy'dan keyin jonli test: yangi user 50 kredit oladi + rasm gen
    ishladi (2026-07-04). Fix (b3b7d87):
  ensurePluginProfile create branch endi aiCredits=aiMonthlyAllotment(FREE)+aiCreditsResetAt=monthStart
  (app konstanta = yagona manba). Backfill skript (ae732fd, npm run backfill:free-credits, DRY_RUN=1
  default) — faqat haqiqiy bug-qurbon (FREE·0·ledger yo'q·createdAt>ledger-migr) topiladi. ⚠️ LEKIN Code
  lokalda bug'ni QAYTA HOSIL QILOLMADI (schema default=50 mos) → jonli 0 sababi BOSHQA bo'lishi mumkin
  (web account kredit manbai profil init qilmaydimi?). PUSH+DEPLOY'dan keyin QAYTA TEST: yangi user 50
  oladimi? Yo'q bo'lsa — chuqurroq qidiruv kerak. Backfill DRY_RUN→real bilan joriy 0-userlar tuzatiladi.
[x] BOSQICH 2 BAJARILDI (6 commit main'da, push YO'Q, build+db green, pul mantig'i tegilmagan):
  1 moderation.ts (ML klassifikator prompt+ref+output; CSAM/deepfake HARD BLOCK; charge'dan oldin) +
  preflight-safety fix · 2 malware-scan.ts (VirusTotal hash) + pack pipeline (hash→dedup→scan) + DMCA
  takedown (admin routes) + guardDownloadable 451 + approve gate 409 · 3 legal docs o'zbekcha, Paddle→Stripe
  reality, Studio/credit-pack shartli, MoR/VAT placeholder · 4 docs/LEGAL-TODO.md.
  ⚠️ MIGRATSIYA: 20260704120000_upload_safety_takedown (6 nullable ustun + 2 index) — push'da auto.
  ⚠️ USER TASHQI: MODERATION_API_KEY (yo'q=keyword-only) · VIRUSTOTAL_API_KEY (yo'q=prod pack upload
  QUARANTINE — contributorlar bloklanishi mumkin! admin pack-clear bilan ochiladi) · MODERATION_MODERATE_OUTPUTS.
  HUQUQIY-TODO: MoR/VAT/refund/Studio+credit-pack qarori — user+huquqshunos (docs/LEGAL-TODO.md).

## ⭐⭐⭐ 2026-07-06 — 5-FAZALI PLAN · FAZA 1 TUGADI (YANGI HISOBDA SHUNDAN DAVOM ET)
> NARX FIX (512fbee, unpushed): Pro Monthly $24→$19 (LS bilan mos), Yearly toggle olib tashlandi
> (LS'da yillik variant yo'q). Free$0/Pro$19/Studio$59 faqat oylik. FAZA 2 PUSHED+deployed; LS 5 mahsulot
> published; media fix jonli (demo shablon userni o'zi o'chirgan → katalog bo'sh, bug emas). KEYINGI: FAZA 3 plagin.

> Foydalanuvchi yana yangi hisobga o'tdi (limit). Direktor rol o'zgarmagan. Model: katta/murakkab → FABLE 5 (+Extra),
> oddiy → Sonnet 5, pul-migratsiya → Opus/Fable. Har FAZA bitta urinishда (Fable 5). Push QILMA (foydalanuvchi o'zi).

### TO'LIQ PLAN: `docs/FIXES-PLAN-2026-07-05.md` (⭐ avval shuni o'qi)
Foydalanuvchi jonli test + QA-audit'дan **24 muammo** yig'di → **5 FAZA**ga bo'lindi (har biri bitta urinishда):
- **FAZA 1 — Ingliz tili (i18n):** ✅ **TUGADI + PUSH + JONLI** (o'zbek→ingliz: plagin ba08088/0315ebe,
  platform ba08088, studio b544248, backend 980c103; web ingliz render, 0 konsol xato). QOLDIQ: `jsx/host.jsx`
  dagi AE xato xabarlari (`Comp topilmadi` +5 joy) o'zbek qoldi → **FAZA 3 (plagin)ga qo'shiladi**.
- **FAZA 2 — Backend yadro:** ✅ **TUGADI** (9 commit main'da, PUSH YO'Q, build yashil, pul-zonasi tegilmagan).
  A media: ildiz=katalog imzosiz public GCS URL→403→qora; endi signed URL (pack/.mogrt PRIVATE qoladi) + video
  ffmpeg poster (GenAsset.thumbKey) + history parallel+retry. B sync: identity ALLAQACHON yagona; sevimlilar→DB
  (UserTemplateFavorite). C delete: allaqachon GCS'ga tarqalardi, idempotent+poster fix. D storage: 1/5/20GB +
  /credits storage + X/Y GB bar. E vertex: omni:93 PROJECT→VIDEO_PROJECT fix (fal tegilmadi). F billing: plagin
  paket→LS checkout (Stripe emas). G plans: PlanConfig DB (seed=bugun, 60s TTL, consume/refund/quote O'ZGARMAGAN)
  + admin GET/PUT. H sessiya: login oqim fix, JWT 7d→30d.
  ⚠️ USER QADAM: (1) ✅ LS'da 5 mahsulot yaratildi+published (Pro$19/Studio$59/500$5/1500$12/5000$35 — nom mos).
  (2) GOOGLE_CLOUD_PROJECT_VIDEO env + SA 2-loyiha ruxsat (ixtiyoriy — fallback bor). (3) PUSH → migrate:deploy (3 additive:
  genasset_thumbkey/user_template_favorite/plan_config). (4) AE jonli test. → KEYINGI: FAZA 3 (plagin tuzatish).
- **FAZA 3 — Plagin tuzatish+sayqal:** ✅ **TUGADI** (6 commit main'da, push YO'Q, pul-zonasi tegilmagan).
  E host.jsx i18n (~70 string, 5 emas). A: #3 login — Enter-key qo'shildi. ⚠️#3 GOOGLE LOGIN keyin JONLI AE'da
  BUZUQ topildi → TUZATILDI: ildiz=js/CSInterface.js openURLInDefaultBrowser shim faqat direct method tekshirardi
  (Adobe invokeSync orqali beradi) → window.open popup-block → brauzer ochilmasdi. Fix: invokeSync + child_process
  shell-open fallback (fabcc5b). LEKIN hali ishlamadi → 2-urinishda HAQIQIY sabab: "Session expired" Google
  bosganda chiqardi — device-code so'rovlari authed request() wrapper'dan o'tib eski token biriktirib 401→"Session
  expired" interceptor login'ni brauzer ochilmasdan buzardi. FINAL FIX (bff5d95): publicRequest() [token yo'q,
  interceptor yo'q] login/device/start/poll uchun + publicApiBase() localhost→prod + step-status + copyable
  havola+kod fallback (device.html manual code yo'q → full link). LEKIN hali ishlamadi (2 fix):
  (bff5d95 keyin) FIX-2 ea31e9b: device.html'ga email+parol formasi ("Sign in & approve") + yangi
  endpoint POST /api/plugin/device/confirm-password + guest "Session expired" toast gate
  (sessionEstablished flag). Deploy qilindi (push). FIX-3 a260319: BRAUZER OCHILMASDI — ildiz=
  noto'g'ri API (CSInterface shim) + status yolg'on ("Browser opened" har doim). Fix: openExternal()
  window.cep.util.openURLInDefaultBrowser (canonical AE) → node child_process open (macOS) → shim →
  window.open; faqat rost ochilса status ko'rsatadi. ✅ AE'DA ISHLADI — #3 GOOGLE LOGIN TO'LIQ YOPILDI.
  (a260319 plagin-only, push shart emas.) · #11 avatar tugma 6 ekranda · #21 to'liq avatar (POST /api/auth/avatar
  GCS User.image + GET signed 302 + plagin/web UI, migratsiya yo'q). B: launcher→to'g'ridan tool · single-mode toggle
  yashirin · 5daq auto-refresh + qo'l ↻ · downloads Clear + qora thumb yo'q · 11 model tasdiqlandi. C: 3 tema TO'LIQ
  (416 hardcode rang→token; Standart piksel-bir xil; on-image matn oq). D: go() null-guard + ~1900 o'lik qator o'chdi
  + kosmetik (toast z, 640px cap, DEV·DEMO prod'da yashirin). BONUS: Home badge eski o'zbek string solishtirardi→fix.
  ⚠️ USER: (1) API deploy (avatar endpoint — push, migratsiya yo'q) (2) install-cep.sh + AE restart (3) AE-only test:
  avatar upload, #7 toggle, Clear, Google device-code. → KEYINGI: FAZA 4 (plagin HOME redesign).
- **FAZA 4 — Plagin HOME redesign** (mockup→tasdiq→qurish): #5 + #10 Home tugma.
  [~] MOCKUP TAYYOR: plugins/after-effects-cep/_home-redesign-mockup.html (commit d6a4b9b, push yo'q).
  2 variant: A="Editorial Studio" (iliq greeting + 2 pillar doorway + Continue + Recommended + credits nudge),
  B="Command Deck" (⌘K search + 4 quick-action + hero carousel + Jump-back rail + trending). + Guest/onboarding
  holat + shared header (#10 Home=lime lightning top-left hamma ekranda, #11 credits+plan+avatar top-right;
  guest'da "Sign in" pill). English. Plagin tokenlari 1:1. Live plagin TEGILMAGAN.
  [x] USER TANLADI: Variant A. QURILDI real plaginga jonli data bilan (commit ebe1e1e, push yo'q):
  Home Variant A (vaqt-greeting+real ism, 2 pillar[real katalog soni], Continue[real oxirgi import+gen],
  Recommended 2×2 real katalog, kredit nudge real balans, guest holat+Google device-code). Shared header
  hamma ekranda (#10 lime chaqmoq=Home goHome(), #11 kredit+plan+avatar=Hisob, guest=Sign in; afHdrSyncAll).
  ⚠️ USER: install-cep.sh + AE restart → AE'da test (login, katalog soni, gen history, resume). ⇒ FAZA 4 TUGADI.
- **FAZA 5 — Web app redesign** (Artlist uslub, ingliz, landing tegilmaydi): #16 (#15 ичida) + #19-web. ✅ **TUGADI**.
  Material yig'ilgan (Artlist Home+AI Toolkit+Stock Catalog Chrome bilan tahlil qilingan). Faza 4/5 = dizayn, INGLIZ tilида qurilsin.
  [x] MOCKUP: platform/_webapp-redesign-mockup.html — 2 variant (A=Editorial/media, B=Workspace/rail+⌘K) × 4 ekran
      (Home/Katalog/AI Toolkit/Account) + mobil + solishtirish jadvali (commit 71e2d46, push yo'q).
  [x] USER TANLADI: Variant A. QURILDI jonli platformaga (5 commit main, push YO'Q, pul-zonasi diff'da tegilmagan):
      Shell 64px top-nav (logo+4 havola+⌘K qidiruv+credpill+avatar; ≤820px mobil tab). Home A1 (greeting hero+
      kredit-karta, quick-action, Jump back in=real gen tarixi, Recommended=real katalog). Katalog A2 (qidiruv hero+
      chip filtr+dropdown facet+immersiv grid; detal=ALOHIDA sahifa breadcrumb+specs+Download/Open CTA). AI Studio A3
      (picker 4 media-karta real narx+suzuvchi dock composer+session strip; voice/SFX ham). Account A4 (plan-karta+
      kredit-karta 3 pack+activity ledger+Downloads). Barcha logika (FFAPI quote→gen→poll→refund, checkout, filter,
      auth, lightbox) bayt-baytligicha; faqat DOM/CSS qayta ulandi. 1280+390px skrinshot mockup bilan solishtirilgan,
      overflow yo'q. Og'ishlar: Free CTA almashuvi yo'q (gating backend), Security tab→Profile, real narx $5/$12/$35,
      fmtDate uz→en. ⚠️ USER: PUSH → CF Pages deploy → getframeflow.app'da real API bilan smoke-test.
- **QA CYCLE 1 (jonli, Claude-in-Chrome + Direktor):** butun zanjir sinaldi. TOPILDI+TUZATILDI:
  #1 KRITIK — CSP unsafe-eval faqat `/`+`/index.html`ga berilgan, SPA path-route (/templates…)
  eval'siz CSP olardi → dc-runtime new Function o'lardi → BUTUN mijoz-sayt interaktivi o'lik (0/36
  handler). Fix (90f6fef): prepare-cf-pages.mjs bitta platform-CSP `/*` ga (unsafe-eval+blob:) +
  path→screen deep-link index.html. #1 cascade → #2 AI gen, #3 path-route blank, #4 filtr, #9 email,
  #11 Recommended — bari tuzaldi. P2 (8bfa59e): #5 kredit ✦0 miltillash→loading flag, #6 narx
  beqaror→barqaror minCostOf, #7 device oq tema→qora/lime+Google en, #8 "Parol"→Password+GIS hl=en.
  Admin panel = SOG'LOM (real data, xato yo'q). Katalog bo'sh {"items":[]} = kutilgan (demo o'chirilgan).
  Commit 90f6fef+8bfa59e push YO'Q. ⚠️ USER: PUSH → CF deploy → getframeflow.app/templates to'g'ridan
  ochib smoke-test (CSP xato yo'q + Google chip inglizcha).
- **QA CYCLE 2 (jonli, USER push qildi → deploy o'tdi):** Claude-in-Chrome to'liq QA. NATIJA: 7/8 bo'lim PASS.
  CSP fix jonlida tasdiqlandi — AI Studio to'liq ishlaydi (gen: qizil doira, kredit ✦25→✦21 aniq), auth,
  Home, Account (Lemon Squeezy checkout narx to'g'ri $19/$5/$12/$35), responsive, konsol 0 xato. Device qora
  tema+kredit miltillash+narx barqaror — hammasi OK. ⚠️ TOPILGAN 1 BUG (hali TUZATILMAGAN — prompt user'ga
  berilgan, run qilinmagan): **#DEV — /device sahifasida Google tugmasi YO'Q** (faqat "or" ajratgichi osilib
  qolgan, tugma DOM'da yo'q; /signin'da Google inglizcha ishlaydi). Ehtimol sabab: device.html'dagi "GIS 5s
  ichida yuklanmasa yashir" logikasi ishga tushib, "or"ni osilib qoldirgan. FIX: device GIS'ni /signin kabi
  ishlat + "or" ajratgich faqat tugma bo'lsa ko'rinsin. Model: Sonnet 5.

## YANGI TASHABBUS: Artlist-uslub redesign (2026-07-07 dan)
> USER: FrameFlow'ni Artlist.io darajasiga yaqinlashtirish. Claude-in-Chrome Artlist'ni ipidan-ignasigacha
> o'rgandi (dizayn tizimi + patternlar) + Explore agent backend imkoniyatlarini aniqladi. Landing tegilmaydi.

### Artlist dizayn tokenlari (referens — bizning brendga MOSLAB olamiz, ko'chirMAYmiz)
- Page #0D0D0D · accent #FFDA2A (bizda LIME #C2F04A) · text #FFF/#B2B2B2 · font artlistSans.
- Primary CTA = RADIAL-GRADIENT pill (radius 100px, ~44px, dark text) — "spend" aksiyalar uchun; nav=flat/ghost.
- Active nav tab = translucent white pill (radius 100px). Kartalar = CHEGARASIZ (soya yo'q, rasm-kontrasti).
- Radius: hero 24px, medium 8-16px. Tipografiya: h2 32/500, h3 24/500, body 16/400-500.
- Loading = o'yinqaroq mascot glyph + % matn (skeleton emas).

### Artlist top-8 pattern (ta'sir bo'yicha): 1) yagona multi-modal composer + mode-pill 2) jonli cost badge
> 3) model picker 2-bosqich (quick-pick + to'liq modal) 4) natija "Use ▾" menyu chuqurligi 5) sessiya 2-panel
> Visuals|Audio + chap thumbnail rail=tarix 6) o'yinqaroq progress 7) radial-gradient CTA=monetizatsiya tili
> 8) asset detail pattern (breadcrumb→preview→meta→related→"part of collection").

### Backend AI inventari (Explore agent — pul-zonaga TEGMA: consumeAiCredits, computeGenCost, cost-quote HMAC)
- Gen tayyor: text→image, image-EDIT (Nano Banana 2/Lite/Pro), text→video, image→video (Seedance 3101),
  R2V multi-modal (3102), TTS (Kokoro 2001), SFX (ElevenLabs 4001). Frontend: platform/ff-api.js (FFAPI.gen/
  quote/genGet/history/enhance...), composer platform/index.html.
- "Use ▾" FEASIBLE-NOW: **Edit Image** (image-edit) + **Generate Video from image** (Seedance i2v 3101).
- NEEDS-BACKEND: Upscale (Magnific 1201 bor lekin enabled:false), Recreate/Variations (seed param yo'q).
- YO'Q (o'tkazib yubor): Music generation, Create Avatar.

### Artlist redesign REJA — 4 faza (birma-bir, sifat buzilmasin). USER: hamma 4 + vizual+funksiya.
- **FAZA A — Umumiy vizual til** ✅ **TUGADI** (commit 5482036, USER PUSH qildi → CF deploy). lime radial-gradient
  "spend" CTA (Get Pro/Download/Generate/Add credits) + active-tab shaffof-oq pill + chegarasiz content kartalar +
  radius(hero 24px)/tipografiya(h2 32/500) Artlist darajasida. ffm- (marketing) + ffa- + va- ga qo'llandi, ffl-
  landing TEGILMAGAN. Shared tokenlar: --spend-grad, --pill-active (.ff blokida). 1280+390 tasdiqlangan.
  ⚠️ KASHFIYOT (C/D uchun MUHIM): jonli app QOBIG'I `va-` tizimida qurilgan (top-nav, kartalar, tugmalar);
  `ffa-` faqat AI Studio composer/tab'larni boshqaradi; `ffm-`=marketing, `ffl-`=landing. Har fazada uchalasini
  hisobga ol — faqat ffa- ga tegish app ekranlarida NO-OP bo'ladi.
- **FAZA B — AI Studio chuqurlik** ✅ **TUGADI** (mockup 9ae16f9 → USER tasdiq → 2 qurish qadam).
  Mockup: platform/_aistudio-depth-mockup.html (6 freym: Visuals view+Use▾, Sparky progress, Audio, model modal,
  empty, mobil). QURISH-1 (commit 2c1b524, USER PUSH qildi): butun workspace port — chap sessiya rail(state.gens),
  Visuals|Audio toggle, yangi va- dock, Sparky mascot progress (syncGenAnim, 93% cap — tugash soxtalashtirilmaydi),
  model 2-bosqich modal (quick-pick + full modal, hammasi mavjud pickModel orqali), va-ax* klasslar. QURISH-2
  (commit 6a3768a, push KUTILMOQDA): Use▾ → Edit image + Generate video from image JONLI ulandi.
  ⭐ PUL-ZONA XAVFSIZLIK KALITI (kelajak refs ishlari uchun): cost-quote HMAC referens paramlarni HISOBGA OLMAYDI
  (lib/gen-quote.ts refs strip qiladi) → referens qo'shish imzoni buzmaydi. buildParams'ga faqat shartli 2 qator
  (edit: referenceUrl+referenceUrls; i2v: faqat referenceUrl, END_FRAME yo'q). generate/estCost/pollJob/quote/gen
  BAYT-BAYT o'zgarmagan. Referens = mavjud gen natija signed URL (genGet().assets[0].url — qayta yuklash SHART EMAS).
  Model tanlash: edit=refKind"image"/maxRefs>0, i2v=refKind"frames". Mobil dock ≤820px ixchamlashtirildi (paramlar
  mode-popover ostiga, hech biri yashirilmagan). Upscale/Variations hali "SOON" (backend kerak).
- **FAZA C — Home boyitish:** ✅ **TUGADI** (mockup b996076 → USER Option A tanladi → qurish 590cdbf, push YO'Q).
  Mockup: platform/_home-enrich-mockup.html (C1 desktop/C2 optionB/C3 mobil). QURISH (590cdbf, va- scope, additive,
  index.html jonli): Featured models = OPTION A ("Model of the week" spotlight + 2×2 rail, FFAPI.models real nom/narx,
  Try→AI Studio pickModel; mobil B-style 172px) · boyroq karta va-rc (16:9, hover scale+play+heart/download reveal,
  NEW<7d/PRO/FREE/4K badge, kategoriya meta; reduced-motion off) Recommended+javonlarga · 3 collection javon
  (loadCatalog data'dan: Trending[updatedAt proxy — download-count endpoint yo'q], «katta kategoriya» essentials
  [Lower Thirds afzal], New this week[createdAt<7d]) fade+arrow+View all. Newest sort qo'shildi. Pul-zonasi tegilmagan.
  TODO(FF): admin-tanlagan Model-of-week hook; Trending real download-count endpoint. 1280+390 lokal skrinshot mos, 0 konsol xato.
  ⚠️ USER: PUSH → CF deploy → getframeflow.app'da prod katalog dates/kategoriya/model bilan smoke-test.
- **FAZA D — Katalog + asset detail:** ✅ **TUGADI** (mockup e327bd8 → USER Option A masonry tanladi → qurish c80231f,
  main, push YO'Q, faqat index.html +213 additiv). Katalog = true masonry (.va-mas CSS-columns 4/3/2, va-rc karta,
  t.ar aspect; qidiruv/chip/facet/sort bayt-bayt saqlangan; playful loading). Detail boyitildi: stats qatori, 6-katak
  spec grid, spend Download CTA + "Open in AE" ghost + favorite(localStorage ff_tpl_favs)+share; related=rich karta
  (same-cat, bo'sh=yashirin); "Part of collection" strip (proxy=kategoriya, THIS ITEM lime, +N more, View collection).
  Mobil 390: 2-col masonry (reveal off), detail D3 tartibda. TODO(FF): real collection entity, download/fav count
  (DownloadEvent yo'q→UPDATED+size), share deep-link, masonry round-robin rank. 1280+390 lokal (9-item sintetik katalog,
  prod=1 shablon) tasdiq, 0 konsol/overflow. ⚠️ USER: PUSH → CF deploy → getframeflow.app real katalog bilan smoke-test.
  ⇒ ARTLIST WEB REDESIGN (A/B/C/D) TO'LIQ TUGADI 🎉

### Keyingi qadam (yangi chatda shu yerdan)
✅ BAJARILDI shu sessiyada: #DEV /device Google tugmasi fix (commit 5e8c0a5, kod'siz holatda form/or/tugma
yashirildi) · FAZA A (5482036, pushed) · FAZA B mockup+2 qurish (9ae16f9 / 2c1b524 pushed / 6a3768a push kutilmoqda).
👉 KEYINGI = **FAZA C — Home boyitish** (featured models qatori + collections qatorlari + boyroq kartalar).
   Boshda hal qil: Home strukturaviy o'zgarganligi uchun avval MINI-MOCKUP kerakmi (FAZA B'dagidek: mockup→USER
   tasdiq→qurish), yoki Artlist spec yetarlicha aniqmi. Model: Fable 5 +Extra. Faqat va- Home ekrani; ffl- landing
   TEGMA. Tugagach → **FAZA D** (Katalog masonry + asset detail). PUSH har doim USER qiladi.
⚠️ QARZ (push kutilmoqda): 6a3768a (FAZA B qurish-2). USER push qilsa CF Pages deploy → getframeflow.app smoke-test.

## ⭐⭐⭐ 2026-07-07 — KONTENT ZANJIRI AUDIT + HARDENING (avtorlar yuklashdan OLDIN 100% ishonch)
USER: 1-2 real avtor shablon yuklashga tayyor. Zanjir 100% ishlashini tasdiqla + bulk-zip + ko'p-dastur + preview fix.
3 parallel agent audit (backend/DB · plagin · platforma) — NATIJA:
· (1) YADRO ZANJIR (create→submit→approve→catalog→download+gate) = SOG'LOM ✅ (scan-gate, PRO tier, download limit to'g'ri).
  Rewrite KERAK EMAS (ishlayotgan narsani buzmaslik). Minor: web /catalog takedownAt'ni exclude qilmaydi (signed URL yo'q, zararsiz).
· (2) BULK-ZIP = YO'Q ❌ (eng katta bo'sh). Asset'lar bittalab yuklanadi (thumb/preview/pack alohida presigned PUT).
  Zip extraction faqat ichki .mogrt sahna + baked thumb chiqaradi (mogrt-extract.ts) — zip-root'dan preview IMAGE/VIDEO
  HARVESTLAMAYDI. Fix: storeMogrtScenesFromZip'ni kengaytir → zip-root preview.*/cover.* + *.mp4 topib canonical
  templates/{id}/thumb|preview key'ga yukla + transcodePreviewInBackground. Schema o'zgarmaydi (key-convention).
· (3) KO'P-DASTUR = QISMAN ⚠️. templateApp String @default("ae") schema'da BOR (enum yo'q), catalog→plagin→platforma
  uzatiladi. LEKIN: avtor selektori YO'Q (hamma "ae"ga default), Apple Motion HECH QAYERDA yo'q (faqat ae/pr/dr),
  pack ext AE-only (.aep/.zip/.mogrt — .prproj/.motn/.drfx bloklanadi!), catalog'da SERVER app-filter YO'Q.
  Plagin: templateApp uzatiladi lekin FILTER'da ishlatilmaydi → AE plagin HAMMA dastur shablonini aralash ko'rsatadi.
  Platforma: app badge + filter BOR (ae/pr/dr) lekin Motion yo'q; "Open in After Effects" hardcoded.
  Fix: enum(AE/PR/MOTION/RESOLVE) + upload selektor + per-app ext + catalog ?app= filter + plagin AE-only + UI map'larni kengaytir.
· (4) PREVIEW VIDEO: SAQLASH/SERVE = TO'G'RI ✅ (templates/{id}/preview.mp4, 720p H264 faststart transcode, Range/CDN).
  DISPLAY muammo: plagin CEF'da <video> qora kadr (afVideoThumb #t=0.1 seek fix faqat AI Recent'da, catalog render'da
  YO'Q — renderThumbMedia/renderPackHero/renderSceneCard); scene video poster'siz. Platforma: kartada video YO'Q (faqat
  thumb bg + dekorativ play ikonka), detail <video> preload=none+poster yo'q → qora. Fix: poster=thumbUrl + preload=metadata
  + plagin seek-technique port. ENV: CDN_BASE_URL prod'da bo'lsin (aks holda 24h signed URL).
DIREKTOR REJA — CP (Content Pipeline) 4 bosqich (rewrite EMAS, additive hardening): CP-1 ko'p-dastur poydevor
(enum+ext+upload selektor+catalog ?app filter+plagin AE-only+platforma Motion/Resolve) → CP-2 bulk-zip ingest
(1 zip=pack+preview img+video auto-populate+auto-title+scan+bulk-approve) → CP-3 preview display fix (plagin seek/poster,
platforma poster/preload, CDN env) → CP-4 end-to-end verifikatsiya (har dastur real zip bilan). Har biri alohida Code prompt.
⚠️ Agent'lar davom ettirish uchun: backend a243ae1b90403787b · plagin ae9794560c226d20c · platforma aea96df861d5fd496.

### ⭐ SAHNA (mogrt scene) MEXANIZMI CHUQUR-TAHLIL (USER: "juda yomon ishlayapti") — 2 agent (backend ad0d6fca0c9807bbb · plagin ae8dd07f95673932f)
HAQIQIY DIZAYN: contributor mogrt PACK (.zip ichида ko'p .mogrt = ko'p SAHNA) yuklaydi → AE'da HAM Premiere'да HAM
ochilishi kerak → plaginда user BITTA yoqqan sahnani tanlab import qiladi. AUDIT: bu ko'p qatlamli buzuq.
⭐⭐ ENG CHUQUR (arxitektura) MUAMMO: plagin .mogrt'ни .aep'ga AYLANTIRADI (extractMogrtFileToAep: mogrt zip'ini ochib
ichidagi .aegraphic→.aep ni topib import qiladi). Bu tubdan YO'QOTUVCHI:
  1. Essential Graphics parametrlar (matn/rang/slayder = mogrt'ning butun MAQSADI) TASHLANADI → user boshqaruvsiz xom comp oladi.
  2. Bundle shriftlar e'tiborsiz → noto'g'ri font. 3. Footage havolalar buziladi → missing-media.
  4. CROSS-APP (Premiere) YO'Q QILINADI — .aep Premiere'да ochilmaydi; cache'даги .mogrt hech qachon Premiere MOGRT
     papkasiga o'rnatilmaydi/ko'rsatilmaydi → "Premiere'да ham ochiladi" faqat YUKLANGAN format xossasi, plagin uni buzadi.
  5. COMP-NOM MOS EMAS (H1, eng kuchli funksional bug): scene.aeComp = mogrt capsule nomi, .aep ichki master-comp nomi
     EMAS → mos kelmaydi → noto'g'ri comp tanlanadi, va pruneToScene HAR DOIM yoqiq → qolgan hammasini O'CHIRADI →
     noto'g'ri sahna / yalang'och precomp / "Comp not found".
SERVER buglari: (a) poster-key mos emas: scenes/{slug}.png saqlanadi lekin catalog {slug}_thumb.png so'raydi → video
sahna POSTER'siz (qora kadr) + orphan png; (b) approve-recovery scan qiladi lekin SAHNA EXTRACT QILMAYDI → katta pack
Cloud Run timeout'да clean→APPROVED lekin metaJson.scenes BO'SH ("goh sahna bor goh yo'q" asosiy sababi); (c) scene write
all-or-nothing non-atomik → o'rtada o'lса orphan+sahna yo'q; (d) yalang' .mogrt (zip emas) = 0 sahna; (e) ichki fayl
nomi (thumb.png/thumb.mp4/definition.json) qat'iy taxmin — real mogrt'lar farq qiladi → preview yo'q/nom slug; (f) hamma
xato JIM yutiladi (diagnostika yo'q). PLAGIN buglari: scene <video> poster'siz + CEF H264 dekod cheklovi + signed-URL TTL
= qora kadr; mogrtUrl yo'q/404 (dangling mogrtKey)→JIM butun-pack fallback + MOGRT_PACK picker surprise; double-count
(downloadSceneMogrt recordDownload + importSingleScene recordImport = 1 amal 2 hisob → Free limit 2x tez); hasPack=false→
demo addLayer "✓ qo'shildi" SOXTA muvaffaqiyat.
DIREKTOR XULOSA: sahna mexanizmi = ARXITEKTURA qaydan ko'rib chiqilishi kerak (patch yetmaydi).
USER SYMPTOM (tasdiqlangan): (1) sahnalar browse'da chiqmaydi — FAQAT butun pack yuklab olingandan keyin ko'rinadi
(plagin lokalда extract qiladi) = server-side scene extraction ISHLAMAYAPTI (metaJson.scenes bo'sh); (2) import'да
matn/boshqaruv yo'q (mogrt→aep aylantirish EG'ni tashlaydi + noto'g'ri comp).
⭐⭐⭐ ARXITEKTURA QARORI (USER, 2026-07-08): CROSS-APP mogrt→aep AYLANTIRISH TASHLANADI. Har shablon BITTA dastur uchun,
TABIIY formatда: AE=.aep (to'g'ridan import, tahrirlanadigan, nom-taxmin yo'q) · Premiere=.mogrt (Essential Graphics'ga
tabiiy). Kontent ARALASH (5000: ba'zi AE, ba'zi PR) — har biri o'z dasturiga. Bu = CP-1 ko'p-dastur modeli + buzuq
konversiyani olib tashlash. NUANCE: AE uchun ASL .aep manba kerak (faqat eksport mogrt = Premiere kontenti).
YANGILANGAN REJA (SM = Scene Mechanism, CP-1 poydevor ustiga):
  SM-1 server scene extraction ISHONCHLI (pack=.zip ichида scene-fayllar: .aep[AE]/.mogrt[PR]; approve'да yo'q bo'lsa
       extract, atomik, yalang' fayl, poster-key fix scenes/{slug}.png vs _thumb.png, jim xato→diagnostika) → sahnalar
       katalogда pack yuklamasдан ko'rinsin; (2) per-scene preview zip'дан + qora-kadr fix.
  SM-2 AE NATIVE import: tanlangan sahna .aep'ni to'g'ridan import (real comp, tahrirlanadigan); mogrt→aep konversiya
       AE uchun O'CHIRILADI; comp-nom = real. SM-3 Premiere: .mogrt yuklab olish (hozircha qo'lда o'rnatish; native
       Premiere panel = alohida kelajak ish). SM-4 preview fix (poster/CEF/platforma). Double-count + soxta-success fix.
  Model: Fable/Opus. Birinchi build = CP-1 poydevor + SM-1. Premiere-native = keyingi alohida qaror.

### ⭐ KONTENT KIRITISH DIZAYNI (USER, 2026-07-08) — FTP + AI auto-metadata
USER XOHISHI: FTP yuklash. Har muallifга ALOHIDA papka (izolyatsiya). Ichида dastur bo'yicha (AE/PR/DR/…) tashlaydi.
Har zip = bitta shablon, ICHIDA image + video preview. → admin navbatiga tushadi → admin TASDIQLASA AI zip nomidan
(+ preview'дан tavsiya) avtomatik description + teg yozadi. App = subpapka/fayl-ext'дан auto (.aep→AE, .mogrt→PR…).
DIREKTOR e'tibor: (1) FTP = qo'shimcha infra — FTP server + har-muallif izolyatsiya/kredensial + INGEST WATCHER (yangi
zip'ni ilg'ab: validatsiya→MALWARE SCAN[majburiy, web bypass qilmasin]→preview extract→template "pending" yozadi).
(2) AI'ni zip NOMI + PREVIEW(vision) ikkalasidan qil (faqat nom zaif). (3) AI metadatani admin KO'RISHIDAN OLDIN
to'ldirish yaxshiroq (admin to'liq yozuvni ko'rib tasdiqlaydi) — lekin approve→AI ham ishlaydi (user qarori).
(4) LIGHTER ALTERNATIVA (ixtiyoriy): per-muallif cloud-papka (GCS prefiks) yoki bulk web-uploader — bir xil "ko'p zip
tashlash" tajribasi, kamroq infra. USER FTP'ни afzal ko'rsa — FTP quramiz.
⭐ YAKUNIY QAROR (2026-07-08): CLOUD BUCKET (GCS `incoming/muallif-id/`) + BRAUZER DRAG-DROP yuklovchi (FTP EMAS).

### ⭐ TO'LIQ SXEMA HUJJATI: docs/KONTENT-QUVURI-SXEMA.md (13 bo'lim + 6 faza — YAGONA MANBA)
6 faza: F1 AE native import(plagin) · F2 Cloud ingest · F3 AI metadata+admin bulk · F4 Font hal qiluvchi(plagin) ·
F5 multi-app · F6 miqyos. Parallel: F1(plagin)+F2(backend) to'qnashmaydi; F4/F5 plaginга tegadi→F1 bilan parallel EMAS.
FAZALAR PROGRESS:
- F1 AE native import: ✅ TUGADI (3 commit, push YO'Q, pul-zonasi tegilmagan). Sahna mexanizmi + mogrt→aep aylantirish
  OLIB TASHLANDI (renderSceneCard va h.k. unreachable dead-code qoldirildi, xavfsizlik uchun o'chirilmadi). Yangi
  importTemplateProject() [host.jsx]: butun .aep ni ImportAsType.PROJECT bilan bitta undo guruhда import, root folder'ni
  shablon nomiga rename, prune/nom-taxmin YO'Q → user AE Project panelidan komp tanlaydi. Preview <video> poster=thumb
  (qora-kadr yo'q, reduced-motion static). Double-count fix (recordDownload no-op, faqat recordImport). Soxta-success
  fix (pack yo'q→"No pack available", demo addLayer yo'q). Commit 49ef974(host)+ed888be(catalog)+6cda106(html).
  ⚠️ JONLI AE KERAK: install-cep.sh+restart → upload→approve→Sync→poster→Import→Project panelда komplar→Undo bitta→
  usage bir marta. F1+F2 endi birlashtirilib jonli sinaladi.
- F2 Cloud ingest: ✅ TUGADI (2 commit main, push YO'Q, pul-zonasi tegilmagan). POST /api/contributor/incoming/upload-url
  (presigned PUT) + POST /api/contributor/ingest (sinxron: per-zip malware scan→pack/thumb/preview extract→orientatsiya/
  res auto→ContributorTemplate PENDING→asl zip o'chadi; idempotent, bitta buzuq zip batch'ni buzmaydi) · download: xom
  .aep endi shablon-nomli .zip (on-the-fly, templates/{id}/pack.dl.zip cache; download-limit/paywall tegilmagan) · studio
  "Bulk upload (.zip)" mode (drag-drop, per-fayl progress/xato). Commit b1d0979(api) + 24410dd(studio).
  ⚠️ USER INFRA: (1) GCS bucket CORS incoming/ PUT uchun tasdiqla (gsutil cors set infra/gcs-cors.json gs://<bucket>);
  (2) yangi env yo'q (mavjud AWS_*/S3_ENDPOINT). JONLI TEST kerak: real .zip (aep+img+video) + contributor login.
  QARZ: malware scan tashqi zip'ni ochishdan OLDIN emas, extract qilingan .aep hash'ida ishlaydi (user ko'rib qaror qilsin).
- F3 AI metadata + admin bulk: ✅ TUGADI (2 commit, push YO'Q, pul-zonasi tegilmagan). (A) ai/template-metadata.ts
  generateTemplateMetadata() — zip nomidan (+ preview vision gemini-2.5-flash) toza title + FIXED ro'yxatdan 1 kategoriya
  (TEMPLATE_CATEGORIES 15 ta) + aniq 20 teg; ingest'даги TODO hook'ga ulandi; INTERNAL call (consumeAiCredits TEGILMAGAN);
  fail-safe (AI xato→filename title+Uncategorized+keyword teg, ingest bloklanmaydi). (B) POST /admin/templates/bulk —
  server loop, per-item natija, bitta buzuq batch'ni buzmaydi (approve+Free/Pro isPro / reject / clear-pack; karantin gate
  saqlangan); admin UI select-all+checkbox+bulk bar. commit e2ea930(AI)+83fa0b8(bulk). ⚠️ QAROR: TEMPLATE_CATEGORIES
  settings.categoriesJson (eski manual-upload/katalog filtr)дан ALOHIDA — filtr AI kategoriyalarини ko'rsatishi uchun
  moslash kerak (user aytса Code moslaydi). JONLI: Render deploy (real OpenRouter path) + e2e ingest teg tekshiruvi.
- F4 Font hal qiluvchi: ✅ TUGADI (commit d052248, push YO'Q, pul-zonasi tegilmagan). host.jsx ES3-safe: af_missingFontsFor
  Comps() import'дан keyin text-layer shriftlarини app.fonts.allFonts bilan solishtiradi (AE2024+; eski AE→false-positive
  yo'q). assetflow-catalog.js resolveMissingFonts() cascade: (1) Google Fonts /css custom-UA→TTF→~/Library/Fonts (Win reg
  ham) install; (2) Adobe Fonts 200→CC auto-activate (skript emas, user xabardor); (3) manual. Faqat ochiq-litsenziya font
  yuklanadi; har qadam try/catch, import buzilmaydi. UI afFontResolver panel (afConfirm style). Jonli endpoint test (Roboto
  install / Proxima→adobe / soxta→manual PASS). ⚠️ JONLI AE: 3 holatни AE'da tasdiqlash; Win reg faqat macOS'da sinaldi.
- F5 Ko'p-dastur: ✅ TUGADI (4 commit, push YO'Q, pul-zonasi tegilmagan). apps/api/src/lib/apps.ts YAGONA config APP_CONFIG
  (ae/pr/motion/resolve → label/fullName/packExts/color) + PACK_EXT_APP/appForPackExt; client mirror FF_APPS(plagin)/APP_L,
  APP_C(platforma); tarqoq {ae,pr,dr} literallar almashtirildi. Ingest 4 format aniqlaydi (.aep→ae/.mogrt→pr/.motn→motion/
  .drfx→resolve; noma'lum→rad, app-generic xato). Katalog ?app= filtri (plugin.ts /catalog+/featured; yo'q=hammasi, bor=
  templateApp predikat). PLAGIN faqat AE: fetchCatalog ?app=ae + getFiltered client fallback + 4 badge derivation ffAppInfo()
  orqali (motion/resolve to'g'ri, unknown→"Ae" emas). Platforma: badge/appFull 4 dastur + filtr ['All','Ae','Pr','Mn','Dr'] +
  detail CTA "Open in {{appFull}}". Build green, 10/10 ext mapping, JS parse clean. default 'ae' bayt-bir xil.
  TODO(FF): .moti/.dra/.setting real eksportda tasdiqlash. JONLI: ?app=ae faqat AE, .motn/.drfx ingest, platforma filtr/CTA.
  ⇒ FUNKSIONAL FAZALAR F1-F5 TUGADI. Qolgan: FAZA 6 (miqyos/mustahkamlash).
- F6a Ingest hardening: ✅ TUGADI (4 commit, push YO'Q, pul-zonasi tegilmagan). (A) zip xavfsizligi (ingest-zip.ts):
  ochiq hajm cap 5GiB (INGEST_MAX_UNCOMPRESSED_BYTES), siqish nisbati >1000 rad, entry ≤5000, zip-slip (../abs path→
  butun zip rad), stream (xotiraga yuklanmaydi, faqat 3 entry), qoidabuzar→o'chirilib template.ingest_rejected audit, batch
  davom etadi. (B) katta-fayl (contributor.ts): asset yuklash+finalize KOMPENSATSIYALI — bosqich yiqilsa shablon+yarim
  asset o'chadi, incoming zip retry uchun qoladi ("No files" yarim-shablon YO'Q); pack GCS hajm lokal bilan solishtiriladi;
  fileSize=to'liqlik markeri (yarim yozuv retry'da tozalanib qayta ingest — "Already ingested" maska tuzatildi). (C) duplicate:
  o'sha contributor bir xil pack hash→status:"duplicate"+duplicateOf (cross-contributor anti-theft karantin o'zgarmagan);
  har zip created/duplicate/failed(reason); Studio UI duplicate amber ⊘. (D) retention: success/dup/reject'da incoming o'chadi,
  DELETE'da deleteTemplateAssets bor. Guard testlar PASS (slip/bomb/oversize toza rad). Docs: INFRA-INGEST-RETENTION.md.
  ⚠️⚠️ USER INFRA (753MB asl sababi!): Cloud Run /tmp=tmpfs(xotira), ingest cho'qqi ≈2× zip → gcloud run services update
  assetflow-api --memory=4Gi --cpu=2 --timeout=900; + GCS incoming/ 7-kun lifecycle (hujjatda JSON+buyruq). JONLI: infra'dan
  keyin 753MB qayta yuklash + duplicate ⊘ + lifecycle.
- ⚡ STREAMING INGEST (USER tanladi variant-b, commit e9dd927, push YO'Q): ingest endi zipni UMUMAN yuklab olmaydi —
  ranged GET bilan EOCD/central-dir o'qiydi (zip64+comment), yauzl.fromRandomAccessReader, faqat 3 entry bucket→bucket
  oqim (uploadStreamToS3 ~32MB peak). Pack 2 marta stream: pass1 sha256(dedup), pass2 upload (oralikda zip almashsa toza
  xato). F6a xavfsizlik EOCD'dan OLDIN (entry-count/slip/hajm/ratio central-dir metadatada). NATIJA: 762MB zip→167MB peak
  RSS (avval ~1.5GB), xotira zip hajmidan MUSTAQIL. ⇒ 4Gi MEMORY BUMP ENDI SHART EMAS (default 512Mi-1Gi yetadi), LEKIN
  --timeout=900 QOLSIN (pack 2 marta tarmoqdan o'tadi → uzunroq). Istisno: preview ≤64MB tmpfs'ga tushadi (AI meta+ffprobe
  lokal fayl talab qiladi). Jonli GCS ranged test byte-exact PASS, build green. JONLI: push+deploy→Studio'dan katta zip.
  ⇒ QOLGAN: F6b (muallif ro'yxatdan o'tish + admin rol + login dev-leak) → kontent quvuri TO'LIQ.
- F6b Muallif onboarding + admin rol + dev-leak: ✅ TUGADI (4 commit, push YO'Q, pul-zonasi tegilmagan). (A) leak olib
  tashlandi (96575c1): login.html SQL footer + admin-login.html "set role=ADMIN in DB" o'chirildi (endi "granted by an
  existing administrator"); README + studio:sync + dist toza (faqat docs/UI-UX-REVIEW.md tarixiy qayd qoldi). (B) rol
  boshqaruvi (69d39a5): admin.ts requireAdmin ostida GET /admin/users (qidiruv/filtr/pending) + PATCH /users/:id/role
  (USER/CONTRIBUTOR/ADMIN, last-admin tranzaksiya himoyasi, user.role_change audit) + DELETE contributor-request; yangi
  "Users & roles" admin ekran (pending karta Approve/Dismiss, rol dropdown+modal, nav badge). ⚠️ TOPILDI: eski himoyasiz
  PATCH /users/:id/role (guard/audit yo'q) yangilarini soyalab turgan ekan → OLIB TASHLANDI. (C) onboarding (d3f33e5):
  User.contributorRequestedAt (additive migr) + POST /users/contributor-request (idempotent, audit); USER login.html'da
  "Request contributor access" paneli, admin tasdiqlaydi. Lokal jonli PASS (request→approve→CONTRIBUTOR, last-admin 409,
  non-admin 403, audit yozuvlar). ⚠️ USER: push→migrate:deploy (contributorRequestedAt) + prod smoke-test + CF kesh.
  ⇒⇒ KONTENT QUVURI F1–F6 TO'LIQ TUGADI 🎉 (native import · cloud ingest · AI metadata · font · multi-app · streaming+hardening · onboarding/rol).

### ⭐ ZANJIR MIQYOS + KORREKTLIK AUDIT (2026-07-08, 2 agent: backend a85e3c08 · client aca24c05) — "5000 shablonni ko'taradimi?"
XULOSA: yadro MUSTAHKAM, LEKIN hozircha 5000 shablonni KO'TARMAYDI — katalog serve qatlamida kritik nuqsonlar + 1 ko'rinadigan bug.
🔴 KRITIK (bulk'dan OLDIN shart):
  1. KATALOG PAGINATSIYASIZ (plugin.ts:102 /catalog — take/cursor YO'Q, unauth) + har shablonga 2 S3 call (catalog-map.ts:180
     listTemplateS3Keys ListObjectsV2 + :186 HeadObject) unbounded Promise.all → 5000 shablon=~10k S3 call bitta so'rovda →
     yiqiladi + DoS. ENG KATTA. 2. ADMIN navbati (contributor.ts:448 /templates) HAM paginatsiyasiz + 3× HeadObject/item
     (s3.ts:298) → admin qotadi. 3. INGEST cross-request concurrency limit/queue YO'Q + 50-zip serial batch vs 600s timeout
     + tmpfs probe ≤128MB → ko'p katta zip bir vaqtda=OOM. 4. .aep→.zip download 2× pack RAM'ga buferlanadi (serve-asset.ts:34,
     tmpfs) → katta pack OOM (birinchi download'да; keyin cache).
🟡 O'RTA: 5. bulk-approve pending pack inline re-scan (contributor.ts:2229)→200 item timeout. 6. CDN_BASE_URL prod'da
  o'rnatilganini TEKSHIR (render.yaml:39 sync:false) — bo'sh bo'lsa preview 24h signed→muddат→QORA. 7. video-only preview
  poster/thumb yaratmaydi (contributor.ts:1651) → poster'siz. 8. transcode fire-and-forget CPU-throttle→pending qotishi.
🔴 KO'RINADIGAN BUG: 9. WEB DETAIL hero <video> poster YO'Q + background:#000 (index.html:15853) → play bosilmaguncha QORA
  to'rtburchak. (Plagin posterlari + web GRID OK; faqat web detail.) Fix: poster={{detail.thumbUrl}}.
🟢 TOZALASH: 10. plaginда o'lik sahna kodi (renderSceneCard html:5902 chaqiruvsiz + scene-vid poster'siz; eski
  importSingleSceneToAE yo'li hali reachable, timeline side-effect divergent). 11. web download shablon-nomli emas
  (a.download=''), "Download pack (.zip)" .aep bilan mos emas. 12. signed thumb/preview uzoq-ochiq panelда re-sign yo'q→403 xavfi.
✅ MUSTAHKAM: streaming ingest + zip-bomb/slip guard + 2-pass hash dedup + partial-fail compensation; download paywall
  (fail-closed, atomik consumeDownload, 300s signed); direct-CDN preview + cache-bust; plagin native import + ES3-safe +
  font resolver + multi-app (3-way) + no-fake-success + double-count fix + plagin posterlar; web multi-app filtr.
⇒ KEYINGI: FAZA 7 (miqyos-hardening): katalog+admin PAGINATSIYA + N+1 yechish (S3 flaglarni DB'ga yoki batch/cache) +
  ingest concurrency limit + streaming .aep-zip download + bulk-approve async scan + web-detail poster + kichik tozalash.

### ⭐ BIZNES-MANTIQ + KO'RINISH AUDIT (2026-07-08, 2 agent: download/limit a5605f2b · visibility ad333456) — "download/limit/ko'rinish to'g'rimi?"
✅ MUSTAHKAM: FREE limit server-side FAIL-CLOSED race-safe (consumeDownload guardDownloadable ichida, atomik updateMany
  downloadsMonth<limit; web+plagin BIR xil gated route /assets/:id/pack; localStorage tier bypass yo'q; Pro/Studio count-no-block;
  oylik reset atomik). Earnings ledger idempotent (ContributorEarning.downloadEventId @unique). Contributor/admin uploads
  (single+bulk) to'g'ri status bilan ko'rinadi; bulk owner incoming/ prefix=JWT (cross-attribution yo'q); download/import
  count REAL event'dan (forgeable Int emas); admin earnings/payout real event'dan (forgeable emas).
🔴 HIGH — EARNINGS FARMING: grantContributorEarning downloader≠contributor tekshirmaydi (earnings.ts:32) + TemplateDownloadEvent
  @@unique(userId,templateId) YO'Q → o'z shabloningni qayta-qayta yuklab o'zingga pul. PRO/STUDIO unlimitedDownloads→CHEKSIZ
  self-payout; FREE 15/oy=$1.50. + download email-verify GATED EMAS (AI krediti gated) → sybil throwaway har biri $1.50/oy.
🟡 MEDIUM: (a) ADMIN/test download ham earning yozadi (plugin.ts:305 recordTemplateDownloadEvent guard skip'дан keyin ham fire)
  → contributor balans shishadi. (b) CONTRIBUTOR karantin/dublikatni KO'RMAYDI — duplicate/quarantined pack "Pending" bo'lib
  ko'rinadi (contributor-views.js:172), lekin admin "Duplicate—cannot approve" (blok) → shablon JIMGINA hech qachon chiqmaydi
  (eng user-impact nomuvofiqlik). (c) CONTRIBUTOR EARNINGS UI YO'Q — /contributor/earnings endpoint bor lekin chaqiruvchi yo'q,
  payout karta "Coming soon" disabled → contributor daromadini ko'rolmaydi.
🟢 LOW: web download source:"plugin" deb yozadi (analytics); admin overview Pro/Free REMOVED'ni qo'shadi (Subscribers sahifasi
  chiqaradi)→nomuvofiq; "Active subscribers"=7-kun-seen (status active emas); "Total downloads" PluginProfile agregati
  (per-template TemplateDownloadEvent'dan drift bo'lishi mumkin, recordEvent best-effort swallow). INFO: birinchi import 1
  download + 1 import (2 limit) yeydi — mahsulot qoidasига mosligini tasdiqla.
⇒ FAZA 7'ga QO'SHILADI (pul-abuse + ko'rinish): self/admin/repeat-download earning fix (self-check + @@unique/daily-cap +
  email-verify gate); contributor'ga scan-status badge; contributor earnings UI; admin count moslash. BULAR PUL-ZONA — ehtiyot.

### ⭐⭐⭐ PROAKTIV RED-TEAM AUDIT → docs/THREAT-REGISTER.md (2026-07-08, USER: "o'zing topib tekshir")
3 agent (iqtisod affe2fbe · kirish a647af9c · kontent/resurs a07a9334). YADRO KUCHLI (auth/tokenVersion/IDOR/webhook/
kredit-ledger/zip-guard/SSRF solid). QOLGAN abuse teshiklari THREAT-REGISTER.md'да to'liq. TOP: H1 earning farming
(self+ratelimit+unlimited-plan) · H2 malware-scan bypass (/assets skansiz→null gate'дан o'tadi) · H3 pending/null pack
download bo'ladi · H4 katalog unauth+paginatsiyasiz+S3-fanout DoS · H5 contributor route rate-limit yo'q · H6
COST_QUOTE_SECRET→JWT fallback warning · H7 cap in-memory+ceiling opt-in fail-open · H8 ceiling under-count · M1 register
self-CONTRIBUTOR approval bypass · M2 legacy role endpoint (last-admin/audit yo'q) · M3 multer pre-auth disk yozuv · M4
auto-approve scan skip · M5-9 kredit multi-acc/ref-quota/admin-earning/scan-badge/earnings-UI. YOPISH REJASI (registrда):
1 pul-abuse · 2 skan/moderatsiya gate · 3 DoS/miqyos(=F7) · 4 onboarding/rol · 5 ko'rinish+fail-open env checklist.
  ⇒ QOLGAN: F6b (muallif ro'yxatdan o'tish oqimi + admin rol boshqaruvi + login dev-leak) → kontent quvuri TO'LIQ tugaydi.
- ⚡ F1 JONLI TEST natija (2026-07-08): ZANJIR ISHLADI — bulk upload→ingest→admin pending→approve→katalog→plagin
  hammasi jonli tasdiqlandi. Preview extraction ISHLAYDI (Glitch Transitions thumb chiqdi; Cyberpunk zip'ida rasm yo'q edi).
  Karantin gate ishladi (Clear pack→Approve). Plagin poster fix ishladi (qora emas). BUG topildi+TUZATILDI: host.jsx:2006
  .trim() ExtendScript(ES3)да yo'q→import "String().trim is undefined" bilan yiqilardi → String.prototype.trim polyfill
  qo'shildi (commit dba320b). ⚠️ .trim fix'дан keyin AE import qayta sinovi KUTILMOQDA (user).
  KUZATUV: 753MB zip ingest UI statusи chalkash (Processing→Already ingested); asset saqlash to'liq tugadimi tasdiqlanmadi
  ("No files/FILE SIZE —" Cyberpunk'да — preview yo'qligidanmi yoki katta-fayl storage uzilishidanmi — Import sinovi ko'rsatadi).

## ⭐ 2026-07-07 — YANGI THREAD: Mister Horse Composer MEXANIZM-tahlili (keyingi hisobda SHU)
> USER TALABI (MUHIM): UX/UI KERAK EMAS (FrameFlow UI tayyor). Faqat **MEXANIZM** kerak — "qanday ishlaydi,
> ostida nima bo'ladi" — texnik ostki qatlam. Direktor keyingi hisobda buni CHUQUR tahlil qilish uchun
> Code'ga MEXANIZM-ONLY prompt yozishi kerak (UX/UI TASHLAB).

### NISHONLAR (read-only; 3-tomon kengaytmasini O'ZGARTIRMA; kod ko'chirMA — mexanizm/naqsh o'rgan)
- **ASOSIY (AE-native, FrameFlow bilan 1:1 muhit):** `/Users/usmonov/Library/Application Support/Adobe/CEP/
  extensions/com.misterhorse.AnimationComposer` (host .jsx TO'LIQ o'qi + native layer + React bundle stringlari).
- **IKKINCHI (referens, allaqachon Direktor o'qigan):** `/Library/Application Support/Adobe/CEP/extensions/
  com.misterhorse.PremiereComposer` (host/loader_mhac.jsx — mexanizmlar quyida).
- Boshqa foydali AE exts (kelajak refs, majburiy emas): Motion Factory (marketplace/import), Motion Bro/
  MotionBro3 (preset apply), PowerFXStudio (SFX), com.aa-power.stock.cep (stock). Higgsfield (AI) ALLAQACHON
  tahlil qilingan → docs/HIGGSFIELD-ANALYSIS.md.

### MEXANIZMLAR (Direktor PremiereComposer kodidan aniqladi — Code chuqurlashtirsin, qayta kashf qilmasin)
1. **Nishonga joylash (placeholder→replace):** setFromMHBricks treklarni skanlab `.mhbricks` klipni topadi →
   [trek,klip,vaqt] yozadi → removePlaceholderBricks → importMGT(path,time,vTrack,aTrack) aynan o'sha joyga.
   AE-EKVIVALENT (FrameFlow): faol comp → tanlangan layer/null(placeholder) → uning index/inPoint/position ol →
   pack `.aep`/precomp importFile → comp'ga o'sha o'rin/vaqtga joyla.
2. **Avtomat masshtab:** duplicateMogrtWithSize(path,out,seqW,seqH) + ensureCorrectMogrtScale. AE: scale=comp/source
   → layer.transform.scale.
3. **NATIVE ko'prik (eng muhim ishonchlilik):** initMHExtObj + MHPC_ExternalObjectBundle.bundle (ExtendScript
   ExternalObject native lib) + MHPC_NativeHelper.app (download) + node adm-zip (unzip). → FrameFlow'ning
   "hasPack"/katta-fayl muammosini node child_process+adm-zip (yoki native helper) bilan yechish.
4. **Lokal kutubxona index:** pack'lar diskda, panel fast-readdir bilan indekslaydi → tez/offline.
5. **O'z narsasini tanish (tagging):** isMHClip = nom regex + MGT matn xossasi; nomga "by Mister Horse".
   FrameFlow: import qilingan layer/comp'ni marker/label/nom bilan tamg'ala.
6. **Undo guruh:** undoGroups.start/end → AE: app.beginUndoGroup/endUndoGroup.
7. **Davomiylik/trim:** mogrt maxDur → setClipOutPoint. AE: comp dur/marker → layer.outPoint.
8. **Editable param:** getMogrtInfo/getAeGraphicParams/mogrtApplyLastUsedFont → import'dan keyin matn/rang/shrift
   programma orqali sozlash.
TOP-3 FrameFlow uchun: (1) nishonga joylash (2) avtomat masshtab (3) native download/unzip.

### ✅ BAJARILDI (2026-07-07) — APPROVE BUG (pack-scan "pending") TUZATILDI (2 commit, main, push YO'Q, pul-zonasi tegilmagan)
Muammo: pack skan res.json()'dan keyin fire-and-forget → Cloud Run javobdan keyin CPU throttle → skan hech qachon
tugamaydi → packScanStatus="pending"da qotadi → approve gate 409 "still running" → HAR upload bloklanadi.
FIX1 (contributor.ts:1752): approve gate "pending" ko'rsa — skanni O'SHA ZAHOTI sinxron hal qiladi (re-download+
sha256+malware+verdict→status+DB), keyin normal gate. Clean→approve; malicious/quarantined/duplicate→409. Skan xato
bo'lsa fail-safe (pending qoladi, 409 "Clear pack ishlat", crash yo'q). FIX2 (studio js/, sync): mavjud pack-clear
endpoint admin UI'ga ulandi — StudioApi.clearPack + modClearPack + xavfsizlik-sabab banner + "Clear pack (security)"
tugma 3 joyda (Overview queue/Moderation detail/drawer); faqat pending/quarantined uchun (malicious/duplicate hard-block
qoladi). packScanStatus/Detail clientga uzatildi. FIX3: upload handler endi pipeline'ni res.json()'dan OLDIN await
qiladi (status pending'da qolmaydi + .zip extraction tugaydi); verdict→status = shared classifyPackScan/resolvePackScan.
Cloud Run throttle gotcha comment qo'shildi. Build green, node --check 5 fayl, studio:sync. Semantika saqlangan.
⚠️ USER: (1) API Cloud Run + Studio CF Pages DEPLOY (push). (2) Deploy'dan keyin tiqilgan shablon O'ZI ochiladi (Approve
on-demand resolve YOKI yangi "Clear pack" tugma). (3) Ixtiyoriy infra: --no-cpu-throttling/min-instances≥1 (kod endi
bunga tayanmaydi — kelajak uchun). Eslatma: juda katta pack (100MB+) skanini await qilish pack-uploaded so'rovini
uzaytiradi (Cloud Run timeout 300s default qoplaydi; FIX1/Clear pack = safety net).

### ✅✅ BAJARILDI (2026-07-07) — 3 IMPORT MEXANIZMI QURILDI (4 commit, main, push YO'Q, pul-zonasi tegilmagan)
USER qarori: Mister Horse'dan FAQAT 3 mexanizm ko'chirildi (native C++/WebSocket YO'Q, .ffx YO'Q, editable-panel YO'Q).
1. Avto-masshtab (a565c72, host.jsx): afComputeFitScale (contain/fill/width/height + 0/NaN/Inf guard+clamp) +
   afScaleLayerToComp (sourceRectAtTime kontent-chegara, faqat ADBE Scale, hech qachon throw qilmaydi) +
   afAutoscaleSelection. addSceneCompToTimeline'ga ulandi (default contain, mavjud undo guruh ichida). Metadata
   fit-hint agar bor bo'lsa o'qiydi; // TODO(FF) contributor upload hint uchun qoldirildi.
2. Ishonchli yuklab-olish/unzip (fe9f0f5, assetflow-catalog.js): atomik .part→rename, streaming sha256
   (200MB xotira-xavfsiz, opts.expectedSha256 bo'lsa tekshiradi/mos kelmasa o'chiradi, yo'q=.sha256 sidecar),
   cacheValid (hash-aware idempotent), robust unzip (non-zero exit throw + bo'sh-extract guard + status toast).
   // TODO(FF): expected hash from catalog (backend maydon o'ylab topilmadi).
3. Oddiy joylash + self-tag (6caa5be, host.jsx): layer tanlanган bo'lsa=drop target (inPoint+index moveBefore,
   target O'CHIRILMAYDI — native placeholder-scan YO'Q); aks holda playhead (eski xatti-harakat). afTagImportedLayer
   (comment+yashirin marker+rang label)/afIsFrameFlowItem. Import+joylash+masshtab+tag = BITTA undo (tasdiqlangan).
   + docs commit c9828f4 (SESSION-REPORT).
Offline tekshirilgan: fit-math/sha256/atomik-rename scratch testlar PASS; real downloadUrlToFile integration test
(lokal HTTP server) PASS; node --check ikkala fayl; har commit faqat o'z faylига tegdi.
⚠️ JONLI AE TEST KERAK (install-cep.sh + AE restart): avto-masshtab turli shablonда (to'liq-kadr scene OK, qisman
kontent=lower-third kattalashadi→shu yerда contributor fit-hint kerak); joylash (tanlangan-layer vs playhead +
opt-in position-recenter default OFF); panel'да yuklab-olish/unzip progress ko'rinishi. Frontend cfg hali
fitMode/inheritPosition/expectedSha256 YUBORMAYDI — host himoyalangan o'qiydi → UI kontrollari + katalog hash
maydoni = tabiiy keyingi qadam (jonli AE tasdiqидан keyin).

### ✅ BAJARILDI (2026-07-07) — MEXANIZM-tahlil TUGADI (commit 397a90e, main, push YO'Q)
Natija: docs/COMPOSER-MECHANISM-ANALYSIS.md (mexanizm-only, UI'ga tegilmadi).
⭐ ENG MUHIM TOPILMA (tahlilni o'zgartirdi): AE Animation Composer ExtendScript kengaytmasi EMAS — u
**native C++ AEGP plagin** (AnimationComposer4.plugin, CFBundlePackageType=AEgx, JUCE + libwebsockets) bo'lib,
AE protsessi ichida **localhost WebSocket JSON-RPC serveri** ochadi. CEP paneli import/joylash/masshtab/undo
uchun evalScript ishlatMAYDI — u ws://localhost:<port>/api ga ulanadi (subproto api.ac.misterhorse.com),
portni api_<sha256(hostPath)[:8]> faylidan o'qiydi (diskda tasdiqlandi: api_64b09027→{"port":56008}, lsof=AE).
mh-browser-aeft.jsx faqat registerPlugin("mh_ac")+enumerateFonts qiladi.
Premiere Composer = klassik ExtendScript naqsh (loader_mhac.jsx + ExternalObject MHPC_ExternalObjectBundle.bundle
+ MHPC_NativeHelper.app + node adm-zip; setFromMHBricks/removePlaceholderBricks/importMGT/duplicateMogrtWithSize/
ensureCorrectMogrtScale/isMHClip zanjiri TO'LIQ o'qildi — CONFIRMED).
FrameFlow XULOSA: AE native yo'lini takrorlash = kompilyatsiya+kod-imzo+notarizatsiya (nomutanosib) → AMALIY manba
= Premiere ExtendScript naqshi; native AEGP = "ishonchlilik oltin standarti" sifatida qayd. Dalil-asosli:
• Avto-masshtab (CONFIRMED): bir martalik set EMAS — ADBE Scale'ga ulangan "// MISTER HORSE - AUTOSCALE RIG"
  ifodasi (sourceRectAtTime bilan kontent-bounds fit; to'liq ifoda matni binardan olindi).
• Self-tag (CONFIRMED): AE yashirin marker param zzzz..._ACPrecompMarker; Premiere /mister horse/i regex + suffiks.
• Yuklab olish/unzip: FrameFlow allaqachon to'g'ri asosda (child.execFileSync("unzip")+require("fs") = MH adm-zip);
  tavsiya: atomik yozish + sha256 + progress + spawn.
Deliverable: xulosa jadval + 8 mexanizm (a)qanday ishlaydi/(b)FrameFlow ekvivalenti (ExtendScript/node eskiz) +
native-bridge deep-dive + 3 additiv PR build order + 5-punkt "jonli AE tekshiruvi kerak" (asosan native C++ ichidagi
aniq placement-target logikasi — diskdan o'qib bo'lmaydi).
⚠️ QARZ: 397a90e unpushed (analiz hujjati, kod o'zgarishi yo'q — push shart emas; USER xohlasa).
👉 KEYINGI qaror USER'niki: (A) build-order top-3 (placement/scale/native-unzip) ni FrameFlow host.jsx+katalogga
qurish prompti, yoki (B) Artlist FAZA C (Home boyitish)ga qaytish.

---

## ⭐⭐ 2026-07-05 — ENG SO'NGGI HOLAT (YANGI HISOBDA SHUNDAN DAVOM ET)
> Foydalanuvchi 2-hisobga (Max) o'tdi. Desktop LOKAL Code (AE + skrinshot + unpushed kod ko'radi).

### TUGAGAN / JONLI
✅ Bosqich 1 (xavfsizlik) + 2 (huquq/moderatsiya) — jonli. ✅ Bosqich 4 (download event/payout/storage/topup-fix).
✅ To'lov: LEMON SQUEEZY integratsiya (checkout+webhook+STUDIO tarif) — deployed TEST mode. ✅ Kredit bug fix
(yangi user 50). ✅ Admin 5a (shell+Dashboard+Moderatsiya port). ✅ BOY LANDING Variant B port (index.html).
ENV TO'LIQ (cloudrun-env.yaml): VirusTotal, COST_QUOTE_SECRET, LS API/STORE_ID=424428/WEBHOOK_SECRET,
STORAGE Free1/Pro5/Studio20 GB, CONTRIBUTOR_PAYOUT_PER_DOWNLOAD_CENTS=0 (payout=qo'lda), Turnstile/Resend/
PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false — hammasi to'g'ri.

### KUTAYOTGAN PROMPTLAR (berilgan, ishlatilmagan bo'lishi mumkin)
- NARX DVIGATELI + monitoring (Opus) — ModelPricing DB, cost DB'dan, margin, admin /api/admin/pricing
  endpointlar, margin-alert + reconciliation. = QOLGAN Bosqich 1.
- Landing Variant A hero toggle (?hero=a/?hero=b, Fable 5) — user A'ni ham sinamoqchi; g'olibni qoldiramiz.

### QOLGAN ISHLAR — 3 KONSOLIDATSIYALANGAN BOSQICH (maksimal birlashtirilgan)
1. PUL DVIGATELI (backend): narx dvigateli + monitoring [prompt berilgan, Opus].
2. ADMIN TO'LIQ (UI): mavjud ekran port (5b Shablon/Contributor/Obunachi + 5c Tarif/Xabar/Analitika/Sozlama/Log)
   + yangi biznes ekran + backend ulash (Moliya dashboard/Narx UI↔dvigatel/payout=download soni/sarf/faoliyat).
   Manba: admin/_admin-redesign-mockup.html. adx- scope. admin/index.html+root js/+styles/=MANBA, studio:sync.
3. YAKUNIY: miqyos (Neon pooling/N+1/Redis/deploy-safety) + rebrand (AssetFlow→FrameFlow/manifest/domen) +
   polish (Content-Disposition/voice/skeleton) + landing A-vs-B g'olib yakunlash.

### OPERATSION (kichik)
- Pro narx = $19 (HAL: LS $19; marketing $24 edi — fix kerak agar $19 desa). To'lovni JONLI TEST (test karta).
- LS jonli pulga: identity "In Review" → tasdiqlangach → LIVE kalitlar. PUSH: landing+admin 5a+narx (commit'lar unpushed).
- BIZNES MANTIQ: Pro $19 = 1000 AI kredit (qimmat, cheklangan) + cheksiz shablon (arzon). Marja hozir ~1.3-1.5x
  (2x'dan past) → narx dvigateli tuzatadi. Contributor payout = faqat download soni, admin qo'lda tarqatadi.

## AUDIT FAZALARI HOLATI (docs/AUDIT-2026-07-02.md)
- Faza 1 (launch-blokerlar): ✅ TO'LIQ (pack presigned, CDN fix, migrate gate,
  admin XSS, forgot-pw, abuse).
- Faza 2 (pul-yo'qotish): ✅ TO'LIQ (2.2 author, 2.3 refund cap+idempotent,
  2.4 admin audit, 2.5 PRO gate 402, 2.6 CreditLedger+ProviderSpend). Migratsiya
  `20260703140000_faza2_ledger_refund` — deploy'da avtomat qo'llanadi.
- Faza 3/4/5: hali qilinmagan (4 dizaynga singadi).

## KONVENSIYALAR (buzma)
- Studio: faqat root `js/`+`styles/` edit; artefakt qayta yoziladi.
- Migratsiya faqat additive. `Co-Authored-By` YOZMA (deploy bloklaydi).
- Commit qil, push QILMA — foydalanuvchi GitHub Desktop'dan o'zi push qiladi.
- Foydalanuvchi HAR Code vazifasidan keyin Code chatini /clear qiladi → har prompt
  self-contained bo'lsin.
- Plagin dizayn ishi = LOKAL Code (AE test kerak). Test kerakmas backend = brauzer
  Code (claude.ai/code) ham bo'ladi, lekin faqat push qilingan kodni ko'radi.

## OCHIQ ESLATMALAR
- Un-pushed lokal commitlar yig'ilishi mumkin — qulay paytda push (plagin deploy
  bo'lmaydi, lekin Faza 2 API/CF deploy bo'ladi → push'dan keyin smoke-test).
- Panel yuqori-chapida hali "AssetFlow" yozuvi (AE extension nomi, CSXS manifest)
  — rebrend Faza 5'da.

---

## 2026-07-04 — SESSIYA HOLATI (yangi hisobда SHUNDAN DAVOM ET)

> Foydalanuvchi yangi hisobga (Max tarif) o'tdi. Desktop (lokal) Code'ni Max hisobiga
> login qilib, hamma ishни shu yerда davom ettirish tavsiya etildi (desktop kuchliroq:
> AE test + skrinshot + push qilinmagan lokal kodни ko'radi). Brauzer Code faqat
> push qilingan kodni ko'radi va AE/dizayn qila olmaydi.

### Qayerdamiz (qisqa)
- ✅ TUGADI: Home + Katalog a1–a7 (Pillar A) + AI Tools b1–b12 (Pillar B) + 2 tuzatish sweep.
- 👉 KEYINGI: **Hisob g1–g3** (dizayn yakuni, LOKAL Code — AE kerak). Prompt pastda.
- ⏳ KEYIN: **API-correctness audit** (backend, pul-zonasi). Prompt pastda. Brauzer Code'да ham bo'ladi.
- Barcha commitlar LOKAL, PUSH QILINMAGAN. Push CF Pages+API deploy'ни ishga tushiradi
  (CSP fix jonli bo'ladi — yaxshi) → push'дан keyin `/health` + `/api/plugin/catalog` smoke-test.

### Ochiq eslatmalar (bu sessiyada aniqlangan)
- Infra HAQIQATi: faol AI modellar VERTEX'да (Imagen, Nano Banana, Veo, Gemini Omni),
  fal ZAXIRA/dormant. fal hujjatlari repoда (docs/FAL-DOCS-*). Vertex uchun haqiqat =
  adapter kodi (apps/api/src/lib/ai/vertex-*.ts).
- Bottom-sheet QARORI: foydalanuvchi pastdan chiqadigan menyu/sozlamani YOMON KO'RADI.
  Hamma joyда: kichik menyu/picker = anchored popover (.sheet.pop + positionPopover),
  katta panel (Katalog filtri, MOGRT, limit/PRO, hisob, publish, trim) = MARKAZIY modal.
  Bottom-slide idiomi butunlay olib tashlangan. Mockup g3'ни ham bottom-sheet EMAS,
  markaziy modal ичida qilish kerak.
- GCS bucket CORS qo'llangan (upload ishlaydi). infra/gcs-cors.json + infra/GCS-CORS.md.

### TAYYOR PROMPT 1 — Hisob g1+g2+g3 (dizayn yakuni, LOKAL Code, Fable 5 + Extra)
> Mockup: _frameflow-redesign-mockup.html g1 (~1708), g2 (~1787), g3 (~1816).
> Mavjud: #accountSheet (openAccountSheet ~4273), #lrOverlay + login (~4261),
> #publishSheet (openPublish ~4502, publishScan/#pubName/#pubCat/#pubTags/#pubDesc).
> Vazifa: g1/g2/g3 ni mockupга 1:1 reskin, MANTIQNI SAQLAB (login/logout/plan/folder/
> theme/publish scan-scene-meta). g3 = MARKAZIY modal (bottom-sheet emas, FIX H bilan).
> Har ekran alohida commit. Verbatim hex/px, inline-SVG, lokal shrift, CDN yo'q, 380/900px
> tekshiruv (cep-plugin-preview harness). MAVZU (theme) uchun: mavjud theme engine bo'lsa
> ulang, bo'lmasa Standart faol + qolgani // TODO. Oxiriga standart commit/summary satri.

### TAYYOR PROMPT 2 — API-correctness audit (backend, Fable 5 + Extra)
> Fayllar: gen-models.ts, studio-gen.ts, gen-quote.ts, gen-processor.ts,
> ai/vertex-image.ts, ai/vertex-omni.ts, ai/vertex.ts, ai/fal.ts + plagin param builder.
> Haqiqat manbai: fal → docs/FAL-DOCS-MODELS.md; Vertex → adapter kodi (+Google docs kerak bo'lsa).
> Vazifa: HAR enabled:true model uchun per-model matritsa (docs/AI-API-AUDIT.md) — refKind/
> maxRefs/endFrame/imageRequired/aspect/res/duration/cost → provider API maydoniga to'g'ri
> mapping. Plugin→/gen→gen-processor→adapter→provider yo'lini kuzatib, har param to'g'ri
> ketishini tasdiqla. Katalog caps'lari real kontraktga mos emasligini FLAG + FIX (endFrame
> yolg'on, refKind noto'g'ri, res/aspect provider rad etadi, kalitlar mos emas). Frames/refs
> upload → provider o'qiy oladigan shakl (gs://, image_url) ekanini tekshir. PUL-ZONASI:
> consume/refund/cost-quote/webhook idempotency mantig'iga TEGMA; additive/minimal diff;
> jonli API chaqirma (statik audit). Riskli/noaniq = "needs confirmation". Har model
> PASS/FIXED/NEEDS-CONFIRMATION verdikti. Faqat AE'да jonli tasdiqlanadiganларни alohida
> ro'yxatga chiqar. Har fix alohida commit. Oxiriga standart commit/summary satri.

> Batafsil to'liq prompt matnlari kerak bo'lsa — Direktordan "g1-g3 promptини ber" yoki
> "API-audit promptини ber" deb so'ra; yuqoridagi qisqartma yetarli bo'lmasa qayta tuzadi.
